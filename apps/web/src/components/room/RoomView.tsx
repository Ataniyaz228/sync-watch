'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useChat } from '@/hooks/useChat';
import { useVideoSync, type VideoPlayerAPI } from '@/hooks/useVideoSync';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import VideoPlayer from './VideoPlayer';
import UrlInput from './UrlInput';
import Chat from './Chat';
import type { VideoResolution, VideoType, RoomState, QueueItem, RequestAction } from '@/types';
import { IconLink, IconCheck, IconChat, IconPlay, IconMic, IconX, IconHistory, IconPlus, IconArrowRight, IconMoreVertical, IconList, IconTv } from '@/components/ui/Icons';
import MobileUrlTab from './MobileUrlTab';

interface RoomViewProps {
  roomSlug: string;
  roomName: string;
  userId: string;
  username: string;
  createdBy: string;
  initialVideoUrl?: string;
  initialVideoType?: string;
  initialResolvedUrl?: string;
  initialVideoTitle?: string;
}

export default function RoomView({ roomSlug, roomName, userId, username, createdBy, initialVideoUrl, initialVideoType, initialResolvedUrl, initialVideoTitle }: RoomViewProps) {
  const isHost = userId === createdBy;
  const router = useRouter();
  const initialLoadedRef = useRef(false);

  const [videoType, setVideoType] = useState<VideoType | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlModalMode, setUrlModalMode] = useState<'change' | 'queue'>('change');
  const [videoSuggestion, setVideoSuggestion] = useState<{ username: string; url: string; title?: string; type: string; resolvedUrl: string; originalUrl: string } | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'queue'>('chat');
  const [mobileTab, setMobileTab] = useState<'player' | 'queue' | 'url'>('player');
  const [headerVisible, setHeaderVisible] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const headerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playerRef = useRef<VideoPlayerAPI | null>(null);
  const { emit, on } = useSocket(roomSlug, username, userId);
  const getPlayer = useCallback(() => playerRef.current, []);

  const { onLocalPlay, onLocalPause, onLocalSeek, pauseRequest, acceptPauseRequest, rejectPauseRequest, videoRequest, acceptVideoRequest, rejectVideoRequest } = useVideoSync({
    on, emit: emit as (event: string, data: unknown) => void,
    roomSlug, getPlayer, isHost,
  });

  const { messages, sendMessage, reactToMessage, messagesEndRef } = useChat({
    on, emit: emit as (event: string, data: unknown) => void, roomSlug,
  });

  const { isInCall, isMuted, peerConnected, joinCall, leaveCall, toggleMute } = useVoiceCall({
    on, emit: emit as (event: string, data: unknown) => void, roomSlug, userId,
  });

  useWatchProgress({
    roomSlug,
    videoUrl: videoUrl || null,
    getPlayer,
    isHost,
    enabled: !!videoUrl,
  });

  useEffect(() => {
    const u1 = on('room:user-joined', (d) => { setUsersCount(d.usersCount); setUsers(d.users); });
    const u2 = on('room:user-left', (d) => { setUsersCount(d.usersCount); setUsers(p => p.filter(u => u !== d.username)); });
    return () => { u1(); u2(); };
  }, [on]);

  // Auto-hide header when video is loaded (desktop only)
  const showHeader = useCallback(() => {
    setHeaderVisible(true);
    if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current);
    headerTimeoutRef.current = setTimeout(() => {
      if (videoUrl) setHeaderVisible(false);
    }, 3500);
  }, [videoUrl]);

  useEffect(() => {
    if (!videoUrl) { setHeaderVisible(true); return; }
    showHeader();
    return () => { if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current); };
  }, [videoUrl, showHeader]);

  useEffect(() => {
    const u = on('video:url-changed', (d) => { setVideoType(d.type); setVideoUrl(d.resolvedUrl); setVideoTitle(d.title || ''); });
    return u;
  }, [on]);

  useEffect(() => {
    const u = on('video:sync-state', (s: RoomState) => {
      if (s.type && s.resolvedUrl) { setVideoType(s.type); setVideoUrl(s.resolvedUrl); setVideoTitle(s.title || ''); }
    });
    return u;
  }, [on]);

  // Auto-load video from history query params
  useEffect(() => {
    if (initialLoadedRef.current) return;
    if (initialVideoUrl && initialVideoType) {
      initialLoadedRef.current = true;
      const resolvedUrl = initialResolvedUrl || initialVideoUrl;
      const type = initialVideoType as VideoType;
      setVideoType(type);
      setVideoUrl(resolvedUrl);
      setVideoTitle(initialVideoTitle || '');
      if (isHost) {
        emit('video:url-change', { roomSlug, type, resolvedUrl, originalUrl: initialVideoUrl, title: initialVideoTitle });
      } else {
        emit('video:url-suggest', { roomSlug, type, resolvedUrl, originalUrl: initialVideoUrl, title: initialVideoTitle });
      }
    }
  }, [initialVideoUrl, initialVideoType, initialResolvedUrl, initialVideoTitle, isHost, emit, roomSlug]);

  // ─── Queue callbacks (declared before handleVideoResolved) ───
  const addToQueue = useCallback((r: VideoResolution) => {
    emit('queue:add', { roomSlug, ...r });
  }, [emit, roomSlug]);

  const removeFromQueue = useCallback((id: string) => {
    emit('queue:remove', { roomSlug, id });
  }, [emit, roomSlug]);

  const playNext = useCallback(() => {
    emit('queue:play-next', { roomSlug });
  }, [emit, roomSlug]);

  const handleVideoResolved = useCallback((r: VideoResolution) => {
    if (urlModalMode === 'queue') {
      // Add to queue
      addToQueue(r);
    } else if (isHost) {
      // Host changes video directly
      setVideoType(r.type); setVideoUrl(r.resolvedUrl); setVideoTitle(r.title || '');
      emit('video:url-change', { roomSlug, ...r });
    } else {
      // Viewer suggests video to host
      emit('video:url-suggest', { roomSlug, ...r });
    }
    setShowUrlModal(false);
  }, [emit, roomSlug, isHost, urlModalMode, addToQueue]);

  // Host: receive video suggestion from viewer
  useEffect(() => {
    const u = on('video:url-suggest', (d) => {
      if (isHost) setVideoSuggestion(d);
    });
    return u;
  }, [on, isHost]);

  const acceptVideoSuggestion = useCallback(() => {
    if (!videoSuggestion) return;
    const { type, resolvedUrl, originalUrl, title } = videoSuggestion;
    setVideoType(type as VideoType); setVideoUrl(resolvedUrl); setVideoTitle(title || '');
    emit('video:url-suggest-accept', { roomSlug, type: type as VideoType, resolvedUrl, originalUrl, title });
    setVideoSuggestion(null);
  }, [videoSuggestion, emit, roomSlug]);

  const rejectVideoSuggestion = useCallback(() => {
    emit('video:url-suggest-reject', { roomSlug });
    setVideoSuggestion(null);
  }, [emit, roomSlug]);

  // ─── Queue listeners ───
  useEffect(() => {
    const u1 = on('queue:state', (items) => setQueue(items));
    return u1;
  }, [on]);

  useEffect(() => {
    const u2 = on('queue:added', (item) => setQueue(prev => [...prev, item]));
    return u2;
  }, [on]);

  useEffect(() => {
    const u3 = on('queue:removed', ({ id }) => setQueue(prev => prev.filter(q => q.id !== id)));
    return u3;
  }, [on]);


  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomSlug}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      setToastMsg('Link copied!');
      setTimeout(() => setToastMsg(''), 2500);
    });
  }, [roomSlug]);

  // Mobile: when URL tab resolves a video, switch to player tab
  const handleMobileVideoResolved = useCallback((r: VideoResolution) => {
    handleVideoResolved(r);
    setMobileTab('player');
  }, [handleVideoResolved]);

  const handleMobileAddToQueue = useCallback((r: VideoResolution) => {
    addToQueue(r);
    setMobileTab('queue');
  }, [addToQueue]);

  return (
    <div className="flex flex-col lg:flex-row h-dvh bg-[var(--color-bg-0)] overflow-hidden">
      
      {/* ─── Pause Request Toast ─── */}
      <AnimatePresence>
        {pauseRequest && isHost && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
            className="fixed top-6 left-1/2 z-50 bg-[var(--color-bg-1)]/80 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl px-5 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            style={{ transform: 'translateX(-50%)', minWidth: 320, maxWidth: '90vw' }}
          >
            <p className="text-[13px] text-[var(--color-text-2)] mb-3 text-center">
              <span className="text-[var(--color-text-0)] font-semibold">{pauseRequest.username}</span>
              {' '}requests to pause
            </p>
            <div className="flex gap-3">
              <button onClick={acceptPauseRequest} className="flex-1 btn-glow py-2 text-xs">Accept</button>
              <button onClick={rejectPauseRequest} className="flex-1 btn-secondary py-2 text-xs hover:text-[var(--color-error)]">Reject</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Video Suggestion Toast ─── */}
      <AnimatePresence>
        {videoSuggestion && isHost && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
            className="fixed top-6 left-1/2 z-50 bg-[var(--color-bg-1)]/80 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl px-5 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            style={{ transform: 'translateX(-50%)', minWidth: 320, maxWidth: '90vw' }}
          >
            <p className="text-[13px] text-[var(--color-text-2)] mb-1 text-center">
              <span className="text-[var(--color-text-0)] font-semibold">{videoSuggestion.username}</span>
              {' '}suggests a video
            </p>
            <p className="text-[11px] text-[#A8B8C4] font-medium text-center truncate mb-3">
              {videoSuggestion.title || videoSuggestion.url}
            </p>
            <div className="flex gap-3">
              <button onClick={acceptVideoSuggestion} className="flex-1 btn-glow py-2 text-xs">Accept</button>
              <button onClick={rejectVideoSuggestion} className="flex-1 btn-secondary py-2 text-xs hover:text-[var(--color-error)]">Reject</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Unified Video Request Toast ─── */}
      <AnimatePresence>
        {videoRequest && isHost && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
            className="fixed top-6 left-1/2 z-50 bg-[var(--color-bg-1)]/80 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl px-5 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            style={{ transform: 'translateX(-50%)', minWidth: 320, maxWidth: '90vw' }}
          >
            <p className="text-[13px] text-[var(--color-text-2)] mb-3 text-center">
              <span className="text-[var(--color-text-0)] font-semibold">{videoRequest.username}</span>
              {' '}requests to {videoRequest.action === 'play' ? 'play' : `seek to ${Math.floor((videoRequest.currentTime || 0) / 60)}:${String(Math.floor((videoRequest.currentTime || 0) % 60)).padStart(2, '0')}`}
            </p>
            <div className="flex gap-3">
              <button onClick={acceptVideoRequest} className="flex-1 btn-glow py-2 text-xs">Accept</button>
              <button onClick={rejectVideoRequest} className="flex-1 btn-secondary py-2 text-xs hover:text-[var(--color-error)]">Reject</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Change Video Modal ─── */}
      <AnimatePresence>
        {showUrlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowUrlModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-[var(--color-bg-1)]/90 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-semibold text-[var(--color-text-0)]">{urlModalMode === 'queue' ? 'Add to Queue' : isHost ? 'Change Video' : 'Suggest Video'}</h3>
                <button onClick={() => setShowUrlModal(false)} className="text-[var(--color-text-4)] hover:text-[var(--color-text-1)] transition-colors">
                  <IconX size={20} />
                </button>
              </div>
              <UrlInput onVideoResolved={handleVideoResolved} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════
           MOBILE LAYOUT — Selenite Design
      ════════════════════════════════════ */}
      <div className="mob flex lg:hidden flex-col flex-1 min-h-0 overflow-hidden">

        {/* ── Topbar ── */}
        <div className="mob-top">
          <div className="mob-top-l">
            <button className="mob-back" onClick={() => router.push('/')}>
              <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
            </button>
            <span className="mob-rname">{roomName}</span>
            {isHost && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(168,184,196,0.2)', color: '#A8B8C4', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                HOST
              </span>
            )}
          </div>

          <div className="mob-top-r">
            {/* Voice pill */}
            <button
              className={`mob-vpill${isInCall ? ' active' : ''}`}
              onClick={isInCall ? leaveCall : joinCall}
            >
              {isInCall ? (
                <>
                  <div className="mob-waves">
                    <div className={`mob-wave${isMuted ? ' opacity-30' : ''}`} />
                    <div className={`mob-wave${isMuted ? ' opacity-30' : ''}`} />
                    <div className={`mob-wave${isMuted ? ' opacity-30' : ''}`} />
                    <div className={`mob-wave${isMuted ? ' opacity-30' : ''}`} />
                  </div>
                  <span className="mob-vpill-txt">{isMuted ? 'muted' : 'voice'}</span>
                  {isMuted && (
                    <button onClick={e => { e.stopPropagation(); toggleMute(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777', padding: 0 }}>
                      <i className="ti ti-microphone" style={{ fontSize: 11 }} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <i className="ti ti-microphone" style={{ fontSize: 13, color: '#383838' }} />
                  <span className="mob-vpill-txt">voice</span>
                </>
              )}
            </button>

            {/* User avatars */}
            <div className="mob-avs">
              {users.slice(0, 2).map((u, i) => (
                <div key={u+i} className="mob-av"
                  style={{
                    background: i === 0 ? '#A8B8C4' : '#2a3a4a',
                    color: i === 0 ? '#0d1a20' : '#8aa8c0',
                    marginLeft: i > 0 ? -6 : 0,
                    zIndex: 2 - i,
                  }}
                  title={u}>
                  {u[0].toUpperCase()}
                </div>
              ))}
              {users.length > 2 && (
                <div className="mob-av" style={{ background: '#1c1c1c', color: '#777', marginLeft: -6 }}>
                  +{users.length - 2}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <AnimatePresence mode="wait">

            {/* PLAYER TAB */}
            {mobileTab === 'player' && (
              <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }} className="flex flex-col flex-1 min-h-0">

                {/* Video */}
                <div className="mob-vid">
                  {videoUrl ? (
                    <VideoPlayer type={videoType} url={videoUrl} title={videoTitle}
                      onPlay={onLocalPlay} onPause={onLocalPause} onSeeked={onLocalSeek} playerRef={playerRef} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <i className="ti ti-player-play" style={{ fontSize: 40, color: '#383838' }} />
                      <p style={{ fontSize: 12, color: '#383838', textAlign: 'center', padding: '0 24px' }}>
                        {isHost ? 'Открой вкладку URL и добавь видео' : 'Ждём хоста...'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Episode info row */}
                {(videoTitle || videoUrl) && (
                  <div className="mob-ep-row">
                    <div className="mob-ep-l">
                      <div className="mob-ep-title">{videoTitle || roomName}</div>
                      <div className="mob-ep-sub">{usersCount} watching</div>
                    </div>
                    {queue.length > 0 && isHost && (
                      <button className="mob-ep-next" onClick={playNext}>
                        <i className="ti ti-player-track-next" style={{ fontSize: 11 }} />
                        след.
                      </button>
                    )}
                  </div>
                )}

                {/* Chat + input (use existing Chat component) */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col" style={{ background: '#080808' }}>
                  <Chat messages={messages} onSendMessage={sendMessage} onReact={reactToMessage}
                    messagesEndRef={messagesEndRef} currentUserId={userId} />
                </div>
              </motion.div>
            )}

            {/* QUEUE TAB */}
            {mobileTab === 'queue' && (
              <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }} className="flex flex-col flex-1 min-h-0">

                <div className="mob-q-header">
                  <span className="mob-q-title">очередь</span>
                  <button className="mob-q-add" onClick={() => setMobileTab('url')}>
                    <i className="ti ti-plus" style={{ fontSize: 12 }} />
                    добавить
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {queue.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12 }}>
                      <i className="ti ti-playlist" style={{ fontSize: 36, color: '#383838' }} />
                      <p style={{ fontSize: 12, color: '#383838', textAlign: 'center' }}>
                        Очередь пуста.<br />Добавь видео.
                      </p>
                    </div>
                  ) : (
                    queue.map((item, i) => (
                      <div key={item.id} className="mob-qi">
                        <span className="mob-qn" style={{ color: '#777' }}>{i + 1}</span>
                        <div className="mob-qthumb">
                          <i className="ti ti-device-tv" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mob-qi-name">{item.title || item.originalUrl}</div>
                          <div className="mob-qi-meta">{item.addedByName}</div>
                        </div>
                        {isHost && (
                          <button onClick={() => removeFromQueue(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#383838', padding: 4 }}>
                            <i className="ti ti-x" style={{ fontSize: 14 }} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {queue.length > 0 && isHost && (
                  <div style={{ padding: '8px 18px 12px', borderTop: '1px solid #1a1a1a' }}>
                    <button onClick={playNext} style={{
                      width: '100%', padding: '11px', borderRadius: 12,
                      background: '#A8B8C4', color: '#0a151a',
                      fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      fontFamily: 'inherit',
                    }}>
                      <i className="ti ti-player-play" style={{ fontSize: 14 }} />
                      Play Next
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* URL TAB */}
            {mobileTab === 'url' && (
              <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }} className="flex flex-col flex-1 min-h-0">
                <MobileUrlTab
                  onVideoResolved={handleMobileVideoResolved}
                  onAddToQueue={handleMobileAddToQueue}
                  isHost={isHost}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Bottom Tab Bar ── */}
        <div className="mob-tabs">
          <button className={`mob-tab-btn${mobileTab === 'player' ? ' on' : ''}`} onClick={() => setMobileTab('player')}>
            {mobileTab === 'player' && <div className="mob-tab-line" />}
            <i className="ti ti-device-tv" />
            <span>Плеер</span>
          </button>
          <button className={`mob-tab-btn${mobileTab === 'queue' ? ' on' : ''}`} onClick={() => setMobileTab('queue')}>
            {mobileTab === 'queue' && <div className="mob-tab-line" />}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <i className="ti ti-playlist" />
              {queue.length > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -6,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#A8B8C4', color: '#0d1a20',
                  fontSize: 7, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{queue.length}</div>
              )}
            </div>
            <span>Очередь</span>
          </button>
          <button className={`mob-tab-btn${mobileTab === 'url' ? ' on' : ''}`} onClick={() => setMobileTab('url')}>
            {mobileTab === 'url' && <div className="mob-tab-line" />}
            <i className="ti ti-link" />
            <span>URL</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════
           DESKTOP LAYOUT (hidden on mobile)
      ════════════════════════════════════ */}
      {/* ─── Main Content (Video Area) ─── */}
      <div className="relative flex-1 hidden lg:flex flex-col min-w-0 min-h-0 bg-[#000]"
        onMouseMove={showHeader} onTouchStart={showHeader}>
        
        {/* Top Control Bar */}
        <header className={`absolute top-0 left-0 w-full z-40 bg-gradient-to-b from-black/80 to-transparent pt-4 pb-10 px-4 sm:px-6 flex items-start justify-between pointer-events-none transition-all duration-500 ${headerVisible ? 'opacity-100 translate-y-0' : 'lg:opacity-0 lg:-translate-y-4'}`}>
          
          <div className="flex flex-col gap-2 pointer-events-auto">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition-all">
                <IconArrowRight size={14} className="rotate-180" />
              </button>
              <h1 className="text-[16px] sm:text-[18px] font-bold text-white tracking-tight drop-shadow-md">{roomName}</h1>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest backdrop-blur-md ${isHost ? 'bg-[#D4A06A]/20 text-[#D4A06A] border border-[#D4A06A]/30' : 'bg-white/10 text-white/60 border border-white/10'}`}>
                {isHost ? 'Host' : 'Viewer'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 ml-11">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
                <div className="status-dot live !bg-[#5CB87A]" />
                <span className="text-[11px] font-medium text-white/80">{usersCount} <span className="text-white/40 hidden sm:inline">watching</span></span>
              </div>
              
              <div className="flex items-center -space-x-1.5">
                {users.slice(0, 3).map((u, i) => (
                  <div key={u+i} className="w-6 h-6 rounded-full bg-[#A8B8C4] border border-black flex items-center justify-center text-[9px] font-bold text-white shadow-sm" title={u}>
                    {u[0].toUpperCase()}
                  </div>
                ))}
                {users.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-md border border-black flex items-center justify-center text-[9px] font-bold text-white">
                    +{users.length - 3}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={() => { setUrlModalMode('change'); setShowUrlModal(true); }} className="hidden sm:flex h-9 px-4 items-center gap-2 rounded-full bg-[#A8B8C4] hover:bg-[#7A9BAC] text-black font-semibold text-[12px] transition-all shadow-[0_0_15px_rgba(168,184,196,0.25)]">
              <IconPlus size={14} /> {isHost ? 'Change Video' : 'Suggest Video'}
            </button>
            <button onClick={() => { setUrlModalMode('change'); setShowUrlModal(true); }} className="sm:hidden w-9 h-9 rounded-full bg-[#A8B8C4] hover:bg-[#7A9BAC] flex items-center justify-center text-black transition-all shadow-[0_0_15px_rgba(168,184,196,0.25)]" title={isHost ? 'Change Video' : 'Suggest Video'}>
              <IconPlus size={16} />
            </button>
            
            {isInCall ? (
              <div className="flex items-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-lg">
                <button onClick={toggleMute} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isMuted ? 'text-white/60 hover:text-white hover:bg-white/10' : 'bg-[#A8B8C4]/15 text-[#A8B8C4] shadow-[0_0_10px_rgba(168,184,196,0.2)]'}`} title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? <IconX size={14} /> : <IconMic size={14} />}
                </button>
                {peerConnected && (
                  <div className="flex items-center gap-1.5 px-3 border-l border-white/10 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5CB87A] animate-pulse" />
                    <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Live</span>
                  </div>
                )}
                <button onClick={leaveCall} className="w-8 h-8 rounded-full flex items-center justify-center text-[#E5584F] hover:bg-[#E5584F]/10 transition-colors ml-1" title="End call">
                  <IconX size={14} />
                </button>
              </div>
            ) : (
              <button onClick={joinCall} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg" title="Join voice">
                <IconMic size={16} />
              </button>
            )}

            {/* Desktop: show all buttons. Mobile: group into More menu */}
            <button onClick={copyLink} className="hidden sm:flex w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg" title="Copy link">
              {copied ? <IconCheck size={15} className="text-[#5CB87A]" /> : <IconLink size={15} />}
            </button>

            <button onClick={() => router.push(`/room/${roomSlug}/history`)} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg hidden sm:flex" title="Room history">
              <IconHistory size={15} />
            </button>

            {/* Mobile: More menu */}
            <div className="relative sm:hidden">
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg">
                <IconMoreVertical size={16} />
              </button>
              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    transition={{ duration: 0.15 }} className="more-menu" onClick={() => setShowMoreMenu(false)}>
                    <button onClick={copyLink} className="more-menu-item">
                      <IconLink size={14} /> {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button onClick={() => router.push(`/room/${roomSlug}/history`)} className="more-menu-item">
                      <IconHistory size={14} /> Room History
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Chat Toggle */}
            <button onClick={() => setChatOpen(true)} className="lg:hidden w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg relative">
              <IconChat size={15} />
              {messages.length > 0 && <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#A8B8C4] border-2 border-black" />}
            </button>
          </div>
        </header>

        {/* Video Player Container */}
        <div className={`relative flex items-center justify-center px-0 sm:px-4 lg:px-8 flex-1 ${videoUrl ? 'pt-20 pb-4' : 'pt-0 pb-0'}`}>
          {videoUrl ? (
            /* Video loaded — standard aspect-video container */
            <div className="w-full max-w-6xl aspect-video relative rounded-none sm:rounded-2xl overflow-hidden shadow-2xl bg-[#0A0A0B]">
              <VideoPlayer
                type={videoType}
                url={videoUrl}
                title={videoTitle}
                onPlay={onLocalPlay}
                onPause={onLocalPause}
                onSeeked={onLocalSeek}
                playerRef={playerRef}
              />
            </div>
          ) : (
            /* Empty State — fills entire area, centered */
            <div className="flex items-center justify-center w-full h-full">
              <div className="text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm shadow-[0_0_40px_rgba(168,184,196,0.08)]">
                  <IconPlay size={36} className="text-[#A8B8C4]/60 ml-2 sm:scale-125" />
                </div>
                <p className="text-white/40 text-[14px] sm:text-[16px] font-medium drop-shadow-md mb-5">
                  {isHost ? 'No video yet — start watching!' : 'Waiting for host to start a video...'}
                </p>
                {isHost && (
                  <button onClick={() => { setUrlModalMode('change'); setShowUrlModal(true); }}
                    className="px-6 py-3 rounded-xl bg-[#A8B8C4] hover:bg-[#7A9BAC] text-black font-semibold text-[13px] transition-all shadow-[0_4px_20px_rgba(168,184,196,0.25)] hover:shadow-[0_6px_30px_rgba(168,184,196,0.3)] hover:-translate-y-0.5 flex items-center gap-2 mx-auto">
                    <IconPlus size={15} /> Add Video
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        

      </div>

      {/* ─── Unified Sidebar (Desktop only) ─── */}
      <div className={`hidden lg:flex flex-col w-full lg:w-[360px] xl:w-[420px] shrink-0 bg-[var(--color-bg-1)] border-t lg:border-t-0 lg:border-l border-[var(--color-border)] z-20 lg:flex-none shadow-[-10px_0_30px_rgba(0,0,0,0.5)] min-h-0`}>
        {/* Mobile drag handle */}
        <div className="sheet-handle lg:hidden" />

        {/* Tab Header */}
        <div className="p-2 sm:p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-1)]/80 backdrop-blur-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-[var(--color-bg-0)] rounded-lg p-1 flex-1">
            <button onClick={() => setSidebarTab('chat')} className={`relative flex-1 flex items-center justify-center gap-1.5 text-[13px] font-semibold py-2 rounded-md transition-colors ${sidebarTab === 'chat' ? 'text-[var(--color-text-0)]' : 'text-[var(--color-text-2)] hover:text-[var(--color-text-1)]'}`}>
              {sidebarTab === 'chat' && (
                <motion.div layoutId="activeTab" className="absolute inset-0 bg-[var(--color-bg-3)] rounded-md shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              <span className="relative z-10 flex items-center gap-1.5"><IconChat size={13} /> Chat {messages.length > 0 && <span className="text-[9px] opacity-50 ml-0.5">{messages.length}</span>}</span>
            </button>
            <button onClick={() => setSidebarTab('queue')} className={`relative flex-1 flex items-center justify-center gap-1.5 text-[13px] font-semibold py-2 rounded-md transition-colors ${sidebarTab === 'queue' ? 'text-[var(--color-text-0)]' : 'text-[var(--color-text-2)] hover:text-[var(--color-text-1)]'}`}>
              {sidebarTab === 'queue' && (
                <motion.div layoutId="activeTab" className="absolute inset-0 bg-[var(--color-bg-3)] rounded-md shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              <span className="relative z-10 flex items-center gap-1.5"><IconList size={13} /> Queue {queue.length > 0 && <span className="text-[9px] ml-0.5 text-[#A8B8C4] font-bold">{queue.length}</span>}</span>
            </button>
          </div>
          <button onClick={() => setChatOpen(false)} className="lg:hidden w-7 h-7 rounded-full surface-raised flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-0)] transition-colors shrink-0">
            <IconX size={12} />
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          {sidebarTab === 'chat' ? (
            <Chat messages={messages} onSendMessage={sendMessage} onReact={reactToMessage} messagesEndRef={messagesEndRef} currentUserId={userId} />
          ) : (
            <div className="flex flex-col h-full">
              {/* Queue List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-3)] border border-[var(--color-border)] flex items-center justify-center">
                      <IconList size={22} className="text-[var(--color-text-4)]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] text-[var(--color-text-2)] font-medium mb-1">Queue is empty</p>
                      <p className="text-[11px] text-[var(--color-text-4)]">Add videos to play next in line</p>
                    </div>
                    <button onClick={() => { setUrlModalMode('queue'); setShowUrlModal(true); }} className="px-4 py-2 rounded-lg bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-text-1)] text-[12px] font-medium hover:bg-[var(--color-bg-4)] transition-colors flex items-center gap-1.5">
                      <IconPlus size={12} /> Add Video
                    </button>
                  </div>
                ) : (
                  queue.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-0)] border border-[var(--color-border)] group hover:border-[var(--color-border-hover)] transition-all">
                      <div className="w-7 h-7 rounded-lg bg-[var(--color-bg-3)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-3)] shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[var(--color-text-0)] truncate">{item.title || item.originalUrl}</p>
                        <p className="text-[10px] text-[var(--color-text-4)]">
                          Added by <span className="text-[var(--color-text-2)]">{item.addedByName}</span>
                        </p>
                      </div>
                      {isHost && (
                        <button onClick={() => removeFromQueue(item.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-text-4)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                          <IconX size={10} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {/* Queue Controls */}
              <div className="p-3 border-t border-[var(--color-border)] space-y-2 flex-shrink-0">
                {queue.length > 0 && isHost && (
                  <button onClick={playNext} className="w-full py-2.5 rounded-xl bg-[#D4A06A] text-black text-[13px] font-semibold hover:bg-[#c4885a] transition-colors flex items-center justify-center gap-2">
                    <IconPlay size={14} /> Play Next
                  </button>
                )}
                <button onClick={() => { setUrlModalMode('queue'); setShowUrlModal(true); }} className="w-full py-2.5 rounded-xl bg-[var(--color-bg-3)] text-[var(--color-text-1)] text-[13px] font-medium hover:bg-[var(--color-bg-4)] transition-colors flex items-center justify-center gap-2 border border-[var(--color-border)]">
                  <IconPlus size={14} /> Add to Queue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.25, type: 'spring', bounce: 0.3 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl bg-[var(--color-bg-2)]/90 backdrop-blur-xl border border-[var(--color-border)] shadow-[0_16px_40px_rgba(0,0,0,0.5)] text-[13px] font-medium text-[var(--color-text-0)] flex items-center gap-2 pointer-events-none"
          >
            <IconCheck size={14} className="text-[#5CB87A]" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
