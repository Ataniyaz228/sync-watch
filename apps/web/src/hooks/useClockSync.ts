'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ServerToClientEvents } from '@/types';

interface UseClockSyncOptions {
  on: <E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) => () => void;
  emit: (event: string, data: unknown) => void;
}

/**
 * NTP-like clock synchronization with the server.
 * Computes offset = serverTime - clientTime, so:
 *   serverNow() = Date.now() + offset
 *
 * Handshake every 30s to stay accurate over long sessions.
 */
export function useClockSync({ on, emit }: UseClockSyncOptions) {
  const offsetRef = useRef(0);
  const rttRef = useRef(0);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  const getRTT = useCallback(() => rttRef.current, []);

  const doSync = useCallback(() => {
    emit('time:ping', { t1: Date.now() });
  }, [emit]);

  useEffect(() => {
    const unsub = on('time:pong', (data: { t1: number; t2: number }) => {
      const t3 = Date.now();
      const rtt = t3 - data.t1;
      const offset = data.t2 - (data.t1 + rtt / 2);
      offsetRef.current = offset;
      rttRef.current = rtt;

      // Report our RTT back so server can compute executeAt for guests
      emit('time:ping', { t1: Date.now(), rtt });
    });

    // Initial sync immediately, then every 30s
    doSync();
    const interval = setInterval(doSync, 30_000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [on, emit, doSync]);

  return { serverNow, getRTT, offsetRef, rttRef };
}
