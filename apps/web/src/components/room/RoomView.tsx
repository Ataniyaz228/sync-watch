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
  const [desktopUrl, setDesktopUrl] = useState('');
  const [desktopUrlLoading, setDesktopUrlLoading] = useState(false);
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


  useEffect(() => {
    const u = on('video:url-changed', (d) => { setVideoType(d.type); setVideoUrl(d.resolvedUrl); setVideoTitle(d.title || ''); });
    return u;
  }, [on]);

  // Pending sync: stores target position/state until player is READY
  const pendingSyncRef = useRef<{ currentTime: number; isPlaying: boolean } | null>(null);
  const syncRequestedRef = useRef(false);

  // Called when the actual player (YouTube/HLS/native/VK) finishes initializing
  const onPlayerReady = useCallback(() => {
    const pending = pendingSyncRef.current;
    if (!pending) return;
    const player = playerRef.current;
    if (!player) return;

    // Player is TRULY ready — apply sync
    if (pending.currentTime > 1) {
      player.seek(pending.currentTime);
    }
    if (pending.isPlaying) {
      player.play();
    }
    pendingSyncRef.current = null;

    // If we haven't requested sync-state yet (first join), do it now
    // This handles the case where sync-state arrived before player was ready
    if (!syncRequestedRef.current) {
      syncRequestedRef.current = true;
      emit('video:sync-request', { roomSlug });
    }
  }, [emit, roomSlug]);

  useEffect(() => {
    const u = on('video:sync-state', (s: RoomState) => {
      if (s.type && s.resolvedUrl) {
        setVideoType(s.type); setVideoUrl(s.resolvedUrl); setVideoTitle(s.title || '');
        // Store pending sync — player is likely not ready yet
        pendingSyncRef.current = {
          currentTime: s.currentTime ?? 0,
          isPlaying: s.isPlaying ?? false,
        };
        // If player is ALREADY ready (e.g. same video URL), apply immediately
        const player = playerRef.current;
        if (player) {
          setTimeout(() => {
            const p = pendingSyncRef.current;
            if (!p) return;
            if (p.currentTime > 1) player.seek(p.currentTime);
            if (p.isPlaying) player.play();
            pendingSyncRef.current = null;
          }, 500);
        }
      }
    });

    // Single sync request after mount — if server already sent sync-state before
    // this handler was registered, we need to re-request
    const t = setTimeout(() => {
      if (!syncRequestedRef.current) {
        syncRequestedRef.current = true;
        emit('video:sync-request', { roomSlug });
      }
    }, 1000);

    return () => { u(); clearTimeout(t); };
  }, [on, emit, roomSlug]);

  // Host: periodically broadcast position so guests stay in sync
  useEffect(() => {
    if (!isHost || !videoUrl) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const currentTime = player.getCurrentTime();
      if (currentTime > 0) {
        emit('video:sync-position', { roomSlug, currentTime, isPlaying: player.isPlaying() });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isHost, videoUrl, emit, roomSlug]);

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
                      onPlay={onLocalPlay} onPause={onLocalPause} onSeeked={onLocalSeek}
                      onReady={onPlayerReady} playerRef={playerRef} />
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
                    messagesEndRef={messagesEndRef} currentUserId={userId}
                    pauseRequest={isHost ? pauseRequest : null}
                    onAcceptPause={acceptPauseRequest}
                    onRejectPause={rejectPauseRequest}
                    videoRequest={isHost ? videoRequest : null}
                    onAcceptVideoRequest={acceptVideoRequest}
                    onRejectVideoRequest={rejectVideoRequest}
                    videoSuggestion={isHost ? videoSuggestion : null}
                    onAcceptSuggestion={acceptVideoSuggestion}
                    onRejectSuggestion={rejectVideoSuggestion}
                  />
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

      {/* ════════════════════════════════════════════
           DESKTOP LAYOUT — Selenite Design
      ════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col flex-1 min-w-0 min-h-0" style={{ background: 'var(--dt-bg)' }}>

        {/* ── Topbar ── */}
        <div className="dt-top">
          <div className="dt-tl">
            <button className="dt-icon-btn" onClick={() => router.push('/')} title="Назад">
              <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
            </button>
            <span className="dt-logo">watch</span>
            <div className="dt-sep" />
            <span className="dt-rname">{roomName}</span>
            <span className="dt-host-b">{isHost ? 'host' : 'viewer'}</span>
          </div>
          <div className="dt-tr">
            {isInCall ? (
              <div className="dt-voice-p" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                <div className="dt-waves">
                  <div className="dt-w" /><div className="dt-w" />
                  <div className="dt-w" /><div className="dt-w" />
                </div>
                <span className="dt-voice-txt">голос · {usersCount}</span>
                <i className={`ti ${isMuted ? 'ti-microphone-off' : 'ti-microphone'}`}
                   style={{ fontSize: 13, color: isMuted ? 'var(--dt-t3)' : 'var(--dt-a)' }} />
              </div>
            ) : (
              <button className="dt-voice-p" onClick={joinCall} title="Войти в голосовой">
                <i className="ti ti-microphone" style={{ fontSize: 13, color: 'var(--dt-t2)' }} />
                <span className="dt-voice-txt">голос</span>
              </button>
            )}
            {isInCall && (
              <button className="dt-icon-btn" onClick={leaveCall} title="Выйти из звонка"
                style={{ color: '#E5584F' }}>
                <i className="ti ti-phone-off" style={{ fontSize: 13 }} />
              </button>
            )}
            <button className="dt-icon-btn" onClick={copyLink} title="Скопировать ссылку">
              {copied
                ? <i className="ti ti-check" style={{ fontSize: 14, color: 'var(--dt-a)' }} />
                : <i className="ti ti-link" style={{ fontSize: 14 }} />}
            </button>
            <button className="dt-icon-btn" onClick={() => router.push(`/room/${roomSlug}/history`)} title="История">
              <i className="ti ti-history" style={{ fontSize: 14 }} />
            </button>
            <div className="dt-avs">
              {users.slice(0, 4).map((u, i) => {
                const bgs = ['var(--dt-a)','#1e2e3a','#2a1e3a','#1e3a2a'];
                const fgs = ['#0d1a20','#6a98b8','#8a6ab8','#6ab88a'];
                return (
                  <div key={u + i} className="dt-av"
                    style={{ background: bgs[i % 4], color: fgs[i % 4], marginLeft: i > 0 ? -6 : 0, zIndex: 4 - i }}
                    title={u}>{u[0].toUpperCase()}</div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Main Row ── */}
        <div className="dt-main">

          {/* ── Left panel ── */}
          <div className="dt-left">

            {/* Video */}
            <div className="dt-vid">
              {videoUrl ? (
                <VideoPlayer
                  type={videoType} url={videoUrl} title={videoTitle}
                  onPlay={onLocalPlay} onPause={onLocalPause} onSeeked={onLocalSeek}
                  onReady={onPlayerReady} playerRef={playerRef}
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                  <i className="ti ti-device-tv" style={{ fontSize: 64, color: '#ffffff05' }} />
                  <p style={{ fontSize: 13, color: 'var(--dt-t2)' }}>
                    {isHost ? 'Вставь ссылку ниже чтобы начать' : 'Ждём хоста...'}
                  </p>
                </div>
              )}
            </div>

            {/* ep-bar — exactly like reference */}
            <div className="dt-ep-bar">
              <div className="dt-ep-thumb"><i className="ti ti-device-tv" /></div>
              <div className="dt-ep-info">
                <div className="dt-ep-title">{videoTitle || (videoUrl ? 'Видео загружено' : 'Ничего не играет')}</div>
                <div className="dt-ep-sub">{usersCount} смотрят</div>
              </div>
              <div className="dt-ep-btns">
                <button className="dt-ep-btn">
                  <i className="ti ti-player-track-prev" style={{ fontSize: 11 }} />
                </button>
                <button className="dt-ep-btn" onClick={() => setSidebarTab('queue')}>
                  <i className="ti ti-playlist" style={{ fontSize: 11 }} />очередь
                </button>
                {queue.length > 0 && isHost && (
                  <button className="dt-ep-btn acc" onClick={playNext}>
                    <i className="ti ti-player-track-next" style={{ fontSize: 11 }} />след.
                  </button>
                )}
              </div>
            </div>

            {/* url-bar — exactly like reference */}
            <form className="dt-url-bar" onSubmit={async (e) => {
              e.preventDefault();
              const u = desktopUrl.trim();
              if (!u || desktopUrlLoading) return;
              setDesktopUrlLoading(true);
              try {
                const { apiRequest } = await import('@/lib/utils');
                const result = await apiRequest<import('@/types').VideoResolution>('/api/videos/resolve', {
                  method: 'POST', body: JSON.stringify({ url: u }),
                });
                handleVideoResolved(result);
                setDesktopUrl('');
              } catch (err) {
                setToastMsg(err instanceof Error ? err.message : 'Не удалось загрузить');
                setTimeout(() => setToastMsg(''), 3000);
              } finally {
                setDesktopUrlLoading(false);
              }
            }}>
              <div className="dt-url-inp-wrap">
                <i className="ti ti-link" style={{ fontSize: 13, color: 'var(--dt-t3)', flexShrink: 0 }} />
                <input
                  type="url" value={desktopUrl}
                  onChange={e => setDesktopUrl(e.target.value)}
                  placeholder="youtube, vk, m3u8, mp4 и любые другие ссылки..."
                  autoComplete="off"
                  className="dt-url-inp"
                  id="dt-url-input"
                />
              </div>
              <button type="submit" className="dt-url-go" disabled={!desktopUrl.trim() || desktopUrlLoading}>
                {desktopUrlLoading
                  ? <div style={{ width: 12, height: 12, border: '2px solid rgba(10,21,26,.25)', borderTop: '2px solid #0a151a', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                  : <><i className="ti ti-player-play" style={{ fontSize: 11 }} />загрузить</>
                }
              </button>
            </form>

          </div>{/* /dt-left */}

          {/* ── Right sidebar — always visible ── */}
          <div className="dt-right">
            <div className="dt-sb-tabs">
              <button className={`dt-sb-tab${sidebarTab === 'chat' ? ' on' : ''}`}
                onClick={() => setSidebarTab('chat')}>
                чат{messages.length > 0 && <span style={{ marginLeft: 5, fontSize: 9, opacity: .5 }}>{messages.length}</span>}
              </button>
              <button className={`dt-sb-tab${sidebarTab === 'queue' ? ' on' : ''}`}
                onClick={() => setSidebarTab('queue')}>
                очередь{queue.length > 0 && <span style={{ marginLeft: 5, color: 'var(--dt-a)', fontWeight: 700, fontSize: 9 }}>{queue.length}</span>}
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {sidebarTab === 'chat' ? (
                <Chat messages={messages} onSendMessage={sendMessage} onReact={reactToMessage}
                  messagesEndRef={messagesEndRef} currentUserId={userId}
                  pauseRequest={isHost ? pauseRequest : null}
                  onAcceptPause={acceptPauseRequest}
                  onRejectPause={rejectPauseRequest}
                  videoRequest={isHost ? videoRequest : null}
                  onAcceptVideoRequest={acceptVideoRequest}
                  onRejectVideoRequest={rejectVideoRequest}
                  videoSuggestion={isHost ? videoSuggestion : null}
                  onAcceptSuggestion={acceptVideoSuggestion}
                  onRejectSuggestion={rejectVideoSuggestion}
                />
              ) : (
                /* ── Queue tab ── */
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {queue.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: '32px 16px' }}>
                        <i className="ti ti-playlist" style={{ fontSize: 32, color: 'var(--dt-t3)' }} />
                        <p style={{ fontSize: 11, color: 'var(--dt-t2)', textAlign: 'center' }}>Очередь пуста.<br/>Добавь ссылку снизу.</p>
                      </div>
                    ) : (
                      queue.map((item, i) => (
                        <div key={item.id} className="dt-q-item">
                          <div className="dt-q-num">{i + 1}</div>
                          <div className="dt-q-thumb">
                            <i className="ti ti-device-tv" style={{ fontSize: 12, color: 'var(--dt-t3)' }} />
                          </div>
                          <div className="dt-q-info">
                            <div className="dt-q-title">{item.title || item.originalUrl}</div>
                            <div className="dt-q-by">{item.addedByName}</div>
                          </div>
                          {isHost && (
                            <button onClick={() => removeFromQueue(item.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dt-t3)', fontSize: 12, padding: '4px 8px', flexShrink: 0 }}>
                              <i className="ti ti-x" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {queue.length > 0 && isHost && (
                    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--dt-br)', flexShrink: 0 }}>
                      <button onClick={playNext}
                        style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'var(--dt-a)', color: '#0a151a', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
                        <i className="ti ti-player-track-next" style={{ fontSize: 13 }} />Play Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>{/* /dt-main */}
      </div>{/* /desktop wrapper */}


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
