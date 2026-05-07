'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { ServerToClientEvents } from '@/types';

interface UseVideoSyncOptions {
  on: <E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) => () => void;
  emit: (event: string, data: unknown) => void;
  roomSlug: string;
  getPlayer: () => VideoPlayerAPI | null;
}

// Common interface for all player types
export interface VideoPlayerAPI {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
}

const SYNC_THRESHOLD = 0.5; // seconds

export function useVideoSync({ on, emit, roomSlug, getPlayer }: UseVideoSyncOptions) {
  const isSyncingRef = useRef(false);

  // Receive play from remote
  useEffect(() => {
    const unsub = on('video:play', (data) => {
      const player = getPlayer();
      if (!player) return;

      isSyncingRef.current = true;

      // Correct drift
      const diff = Math.abs(player.getCurrentTime() - data.currentTime);
      if (diff > SYNC_THRESHOLD) {
        player.seek(data.currentTime);
      }

      player.play();

      setTimeout(() => { isSyncingRef.current = false; }, 100);
    });
    return unsub;
  }, [on, getPlayer]);

  // Receive pause from remote
  useEffect(() => {
    const unsub = on('video:pause', (data) => {
      const player = getPlayer();
      if (!player) return;

      isSyncingRef.current = true;

      const diff = Math.abs(player.getCurrentTime() - data.currentTime);
      if (diff > SYNC_THRESHOLD) {
        player.seek(data.currentTime);
      }

      player.pause();

      setTimeout(() => { isSyncingRef.current = false; }, 100);
    });
    return unsub;
  }, [on, getPlayer]);

  // Receive seek from remote
  useEffect(() => {
    const unsub = on('video:seek', (data) => {
      const player = getPlayer();
      if (!player) return;

      isSyncingRef.current = true;
      player.seek(data.currentTime);
      setTimeout(() => { isSyncingRef.current = false; }, 100);
    });
    return unsub;
  }, [on, getPlayer]);

  // Local events to emit
  const onLocalPlay = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    emit('video:play', { roomSlug, currentTime });
  }, [emit, roomSlug]);

  const onLocalPause = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    emit('video:pause', { roomSlug, currentTime });
  }, [emit, roomSlug]);

  const onLocalSeek = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    emit('video:seek', { roomSlug, currentTime });
  }, [emit, roomSlug]);

  return {
    isSyncing: isSyncingRef,
    onLocalPlay,
    onLocalPause,
    onLocalSeek,
  };
}
