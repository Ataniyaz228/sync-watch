'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types';

export function useSocket(roomSlug: string, username: string, userId: string) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const isConnected = useRef(false);

  useEffect(() => {
    if (!roomSlug || !username || !userId) return;

    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    socket.on('connect', () => {
      isConnected.current = true;
      socket.emit('room:join', { roomSlug, username, userId });
    });

    // If already connected (reconnect scenario)
    if (socket.connected && !isConnected.current) {
      isConnected.current = true;
      socket.emit('room:join', { roomSlug, username, userId });
    }

    socket.on('disconnect', () => {
      isConnected.current = false;
    });

    return () => {
      if (socket.connected) {
        socket.emit('room:leave', { roomSlug });
      }
      disconnectSocket();
      isConnected.current = false;
    };
  }, [roomSlug, username, userId]);

  const emit = useCallback(<E extends keyof ClientToServerEvents>(
    event: E,
    data: Parameters<ClientToServerEvents[E]>[0]
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socketRef.current as any)?.emit(event, data);
  }, []);

  const on = useCallback(<E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E]
  ) => {
    socketRef.current?.on(event, handler as never);
    return () => {
      socketRef.current?.off(event, handler as never);
    };
  }, []);

  return { socket: socketRef, emit, on };
}
