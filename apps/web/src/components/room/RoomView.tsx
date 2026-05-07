'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useChat } from '@/hooks/useChat';
import { useVideoSync, type VideoPlayerAPI } from '@/hooks/useVideoSync';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import VideoPlayer from './VideoPlayer';
import UrlInput from './UrlInput';
import Chat from './Chat';
import type { VideoResolution, VideoType, RoomState } from '@/types';
import { IconLink, IconCheck, IconChat, IconUsers, IconPlay, IconMic, IconX, IconVolume, IconHistory } from '@/components/ui/Icons';

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
  const [chatOpen, setChatOpen] = useState(false);

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
  }, [emit, roomSlug]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomSlug}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }, [roomSlug]);

  return (
    <div className="room-grid">
      <div className="bg-noise" />

      {/* Pause Request Toast — shown to host */}
      <AnimatePresence>
        {pauseRequest && isHost && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 left-1/2 z-50 surface rounded-xl px-4 py-3 shadow-xl border border-[var(--color-border)]"
            style={{ transform: 'translateX(-50%)', minWidth: 280, maxWidth: '90vw' }}
          >
            <p className="text-xs text-[var(--color-text-3)] mb-2">
              <span className="text-[var(--color-text-0)] font-medium">{pauseRequest.username}</span>
              {' '}хочет поставить на паузу
            </p>
            <div className="flex gap-2">
              <button onClick={acceptPauseRequest}
                className="flex-1 text-xs py-1.5 px-3 rounded-md font-medium transition-colors"
                style={{ background: 'var(--color-accent)', color: '#fff' }}>
                Принять
              </button>
              <button onClick={rejectPauseRequest}
                className="flex-1 text-xs py-1.5 px-3 rounded-md surface-raised text-[var(--color-text-2)] transition-colors hover:text-[var(--color-error)]">
                Отклонить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Header ═══ */}
      <header className="room-header border-b border-[var(--color-border)] bg-[var(--color-bg-1)] px-4 py-2.5 flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-md surface-raised flex items-center justify-center">
              <IconPlay size={14} className="text-[var(--color-text-3)]" />
            </div>
          </a>
          <div className="h-5 w-px bg-[var(--color-border)]" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-[var(--color-text-0)] truncate">{roomName}</h1>
            <p className="text-[10px] text-[var(--color-text-4)] font-mono truncate">{roomSlug}</p>
          </div>
          {/* Role badge */}
          <span className={`hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider flex-shrink-0 ${
            isHost
              ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] border border-[var(--color-accent-muted)]'
              : 'bg-[var(--color-bg-3)] text-[var(--color-text-4)] border border-[var(--color-border)]'
          }`}>
            {isHost ? 'Host' : 'Viewer'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Users */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md surface-raised text-[var(--color-text-3)]">
            <div className="status-dot live" />
            <IconUsers size={13} />
            <span className="text-[11px] font-mono">{usersCount}</span>
          </div>

          {/* Voice call */}
          {isInCall ? (
            <div className="flex items-center gap-1">
              <button onClick={toggleMute} className={`btn-icon ${isMuted ? '' : 'active'}`} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <IconX size={14} /> : <IconMic size={14} />}
              </button>
              {peerConnected && (
                <div className="flex items-center gap-1 px-2 py-1.5 text-[var(--color-success)]">
                  <IconVolume size={12} />
                  <span className="text-[10px]">Live</span>
                </div>
              )}
              <button onClick={leaveCall} className="btn-icon" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }} title="End call">
                <IconX size={14} />
              </button>
            </div>
          ) : (
            <button onClick={joinCall} className="btn-icon" title="Join voice">
              <IconMic size={14} />
            </button>
          )}

          {/* History */}
          <button onClick={() => router.push(`/room/${roomSlug}/history`)} className="btn-icon" title="Watch history">
            <IconHistory size={14} />
          </button>

          {/* Copy link */}
          <button onClick={copyLink} className="btn-icon" title="Copy link" id="copy-link-btn">
            {copied ? <IconCheck size={14} className="text-[var(--color-success)]" /> : <IconLink size={14} />}
          </button>

          {/* Mobile chat toggle */}
          <button onClick={() => setChatOpen(!chatOpen)}
            className={`btn-icon lg:hidden relative ${chatOpen ? 'active' : ''}`} id="toggle-chat-btn">
            <IconChat size={14} />
            {messages.length > 0 && !chatOpen && (
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
            )}
          </button>
        </div>
      </header>

      {/* ═══ Video Section ═══ */}
      <div className="flex flex-col p-3 gap-3 min-h-0 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          className="surface rounded-xl p-2.5 flex-shrink-0">
          <VideoPlayer type={videoType} url={videoUrl} title={videoTitle}
            onPlay={onLocalPlay} onPause={onLocalPause} onSeeked={onLocalSeek} playerRef={playerRef} />
        </motion.div>

        {/* URL Input — only host sees it */}
        {isHost && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}
            className="surface rounded-xl p-3 flex-shrink-0">
            <UrlInput onVideoResolved={handleVideoResolved} />
          </motion.div>
        )}

        {/* Viewer hint */}
        {!isHost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex items-center gap-2 px-3 py-2 surface-raised rounded-lg flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-4)]" />
            <p className="text-[11px] text-[var(--color-text-4)]">Host controls playback — your play/pause won't affect others</p>
          </motion.div>
        )}

        {/* Viewers — desktop */}
        {users.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 px-1 flex-shrink-0">
            <span className="text-[10px] text-[var(--color-text-4)] uppercase tracking-wider mr-1">In room</span>
            {users.map((u, i) => (
              <span key={u + i} className="text-[11px] text-[var(--color-text-3)] px-2 py-0.5 rounded-md surface-raised">{u}</span>
            ))}
          </div>
        )}

        {/* Mobile chat */}
        {chatOpen && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="surface rounded-xl min-h-[300px] max-h-[400px] flex flex-col lg:hidden overflow-hidden flex-shrink-0">
            <Chat messages={messages} onSendMessage={sendMessage}
              onReact={reactToMessage} messagesEndRef={messagesEndRef} currentUserId={userId} />
          </motion.div>
        )}
      </div>

      {/* ═══ Chat Sidebar — Desktop ═══ */}
      <div className="hidden lg:flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-1)] min-h-0 overflow-hidden">
        <Chat messages={messages} onSendMessage={sendMessage}
          onReact={reactToMessage} messagesEndRef={messagesEndRef} currentUserId={userId} />
      </div>
    </div>
  );
}
