'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import type { ServerToClientEvents, RequestAction } from '@/types';

interface UseVideoSyncOptions {
  on: <E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) => () => void;
  emit: (event: string, data: unknown) => void;
  roomSlug: string;
  getPlayer: () => VideoPlayerAPI | null;
  isHost: boolean;
}

export interface VideoPlayerAPI {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
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

const SYNC_THRESHOLD = 1.5;
const SYNC_DEBOUNCE = 300;

export function useVideoSync({ on, emit, roomSlug, getPlayer, isHost }: UseVideoSyncOptions) {
  const isSyncingRef = useRef(false);
  const [pauseRequest, setPauseRequest] = useState<PauseRequest | null>(null);
  const [videoRequest, setVideoRequest] = useState<VideoRequest | null>(null);

  const setSyncing = (v: boolean) => { isSyncingRef.current = v; };

  // Receive PLAY
  useEffect(() => {
    const unsub = on('video:play', (data) => {
      const player = getPlayer();
      if (!player) return;
      setSyncing(true);
      const diff = Math.abs(player.getCurrentTime() - data.currentTime);
      if (diff > SYNC_THRESHOLD) player.seek(data.currentTime);
      player.play();
      setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
    });
    return unsub;
  }, [on, getPlayer]);

  // Receive PAUSE
  useEffect(() => {
    const unsub = on('video:pause', (data) => {
      const player = getPlayer();
      if (!player) return;
      setSyncing(true);
      const diff = Math.abs(player.getCurrentTime() - data.currentTime);
      if (diff > SYNC_THRESHOLD) player.seek(data.currentTime);
      player.pause();
      setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
    });
    return unsub;
  }, [on, getPlayer]);

  // Receive SEEK
  useEffect(() => {
    const unsub = on('video:seek', (data) => {
      const player = getPlayer();
      if (!player) return;
      setSyncing(true);
      player.seek(data.currentTime);
      setTimeout(() => { isSyncingRef.current = false; }, SYNC_DEBOUNCE);
    });
    return unsub;
  }, [on, getPlayer]);

  // Host receives pause request from viewer
  useEffect(() => {
    const unsub = on('video:pause-request', (data) => {
      if (isHost) setPauseRequest(data);
    });
    return unsub;
  }, [on, isHost]);

  // Host receives unified request from viewer
  useEffect(() => {
    const unsub = on('video:request', (data) => {
      if (isHost) setVideoRequest(data);
    });
    return unsub;
  }, [on, isHost]);

  // Viewer receives rejection
  useEffect(() => {
    const unsub = on('video:pause-request-rejected', () => {});
    return unsub;
  }, [on]);

  useEffect(() => {
    const unsub = on('video:request-rejected', () => {});
    return unsub;
  }, [on]);

  // Host: accept pause request
  const acceptPauseRequest = useCallback(() => {
    emit('video:pause-request-accept', { roomSlug });
    setPauseRequest(null);
  }, [emit, roomSlug]);

  // Host: reject pause request
  const rejectPauseRequest = useCallback(() => {
    emit('video:pause-request-reject', { roomSlug });
    setPauseRequest(null);
  }, [emit, roomSlug]);

  // Host: accept video request
  const acceptVideoRequest = useCallback(() => {
    if (!videoRequest) return;
    emit('video:request-accept', { roomSlug, action: videoRequest.action, currentTime: videoRequest.currentTime });
    setVideoRequest(null);
  }, [emit, roomSlug, videoRequest]);

  // Host: reject video request
  const rejectVideoRequest = useCallback(() => {
    if (!videoRequest) return;
    emit('video:request-reject', { roomSlug, action: videoRequest.action });
    setVideoRequest(null);
  }, [emit, roomSlug, videoRequest]);

  // Local PLAY
  const onLocalPlay = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    if (isHost) {
      emit('video:play', { roomSlug, currentTime });
    } else {
      emit('video:request', { roomSlug, action: 'play' as RequestAction, currentTime });
    }
  }, [emit, roomSlug, isHost]);

  // Local PAUSE — host emits directly, viewer sends a request
  const onLocalPause = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    if (isHost) {
      emit('video:pause', { roomSlug, currentTime });
    } else {
      emit('video:pause-request', { roomSlug, currentTime });
    }
  }, [emit, roomSlug, isHost]);

  // Local SEEK
  const onLocalSeek = useCallback((currentTime: number) => {
    if (isSyncingRef.current) return;
    if (isHost) {
      emit('video:seek', { roomSlug, currentTime });
    } else {
      emit('video:request', { roomSlug, action: 'seek' as RequestAction, currentTime });
    }
  }, [emit, roomSlug, isHost]);

  return {
    onLocalPlay, onLocalPause, onLocalSeek,
    pauseRequest, acceptPauseRequest, rejectPauseRequest,
    videoRequest, acceptVideoRequest, rejectVideoRequest,
  };
}
