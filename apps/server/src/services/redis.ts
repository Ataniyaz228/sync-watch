import Redis from 'ioredis';
import type { RoomState } from '../types/index.js';

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!REDIS_URL) {
    return null;
  }

  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected to Redis Cloud');
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redis.connect().catch((err) => {
      console.warn('[Redis] Failed to connect:', err.message);
      redis = null;
    });
  }

  return redis;
}

// In-memory fallback when Redis is not available
const memoryStore = new Map<string, string>();

export async function cacheVideoResolution(url: string, result: string): Promise<void> {
  const r = getRedis();
  const key = `video:${url}`;

  if (r) {
    try {
      await r.set(key, result, 'EX', 3600); // 1 hour TTL
    } catch {
      memoryStore.set(key, result);
    }
  } else {
    memoryStore.set(key, result);
    setTimeout(() => memoryStore.delete(key), 3600 * 1000);
  }
}

export async function getCachedVideoResolution(url: string): Promise<string | null> {
  const r = getRedis();
  const key = `video:${url}`;

  if (r) {
    try {
      return await r.get(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }

  return memoryStore.get(key) ?? null;
}

export async function setRoomState(roomSlug: string, state: RoomState): Promise<void> {
  const r = getRedis();
  const key = `room:${roomSlug}:state`;
  const value = JSON.stringify(state);

  if (r) {
    try {
      await r.set(key, value, 'EX', 86400); // 24 hours TTL
    } catch {
      memoryStore.set(key, value);
    }
  } else {
    memoryStore.set(key, value);
  }
}

export async function getRoomState(roomSlug: string): Promise<RoomState | null> {
  const r = getRedis();
  const key = `room:${roomSlug}:state`;

  let raw: string | null;
  if (r) {
    try {
      raw = await r.get(key);
    } catch {
      raw = memoryStore.get(key) ?? null;
    }
  } else {
    raw = memoryStore.get(key) ?? null;
  }

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Track online users per room (in-memory — fast, no need for Redis)
const roomUsers = new Map<string, Map<string, string>>(); // roomSlug -> Map<socketId, username>

export function addUserToRoom(roomSlug: string, socketId: string, username: string): number {
  if (!roomUsers.has(roomSlug)) {
    roomUsers.set(roomSlug, new Map());
  }
  roomUsers.get(roomSlug)!.set(socketId, username);
  return roomUsers.get(roomSlug)!.size;
}

export function removeUserFromRoom(roomSlug: string, socketId: string): { username: string | undefined; count: number } {
  const users = roomUsers.get(roomSlug);
  if (!users) return { username: undefined, count: 0 };

  const username = users.get(socketId);
  users.delete(socketId);

  if (users.size === 0) {
    roomUsers.delete(roomSlug);
  }

  return { username, count: users.size };
}

export function getRoomUsers(roomSlug: string): string[] {
  const users = roomUsers.get(roomSlug);
  if (!users) return [];
  return Array.from(users.values());
}

export function getUserRoomBySocket(socketId: string): string | undefined {
  for (const [roomSlug, users] of roomUsers.entries()) {
    if (users.has(socketId)) return roomSlug;
  }
  return undefined;
}

export function getUsernameBySocket(roomSlug: string, socketId: string): string | undefined {
  return roomUsers.get(roomSlug)?.get(socketId);
}
