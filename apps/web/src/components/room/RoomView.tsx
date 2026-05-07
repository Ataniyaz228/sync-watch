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
import type { VideoResolution, VideoType, RoomState } from '@/types';
import { IconLink, IconCheck, IconChat, IconUsers, IconPlay, IconMic, IconX, IconVolume, IconHistory, IconPlus, IconArrowRight } from '@/components/ui/Icons';

interface RoomViewProps {
  roomSlug: string;
  roomName: string;
  userId: string;
  username: string;
  createdBy: string; // userId of room creator
}

export default function RoomView({ roomSlug, roomName, userId, username, createdBy }: RoomViewProps) {
  const isHost = userId === createdBy;
  const router = useRouter();

  const [videoType, setVideoType] = useState<VideoType | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false); // Mobile chat sheet state
  const [showUrlModal, setShowUrlModal] = useState(false);

  const playerRef = useRef<VideoPlayerAPI | null>(null);
  const { emit, on } = useSocket(roomSlug, username, userId);
  const getPlayer = useCallback(() => playerRef.current, []);

  const { onLocalPlay, onLocalPause, onLocalSeek, pauseRequest, acceptPauseRequest, rejectPauseRequest } = useVideoSync({
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

  useEffect(() => {
    const u = on('video:sync-state', (s: RoomState) => {
      if (s.type && s.resolvedUrl) { setVideoType(s.type); setVideoUrl(s.resolvedUrl); setVideoTitle(s.title || ''); }
    });
    return u;
  }, [on]);

  const handleVideoResolved = useCallback((r: VideoResolution) => {
    setVideoType(r.type); setVideoUrl(r.resolvedUrl); setVideoTitle(r.title || '');
    emit('video:url-change', { roomSlug, ...r });
    setShowUrlModal(false);
  }, [emit, roomSlug]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomSlug}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }, [roomSlug]);

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
                <h3 className="text-[16px] font-semibold text-[var(--color-text-0)]">Change Video</h3>
                <button onClick={() => setShowUrlModal(false)} className="text-[var(--color-text-4)] hover:text-[var(--color-text-1)] transition-colors">
                  <IconX size={20} />
                </button>
              </div>
              <UrlInput onVideoResolved={handleVideoResolved} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Main Content (Video Area) ─── */}
      <div className="relative flex-1 flex flex-col min-w-0 bg-[#000]">
        
        {/* Top Control Bar */}
        <header className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 to-transparent pt-4 pb-12 px-4 sm:px-6 flex items-start justify-between pointer-events-none">
          
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
                  <div key={u+i} className="w-6 h-6 rounded-full bg-gradient-to-br from-[#D4A06A] to-[#8c6742] border border-black flex items-center justify-center text-[9px] font-bold text-white shadow-sm" title={u}>
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
            {isHost && (
              <button onClick={() => setShowUrlModal(true)} className="hidden sm:flex h-9 px-4 items-center gap-2 rounded-full bg-[#D4A06A] hover:bg-[#c4885a] text-black font-semibold text-[12px] transition-all shadow-[0_0_15px_rgba(212,160,106,0.3)]">
                <IconPlus size={14} /> Change Video
              </button>
            )}
            
            {isInCall ? (
              <div className="flex items-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-lg">
                <button onClick={toggleMute} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isMuted ? 'text-white/60 hover:text-white hover:bg-white/10' : 'bg-[#D4A06A]/20 text-[#D4A06A] shadow-[0_0_10px_rgba(212,160,106,0.2)]'}`} title={isMuted ? 'Unmute' : 'Mute'}>
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

            <button onClick={() => router.push(`/room/${roomSlug}/history`)} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg hidden sm:flex" title="Room history">
              <IconHistory size={15} />
            </button>

            <button onClick={copyLink} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg" title="Copy link">
              {copied ? <IconCheck size={15} className="text-[#5CB87A]" /> : <IconLink size={15} />}
            </button>

            {/* Mobile Chat Toggle */}
            <button onClick={() => setChatOpen(true)} className="lg:hidden w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg relative">
              <IconChat size={15} />
              {messages.length > 0 && <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#D4A06A] border-2 border-black" />}
            </button>
          </div>
        </header>

        {/* Video Player Container */}
        <div className="flex-1 relative flex items-center justify-center pt-20 pb-4 px-0 sm:px-4">
          <div className="w-full max-w-6xl aspect-video relative rounded-none sm:rounded-2xl overflow-hidden shadow-2xl bg-[#0A0A0B]">
            <VideoPlayer type={videoType} url={videoUrl} title={videoTitle} onPlay={onLocalPlay} onPause={onLocalPause} onSeeked={onLocalSeek} playerRef={playerRef} />
            
            {/* Empty State */}
            {!videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                    <IconPlay size={32} className="text-white/20 ml-2" />
                  </div>
                  <p className="text-white/40 text-[14px]">
                    {isHost ? 'Click "Change Video" to start watching' : 'Waiting for host to start a video'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Mobile controls row for host (if they need to change video) */}
        {isHost && (
          <div className="sm:hidden px-4 pb-4 flex justify-center">
             <button onClick={() => setShowUrlModal(true)} className="w-full h-12 rounded-xl bg-white/10 text-white font-medium text-[13px] flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
                <IconPlus size={16} /> Change Video
             </button>
          </div>
        )}
      </div>

      {/* ─── Chat Sidebar (Desktop) ─── */}
      <div className="hidden lg:flex flex-col w-[320px] xl:w-[380px] bg-[var(--color-bg-1)] border-l border-[var(--color-border)] z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-1)]/80 backdrop-blur-md">
          <h2 className="text-[14px] font-semibold text-[var(--color-text-0)] tracking-tight">Room Chat</h2>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <Chat messages={messages} onSendMessage={sendMessage} onReact={reactToMessage} messagesEndRef={messagesEndRef} currentUserId={userId} />
        </div>
      </div>

      {/* ─── Chat Sheet (Mobile) ─── */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-x-0 bottom-0 h-[75dvh] bg-[var(--color-bg-1)] border-t border-[var(--color-border)] rounded-t-3xl z-50 flex flex-col lg:hidden overflow-hidden shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-[var(--color-border-hover)]" />
              </div>
              <div className="px-5 py-2 flex items-center justify-between border-b border-[var(--color-border)]">
                <h2 className="text-[15px] font-semibold text-[var(--color-text-0)]">Room Chat</h2>
                <button onClick={() => setChatOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full surface-raised text-[var(--color-text-3)]">
                  <IconX size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden relative bg-[var(--color-bg-0)]">
                <Chat messages={messages} onSendMessage={sendMessage} onReact={reactToMessage} messagesEndRef={messagesEndRef} currentUserId={userId} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
    </div>
  );
}
