'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '@/types';
import { generateAvatarColor } from '@/lib/utils';

interface FSNotif {
  id: string;
  username: string;
  content: string;
  color: string;
  isGif: boolean;
}

interface Props {
  messages: ChatMessage[];
  isFullscreen: boolean;
}

function isGifUrl(content: string) {
  return /^https?:\/\/.*\.gif(\?.*)?$/i.test(content) ||
    content.includes('media.giphy.com') ||
    content.includes('tenor.googleapis.com') ||
    content.includes('media.tenor.com');
}

export default function FullscreenNotifications({ messages, isFullscreen }: Props) {
  const [notifs, setNotifs] = useState<FSNotif[]>([]);
  const prevCountRef = useRef(messages.length);

  // When fullscreen is activated, reset the prev count to current
  useEffect(() => {
    if (isFullscreen) {
      prevCountRef.current = messages.length;
    }
  }, [isFullscreen, messages.length]);

  // Watch for new messages and add notifications
  useEffect(() => {
    if (!isFullscreen) return;

    const prev = prevCountRef.current;
    if (messages.length <= prev) {
      prevCountRef.current = messages.length;
      return;
    }

    const newMsgs = messages.slice(prev);
    prevCountRef.current = messages.length;

    const newNotifs: FSNotif[] = newMsgs
      .filter(m => !m.isSystem && m.type !== 'system')
      .map(m => ({
        id: m.id + '_' + Date.now() + Math.random(),
        username: m.username,
        content: isGifUrl(m.content) ? '🖼 GIF' : (m.content.length > 70 ? m.content.slice(0, 67) + '…' : m.content),
        color: generateAvatarColor(m.username),
        isGif: isGifUrl(m.content),
      }));

    if (newNotifs.length === 0) return;

    setNotifs(prev => [...prev, ...newNotifs].slice(-5));

    // Auto-remove each notification after 4s
    newNotifs.forEach(n => {
      setTimeout(() => {
        setNotifs(prev => prev.filter(x => x.id !== n.id));
      }, 4000);
    });
  }, [messages, isFullscreen]);

  // Clear notifications when exiting fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setNotifs([]);
    }
  }, [isFullscreen]);

  if (!isFullscreen) return null;

  return (
    <div
      className="absolute bottom-20 left-4 z-50 pointer-events-none flex flex-col gap-2"
      style={{ maxWidth: 280 }}
    >
      <AnimatePresence mode="popLayout">
        {notifs.map(n => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: -16, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.92 }}
            transition={{ duration: 0.22, type: 'spring', bounce: 0.25 }}
            style={{
              background: 'rgba(8,8,8,0.82)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '9px 13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: n.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#0a0a0b',
              marginTop: 1,
            }}>
              {n.username[0].toUpperCase()}
            </div>

            {/* Text */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#A8B8C4', marginBottom: 2, letterSpacing: 0.1 }}>
                {n.username}
              </div>
              <div style={{ fontSize: 12, color: '#efefef', lineHeight: 1.4 }}>
                {n.content}
              </div>
            </div>

            {/* Progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4, ease: 'linear' }}
              style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: 2,
                background: 'rgba(168,184,196,0.4)',
                borderRadius: '0 0 12px 12px',
                transformOrigin: 'left',
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
