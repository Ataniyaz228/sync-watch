'use client';

import { useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '@/lib/utils';
import type { VideoPlayerAPI } from './useVideoSync';

interface UseWatchProgressOptions {
  roomSlug: string;
  videoUrl: string | null;
  getPlayer: () => VideoPlayerAPI | null;
  isHost: boolean;
  enabled: boolean;
}

const SAVE_INTERVAL_MS = 10_000; // save every 10s
const RESTORE_THRESHOLD_S = 10;  // don't restore if < 10s (beginning)

export function useWatchProgress({ roomSlug, videoUrl, getPlayer, isHost, enabled }: UseWatchProgressOptions) {
  const savedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Restore position when video URL loads
  useEffect(() => {
    if (!enabled || !videoUrl || !isHost) return;
    savedRef.current = false;

    const restore = async () => {
      try {
        const progress = await apiRequest<{ timestampS: number; url?: string }>(
          `/api/rooms/${roomSlug}/progress?url=${encodeURIComponent(videoUrl)}`
        );
        if (progress.timestampS > RESTORE_THRESHOLD_S) {
          // Wait for player to be ready
          let attempts = 0;
          const trySeek = () => {
            const player = getPlayer();
            if (player) {
              player.seek(progress.timestampS);
            } else if (attempts++ < 20) {
              setTimeout(trySeek, 500);
            }
          };
          setTimeout(trySeek, 1500);
        }
      } catch { /* no progress saved yet */ }
    };

    restore();
  }, [videoUrl, roomSlug, enabled, isHost, getPlayer]);

  // Save position periodically (host only)
  useEffect(() => {
    if (!enabled || !videoUrl || !isHost) return;

    const save = async () => {
      const player = getPlayer();
      if (!player) return;
      const t = player.getCurrentTime();
      if (t < 1) return; // don't save if at start

      try {
        await apiRequest(`/api/rooms/${roomSlug}/progress`, {
          method: 'POST',
          body: JSON.stringify({
            url: videoUrl,
            timestampS: t,
            isPlaying: player.isPlaying(),
          }),
        });
      } catch { /* ignore */ }
    };

    intervalRef.current = setInterval(save, SAVE_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [videoUrl, roomSlug, enabled, isHost, getPlayer]);

  // Save on page unload
  const saveNow = useCallback(async () => {
    if (!videoUrl || !isHost) return;
    const player = getPlayer();
    if (!player) return;
    const t = player.getCurrentTime();
    if (t < 1) return;
    try {
      await apiRequest(`/api/rooms/${roomSlug}/progress`, {
        method: 'POST',
        body: JSON.stringify({ url: videoUrl, timestampS: t, isPlaying: false }),
      });
    } catch { /* */ }
  }, [videoUrl, roomSlug, isHost, getPlayer]);

  useEffect(() => {
    window.addEventListener('beforeunload', saveNow);
    return () => window.removeEventListener('beforeunload', saveNow);
  }, [saveNow]);
}
