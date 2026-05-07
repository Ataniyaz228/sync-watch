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

function timeAgoDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
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
      <div className="min-h-dvh flex items-center justify-center bg-[var(--color-bg-0)]">
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--color-bg-0)] px-5 py-8 max-w-lg mx-auto">
      <div className="bg-noise" />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <button onClick={() => router.push('/')}
          className="flex items-center gap-2 text-xs text-[var(--color-text-4)] hover:text-[var(--color-text-2)] transition-colors mb-5">
          <IconArrowRight size={12} className="rotate-180" />
          На главную
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 surface-raised rounded-xl flex items-center justify-center">
            <IconHistory size={17} className="text-[var(--color-text-3)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-0)] tracking-tight">История просмотра</h1>
            <p className="text-[11px] text-[var(--color-text-4)]">{user?.username}</p>
          </div>
        </div>
      </motion.div>

      {history.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="surface rounded-2xl p-8 text-center">
          <IconFilm size={28} className="text-[var(--color-text-4)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-2)]">Пока ничего не смотрели</p>
          <p className="text-xs text-[var(--color-text-4)] mt-1">Начните смотреть что-нибудь!</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {history.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035 }}
                className="surface rounded-xl p-4 flex items-start gap-3 group cursor-pointer hover:bg-[var(--color-bg-2)] transition-colors"
                onClick={() => router.push(`/room/${item.roomSlug}`)}>
                <div className="w-8 h-8 surface-raised rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <IconPlay size={12} className="text-[var(--color-text-3)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-text-0)] font-medium truncate leading-snug">
                    {item.title || item.url}
                  </p>
                  {item.title && (
                    <p className="text-[10px] text-[var(--color-text-4)] font-mono truncate mt-0.5">{item.url}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded surface-raised text-[var(--color-text-4)] uppercase tracking-wider">
                      {TYPE_LABELS[item.videoType] || item.videoType}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-4)]">{item.roomName}</span>
                    <span className="text-[10px] text-[var(--color-text-4)] ml-auto">{timeAgoDate(item.createdAt)}</span>
                  </div>
                </div>
                <IconArrowRight size={13} className="text-[var(--color-text-4)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
