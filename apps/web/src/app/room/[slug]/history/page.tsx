'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/utils';
import type { WatchHistoryItem } from '@/types';
import { IconPlay, IconFilm, IconArrowRight } from '@/components/ui/Icons';

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

export default function HistoryPage() {
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
      <div className="min-h-dvh flex items-center justify-center">
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <main className="min-h-dvh px-5 py-10 max-w-xl mx-auto">
      <div className="bg-noise" />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <button onClick={() => router.push(`/room/${slug}`)}
          className="flex items-center gap-2 text-xs text-[var(--color-text-4)] hover:text-[var(--color-text-2)] transition-colors mb-4">
          <IconArrowRight size={12} className="rotate-180" />
          Back to room
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 surface-raised rounded-lg flex items-center justify-center">
            <IconFilm size={16} className="text-[var(--color-text-3)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-0)] tracking-tight">Watch History</h1>
            <p className="text-[11px] text-[var(--color-text-4)] font-mono">{roomName}</p>
          </div>
        </div>
      </motion.div>

      {/* List */}
      {history.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="surface rounded-xl p-8 text-center">
          <IconFilm size={28} className="text-[var(--color-text-4)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-3)]">No videos watched yet</p>
          <p className="text-xs text-[var(--color-text-4)] mt-1">Start watching something!</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {history.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="surface rounded-xl p-4 flex items-start gap-3 group cursor-pointer hover:bg-[var(--color-bg-2)] transition-colors"
                onClick={() => router.push(`/room/${slug}`)}>
                <div className="w-8 h-8 surface-raised rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                  <IconPlay size={13} className="text-[var(--color-text-3)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-text-1)] font-medium truncate leading-snug">
                    {item.title || item.url}
                  </p>
                  {item.title && (
                    <p className="text-[10px] text-[var(--color-text-4)] font-mono truncate mt-0.5">{item.url}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded surface-raised text-[var(--color-text-4)] uppercase tracking-wider">
                      {TYPE_LABELS[item.videoType] || item.videoType}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-4)]">{timeAgoDate(item.createdAt)}</span>
                  </div>
                </div>
                <IconArrowRight size={14} className="text-[var(--color-text-4)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
