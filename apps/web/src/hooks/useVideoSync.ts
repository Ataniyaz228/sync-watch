'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import type { ServerToClientEvents, RequestAction } from '@/types';

interface UseVideoSyncOptions {
  on: <E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) => () => void;
  emit: (event: string, data: unknown) => void;
  roomSlug: string;
  getPlayer: () => VideoPlayerAPI | null;
  isHost: boolean;
  serverNow: () => number;
}

export interface VideoPlayerAPI {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  setPlaybackRate: (rate: number) => void;
}

export interface PauseRequest {
  username: string;
  currentTime: number;
}

export interface VideoRequest {
  username: string;
  action: RequestAction;
  currentTime?: number;
}

export type SyncStatus = 'synced' | 'correcting' | 'seeking';

// Drift thresholds
const DRIFT_IGNORE  = 0.15;  // < 150ms → do nothing
const DRIFT_RATE    = 2.0;   // 150ms–2s → adjust playbackRate
const SYNC_DEBOUNCE = 350;

export function useVideoSync({ on, emit, roomSlug, getPlayer, isHost, serverNow }: UseVideoSyncOptions) {
  const isSyncingRef = useRef(false);
  const driftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pauseRequest, setPauseRequest] = useState<PauseRequest | null>(null);
  const [videoRequest, setVideoRequest] = useState<VideoRequest | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [controlMode, setControlMode] = useState<'free' | 'cinema'>('cinema');

  const setSyncing = (v: boolean) => { isSyncingRef.current = v; };

  /** Schedule an action at a specific server timestamp */
  const scheduleAt = useCallback((executeAt: number | undefined, action: () => void) => {
    if (!executeAt) { action(); return; }
    const delay = executeAt - serverNow();
    if (delay <= 20) { action(); return; }
    setTimeout(action, delay);
  }, [serverNow]);

  // ── Receive PLAY ──
  useEffect(() => {
    const unsub = on('video:play', (data) => {
      const player = getPlayer();
      if (!player) return;
      setSyncing(true);
      scheduleAt(data.executeAt, () => {
        const diff = Math.abs(player.getCurrentTime() - data.currentTime);
        if (diff > 1.5) player.seek(data.currentTime);
        player.setPlaybackRate(1.0);
        player.play();
        setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
      });
    });
    return unsub;
  }, [on, getPlayer, scheduleAt]);

  // ── Receive PAUSE ──
  useEffect(() => {
    const unsub = on('video:pause', (data) => {
      const player = getPlayer();
      if (!player) return;
      setSyncing(true);
      scheduleAt(data.executeAt, () => {
        const diff = Math.abs(player.getCurrentTime() - data.currentTime);
        if (diff > 1.5) player.seek(data.currentTime);
        player.setPlaybackRate(1.0);
        player.pause();
        setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
      });
    });
    return unsub;
  }, [on, getPlayer, scheduleAt]);

  // ── Receive SEEK ──
  useEffect(() => {
    const unsub = on('video:seek', (data) => {
      const player = getPlayer();
      if (!player) return;
      setSyncing(true);
      scheduleAt(data.executeAt, () => {
        player.seek(data.currentTime);
        player.setPlaybackRate(1.0);
        setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
      });
    });
    return unsub;
  }, [on, getPlayer, scheduleAt]);

  // ── Control mode changes ──
  useEffect(() => {
    const unsub = on('room:mode-changed', (data) => {
      setControlMode(data.mode);
    });
    return unsub;
  }, [on]);

  // ── Guest: heartbeat-based drift correction (3 levels) ──
  useEffect(() => {
    if (isHost) return;

    const unsub = on('video:heartbeat', (data) => {
      const player = getPlayer();
      if (!player || isSyncingRef.current || !player.isPlaying()) return;

      // Expected position accounting for network delay
      const expectedPos = data.position + (serverNow() - data.serverTs) / 1000;
      const drift = expectedPos - player.getCurrentTime();
      const absDrift = Math.abs(drift);

      if (driftTimerRef.current) clearTimeout(driftTimerRef.current);

      if (absDrift < DRIFT_IGNORE) {
        player.setPlaybackRate(1.0);
        setSyncStatus('synced');
      } else if (absDrift < DRIFT_RATE) {
        // Nudge rate: +6% or -6% — barely noticeable, corrects ~0.6s per 10s
        player.setPlaybackRate(drift > 0 ? 1.06 : 0.94);
        setSyncStatus('correcting');
        // Auto-restore if never converges
        driftTimerRef.current = setTimeout(() => {
          player.setPlaybackRate(1.0);
          setSyncStatus('synced');
        }, 15_000);
      } else {
        // Large drift: hard seek
        setSyncing(true);
        player.seek(expectedPos);
        player.setPlaybackRate(1.0);
        setSyncStatus('seeking');
        setTimeout(() => {
          isSyncingRef.current = false;
          setSyncStatus('synced');
        }, SYNC_DEBOUNCE);
      }
    });
    return () => { unsub(); if (driftTimerRef.current) clearTimeout(driftTimerRef.current); };
  }, [on, getPlayer, isHost, serverNow]);

  // ── Legacy sync-correction (play/pause state alignment) ──
  useEffect(() => {
    if (isHost) return;
    const unsub = on('video:sync-correction', (data) => {
      const player = getPlayer();
      if (!player) return;

      const expectedPos = data.currentTime + (serverNow() - data.serverTs) / 1000;
      const drift = Math.abs(player.getCurrentTime() - expectedPos);
      if (drift > DRIFT_RATE) {
        setSyncing(true);
        player.seek(expectedPos);
        player.setPlaybackRate(1.0);
        setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
      }

      const localPlaying = player.isPlaying();
      if (data.isPlaying && !localPlaying) {
        setSyncing(true);
        player.setPlaybackRate(1.0);
        player.play();
        setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
      } else if (!data.isPlaying && localPlaying) {
        setSyncing(true);
        player.pause();
        setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
      }
    });
    return unsub;
  }, [on, getPlayer, isHost, serverNow]);

  // ── Pause request from viewer ──
  useEffect(() => {
    const unsub = on('video:pause-request', (data) => {
      if (isHost) setPauseRequest(data);
    });
    return unsub;
  }, [on, isHost]);

  // ── Unified request from viewer ──
  useEffect(() => {
    const unsub = on('video:request', (data) => {
      if (isHost) setVideoRequest(data);
    });
    return unsub;
  }, [on, isHost]);

  useEffect(() => { const u = on('video:pause-request-rejected', () => {}); return u; }, [on]);
  useEffect(() => { const u = on('video:request-rejected', () => {}); return u; }, [on]);

  const acceptPauseRequest = useCallback(() => {
    emit('video:pause-request-accept', { roomSlug });
    setPauseRequest(null);
  }, [emit, roomSlug]);

  const rejectPauseRequest = useCallback(() => {
    emit('video:pause-request-reject', { roomSlug });
    setPauseRequest(null);
  }, [emit, roomSlug]);

  const acceptVideoRequest = useCallback(() => {
    if (!videoRequest) return;
    emit('video:request-accept', { roomSlug, action: videoRequest.action, currentTime: videoRequest.currentTime });
    setVideoRequest(null);
  }, [emit, roomSlug, videoRequest]);

  const rejectVideoRequest = useCallback(() => {
    if (!videoRequest) return;
    emit('video:request-reject', { roomSlug, action: videoRequest.action });
    setVideoRequest(null);
  }, [emit, roomSlug, videoRequest]);

  // ── Local actions — route by controlMode ──
  const onLocalPlay = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    if (isHost || controlMode === 'free') {
      emit('video:play', { roomSlug, currentTime });
    } else {
      emit('video:request', { roomSlug, action: 'play' as RequestAction, currentTime });
    }
  }, [emit, roomSlug, isHost, controlMode]);

  const onLocalPause = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    if (isHost || controlMode === 'free') {
      emit('video:pause', { roomSlug, currentTime });
    } else {
      emit('video:pause-request', { roomSlug, currentTime });
    }
  }, [emit, roomSlug, isHost, controlMode]);

  const onLocalSeek = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    if (isHost || controlMode === 'free') {
      emit('video:seek', { roomSlug, currentTime });
    } else {
      emit('video:request', { roomSlug, action: 'seek' as RequestAction, currentTime });
    }
  }, [emit, roomSlug, isHost, controlMode]);

  const setMode = useCallback((mode: 'free' | 'cinema') => {
    if (!isHost) return;
    emit('room:set-mode', { roomSlug, mode });
    setControlMode(mode);
  }, [emit, roomSlug, isHost]);

  return {
    onLocalPlay, onLocalPause, onLocalSeek,
    pauseRequest, acceptPauseRequest, rejectPauseRequest,
    videoRequest, acceptVideoRequest, rejectVideoRequest,
    syncStatus, controlMode, setMode,
  };
}
