'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/utils';
import { IconPlay, IconFilm, IconArrowRight, IconHistory } from '@/components/ui/Icons';

interface HistoryItem {
  id: string;
  url: string;
  resolvedUrl?: string;
  videoType: string;
  title?: string;
  createdAt: string;
  roomSlug: string;
  roomName: string;
}

const TYPE_LABELS: Record<string, string> = {
  youtube: 'YouTube', hls: 'HLS', mp4: 'MP4', iframe: 'Embed',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<HistoryItem[]>(`/api/rooms/user/${user.id}/history`)
      .then(h => setHistory([...h].reverse()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="spinner" style={{ width: 20, height: 20 }} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 sm:px-8 pb-12">
      <div className="bg-noise" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-lg mx-auto w-full pt-8"
      >
        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-[11px] text-[var(--color-text-4)] hover:text-[var(--color-text-2)] transition-colors mb-6"
        >
          <IconArrowRight size={11} className="rotate-180" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 surface-raised rounded-lg flex items-center justify-center">
            <IconHistory size={15} className="text-[var(--color-text-3)]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[var(--color-text-0)] tracking-[-0.02em]">
              Watch history
            </h1>
            <p className="text-[10px] text-[var(--color-text-4)]">{user?.username}</p>
          </div>
        </div>

        {/* List */}
        {history.length === 0 ? (
          <div className="surface rounded-xl p-8 text-center">
            <IconFilm size={24} className="text-[var(--color-text-4)] mx-auto mb-3" />
            <p className="text-[13px] text-[var(--color-text-2)]">Nothing watched yet</p>
            <p className="text-[11px] text-[var(--color-text-4)] mt-1">Videos will appear here after you watch something.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence>
              {history.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => router.push(`/room/${item.roomSlug}`)}
                  className="w-full text-left surface rounded-xl p-4 flex items-start gap-3 hover:bg-[var(--color-bg-2)] transition-colors cursor-pointer border-none"
                >
                  <div className="w-7 h-7 surface-raised rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <IconPlay size={11} className="text-[var(--color-text-3)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[var(--color-text-0)] font-medium truncate leading-snug">
                      {item.title || item.url}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded surface-raised text-[var(--color-text-4)] uppercase tracking-[0.05em]">
                        {TYPE_LABELS[item.videoType] || item.videoType}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-4)]">{item.roomName}</span>
                      <span className="text-[10px] text-[var(--color-text-4)] ml-auto">{timeAgo(item.createdAt)}</span>
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
