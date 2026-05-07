'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/utils';
import type { WatchHistoryItem } from '@/types';
import { IconPlay, IconFilm, IconArrowRight, IconHistory } from '@/components/ui/Icons';

function timeAgoDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  hls: 'HLS Stream',
  mp4: 'MP4',
  iframe: 'Embed',
};

function FloatingOrbs() {
  return (
    <div className="orbs-container">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  );
}

function GridBackground() {
  return (
    <div className="grid-bg">
      <div className="grid-lines" />
      <div className="grid-fade" />
    </div>
  );
}

export default function RoomHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const slug = params.slug as string;
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      apiRequest<{ name: string }>(`/api/rooms/${slug}`),
      apiRequest<WatchHistoryItem[]>(`/api/rooms/${slug}/history`),
    ]).then(([room, hist]) => {
      setRoomName(room.name);
      setHistory(hist.reverse()); // newest first
    }).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  if (authLoading || loading) {
    return (
      <div className="landing-loader">
        <div className="loader-ring">
          <div className="loader-ring-inner" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 sm:px-8 pb-16 relative overflow-hidden">
      <FloatingOrbs />
      <GridBackground />
      <div className="bg-noise" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl mx-auto w-full pt-12 sm:pt-20 relative z-10"
      >
        {/* Back Button */}
        <button
          onClick={() => router.push(`/room/${slug}`)}
          className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-4)] hover:text-[var(--color-text-0)] transition-colors mb-8 sm:mb-10 group bg-transparent border-none cursor-pointer"
        >
          <IconArrowRight size={13} className="rotate-180 transform group-hover:-translate-x-1 transition-transform" />
          <span>Back to Room</span>
        </button>

        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8 sm:mb-12">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)] to-[#c4885a] shadow-[0_0_24px_rgba(212,160,106,0.3)]">
            <IconHistory size={24} className="text-[var(--color-bg-0)]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-0)] tracking-tight leading-tight">
              Room History
            </h1>
            <p className="text-[14px] text-[var(--color-text-3)] mt-1">
              History for <span className="text-[var(--color-text-1)] font-medium">{roomName}</span>
            </p>
          </div>
        </div>

        {/* History List */}
        {history.length === 0 ? (
          <div className="auth-card text-center p-10 sm:p-14 border border-[var(--color-border)] border-dashed">
            <div className="w-16 h-16 rounded-2xl surface flex items-center justify-center mx-auto mb-5 border border-[var(--color-border)] shadow-lg">
              <IconFilm size={32} className="text-[var(--color-text-4)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-2">No videos watched yet</h2>
            <p className="text-[14px] text-[var(--color-text-4)]">Start watching something in the room!</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <AnimatePresence>
              {history.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  onClick={() => router.push(`/room/${slug}`)}
                  className="w-full text-left auth-card p-5 sm:p-6 flex items-start sm:items-center gap-4 sm:gap-6 hover:border-[var(--color-border-hover)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-lg surface-raised flex items-center justify-center flex-shrink-0 border border-[var(--color-border)] group-hover:border-[var(--color-accent-muted)] group-hover:bg-[var(--color-accent-dim)] transition-colors mt-1 sm:mt-0">
                    <IconPlay size={16} className="text-[var(--color-text-3)] group-hover:text-[var(--color-accent)] transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] sm:text-[16px] text-[var(--color-text-0)] font-semibold truncate leading-snug mb-1 group-hover:text-[var(--color-accent)] transition-colors">
                      {item.title || item.url}
                    </h3>
                    {item.title && (
                      <p className="text-[11px] text-[var(--color-text-4)] font-mono truncate mb-2">{item.url}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                      <span className="text-[11px] font-semibold px-2 py-1 rounded bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-text-2)] uppercase tracking-wider">
                        {TYPE_LABELS[item.videoType] || item.videoType}
                      </span>
                      <span className="text-[13px] text-[var(--color-text-4)] ml-auto font-medium">
                        {timeAgoDate(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
