import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, ChatMessage, QueueItem } from '../types/index.js';
import {
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  getUserRoomBySocket,
  getUsernameBySocket,
  getRoomState,
  setRoomState,
} from '../services/redis.js';
import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// In-memory queue per room
const roomQueues = new Map<string, QueueItem[]>();
function getQueue(roomSlug: string): QueueItem[] {
  if (!roomQueues.has(roomSlug)) roomQueues.set(roomSlug, []);
  return roomQueues.get(roomSlug)!;
}

export function setupRoomHandler(io: TypedIO, socket: TypedSocket) {
  socket.on('room:join', async (data) => {
    const { roomSlug, username, userId } = data;

    // Store user info on socket
    (socket.data as Record<string, string>).username = username;
    (socket.data as Record<string, string>).userId = userId;
    (socket.data as Record<string, string>).roomSlug = roomSlug;

    // Join Socket.io room
    socket.join(roomSlug);

    // Track user
    const usersCount = addUserToRoom(roomSlug, socket.id, username);
    const users = getRoomUsers(roomSlug);

    // Notify room
    io.to(roomSlug).emit('room:user-joined', {
      userId,
      username,
      usersCount,
      users,
    });

    // Send system message
    const systemMsg: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: roomSlug,
      userId: 'system',
      username: 'System',
      content: `${username} joined the room`,
      type: 'system',
      reactions: [],
      createdAt: new Date().toISOString(),
      isSystem: true,
    };
    io.to(roomSlug).emit('chat:message', systemMsg);

    // Send current room state to the new user
    const state = await getRoomState(roomSlug);
    if (state) {
      socket.emit('video:sync-state', state);
    }

    // Send queue state
    socket.emit('queue:state', getQueue(roomSlug));

    console.log(`[Room] ${username} joined ${roomSlug} (${usersCount} users)`);
  });

  socket.on('room:leave', (data) => {
    const { roomSlug } = data;
    handleLeave(io, socket, roomSlug);
  });

  // Viewer requests pause → notify host
  socket.on('video:pause-request', async (data) => {
    const { roomSlug, currentTime } = data;
    const username = (socket.data as { username?: string }).username || 'Someone';

    // Find host socket (first user in room by socket data, room creator)
    const roomSockets = io.sockets.adapter.rooms.get(roomSlug);
    if (!roomSockets) return;

    // Get room from DB to find createdBy
    const db = getDb();
    if (db) {
      try {
        const room = await db.select().from(schema.rooms).where(eq(schema.rooms.slug, roomSlug)).limit(1);
        if (room.length > 0) {
          const hostUserId = room[0].createdBy;
          for (const sid of roomSockets) {
            const s = io.sockets.sockets.get(sid);
            if (s && (s.data as { userId?: string }).userId === hostUserId) {
              s.emit('video:pause-request', { username, currentTime });
              break;
            }
          }
        }
      } catch (err) {
        console.error('[Room] pause-request DB error:', err);
      }
    }
  });

  // Host accepts pause request → pause room
  socket.on('video:pause-request-accept', async (data) => {
    const { roomSlug } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';
    const state = await getRoomState(roomSlug);
    const currentTime = state?.currentTime ?? 0;

    io.to(roomSlug).emit('video:pause', { currentTime, userId });
    await setRoomState(roomSlug, {
      ...state,
      isPlaying: false,
      currentTime,
      updatedAt: Date.now(),
    });
  });

  // Host rejects pause request → notify viewers
  socket.on('video:pause-request-reject', (data) => {
    const { roomSlug } = data;
    socket.to(roomSlug).emit('video:pause-request-rejected');
  });

  // Viewer suggests a video → notify host
  socket.on('video:url-suggest', async (data) => {
    const { roomSlug, type, resolvedUrl, originalUrl, title } = data;
    const username = (socket.data as { username?: string }).username || 'Someone';

    const roomSockets = io.sockets.adapter.rooms.get(roomSlug);
    if (!roomSockets) return;

    const db = getDb();
    if (db) {
      try {
        const room = await db.select().from(schema.rooms).where(eq(schema.rooms.slug, roomSlug)).limit(1);
        if (room.length > 0) {
          for (const sid of roomSockets) {
            const s = io.sockets.sockets.get(sid);
            if (s && (s.data as { userId?: string }).userId === room[0].createdBy) {
              s.emit('video:url-suggest', { username, url: originalUrl, title, type, resolvedUrl, originalUrl });
              break;
            }
          }
        }
      } catch (err) {
        console.error('[Room] Video suggest error:', err);
      }
    }
  });

  // Host accepts video suggestion → treat as url-change
  socket.on('video:url-suggest-accept', async (data) => {
    const { roomSlug, type, resolvedUrl, originalUrl, title } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    io.to(roomSlug).emit('video:url-changed', { type, resolvedUrl, originalUrl, title, userId });

    const state = await getRoomState(roomSlug);
    await setRoomState(roomSlug, {
      ...state,
      type,
      resolvedUrl,
      url: originalUrl,
      title,
      currentTime: 0,
      isPlaying: false,
      updatedAt: Date.now(),
    });

    // Save to DB
    const db = getDb();
    if (db) {
      try {
        const room = await db.select().from(schema.rooms).where(eq(schema.rooms.slug, roomSlug)).limit(1);
        if (room.length > 0) {
          await db.update(schema.rooms).set({ currentUrl: originalUrl, videoType: type, updatedAt: new Date() }).where(eq(schema.rooms.id, room[0].id));
          await db.insert(schema.watchHistory).values({ roomId: room[0].id, url: originalUrl, videoType: type, resolvedUrl, title, addedBy: userId });
        }
      } catch (err) {
        console.error('[Room] Video suggest accept DB error:', err);
      }
    }
  });

  // Host rejects video suggestion
  socket.on('video:url-suggest-reject', (data) => {
    const { roomSlug } = data;
    socket.to(roomSlug).emit('video:url-suggest-rejected');
  });

  // Video sync events
  socket.on('video:play', async (data) => {
    const { roomSlug, currentTime } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    socket.to(roomSlug).emit('video:play', { currentTime, userId });

    // Update room state
    const state = await getRoomState(roomSlug);
    await setRoomState(roomSlug, {
      ...state,
      currentTime,
      isPlaying: true,
      updatedAt: Date.now(),
    });
  });

  socket.on('video:pause', async (data) => {
    const { roomSlug, currentTime } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    socket.to(roomSlug).emit('video:pause', { currentTime, userId });

    const state = await getRoomState(roomSlug);
    await setRoomState(roomSlug, {
      ...state,
      currentTime,
      isPlaying: false,
      updatedAt: Date.now(),
    });
  });

  socket.on('video:seek', async (data) => {
    const { roomSlug, currentTime } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    socket.to(roomSlug).emit('video:seek', { currentTime, userId });

    const state = await getRoomState(roomSlug);
    await setRoomState(roomSlug, {
      ...state,
      currentTime,
      isPlaying: state?.isPlaying ?? false,
      updatedAt: Date.now(),
    });
  });

  socket.on('video:url-change', async (data) => {
    const { roomSlug, type, resolvedUrl, originalUrl, title } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    // Broadcast to room
    io.to(roomSlug).emit('video:url-changed', {
      type,
      resolvedUrl,
      originalUrl,
      title,
      userId,
    });

    // Update room state
    await setRoomState(roomSlug, {
      currentTime: 0,
      isPlaying: false,
      url: originalUrl,
      type,
      resolvedUrl,
      title,
      updatedAt: Date.now(),
    });

    // Update DB
    const db = getDb();
    if (db) {
      try {
        const room = await db
          .select()
          .from(schema.rooms)
          .where(eq(schema.rooms.slug, roomSlug))
          .limit(1);

        if (room.length > 0) {
          await db
            .update(schema.rooms)
            .set({ currentUrl: originalUrl, videoType: type, updatedAt: new Date() })
            .where(eq(schema.rooms.id, room[0].id));

          await db.insert(schema.watchHistory).values({
            roomId: room[0].id,
            url: originalUrl,
            videoType: type,
            resolvedUrl,
            title,
            addedBy: userId,
          });
        }
      } catch (err) {
        console.error('[Room] Error updating video in DB:', err);
      }
    }
  });

  socket.on('video:sync-request', async (data) => {
    const { roomSlug } = data;
    const state = await getRoomState(roomSlug);
    if (state) {
      socket.emit('video:sync-state', state);
    }
  });

  // ─── Queue handlers ───

  socket.on('queue:add', (data) => {
    const { roomSlug, type, resolvedUrl, originalUrl, title } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';
    const username = (socket.data as { username?: string }).username || 'Someone';

    const item: QueueItem = {
      id: crypto.randomUUID(),
      type, resolvedUrl, originalUrl, title,
      addedBy: userId,
      addedByName: username,
    };

    const queue = getQueue(roomSlug);
    queue.push(item);
    io.to(roomSlug).emit('queue:added', item);
  });

  socket.on('queue:remove', (data) => {
    const { roomSlug, id } = data;
    const queue = getQueue(roomSlug);
    const idx = queue.findIndex(q => q.id === id);
    if (idx !== -1) {
      queue.splice(idx, 1);
      io.to(roomSlug).emit('queue:removed', { id });
    }
  });

  socket.on('queue:play-next', async (data) => {
    const { roomSlug } = data;
    const queue = getQueue(roomSlug);
    if (queue.length === 0) return;

    const next = queue.shift()!;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    // Broadcast url change
    io.to(roomSlug).emit('video:url-changed', {
      type: next.type, resolvedUrl: next.resolvedUrl, originalUrl: next.originalUrl, title: next.title, userId,
    });

    // Update state
    const state = await getRoomState(roomSlug);
    await setRoomState(roomSlug, {
      ...state,
      type: next.type, resolvedUrl: next.resolvedUrl, url: next.originalUrl, title: next.title,
      currentTime: 0, isPlaying: true, updatedAt: Date.now(),
    });

    // Broadcast updated queue
    io.to(roomSlug).emit('queue:state', queue);
  });

  // ─── Unified viewer requests (play/seek) ───

  socket.on('video:request', async (data) => {
    const { roomSlug, action, currentTime } = data;
    const username = (socket.data as { username?: string }).username || 'Someone';

    const roomSockets = io.sockets.adapter.rooms.get(roomSlug);
    if (!roomSockets) return;

    const db = getDb();
    if (db) {
      try {
        const room = await db.select().from(schema.rooms).where(eq(schema.rooms.slug, roomSlug)).limit(1);
        if (room.length > 0) {
          for (const sid of roomSockets) {
            const s = io.sockets.sockets.get(sid);
            if (s && (s.data as { userId?: string }).userId === room[0].createdBy) {
              s.emit('video:request', { username, action, currentTime });
              break;
            }
          }
        }
      } catch (err) {
        console.error('[Room] Video request error:', err);
      }
    }
  });

  socket.on('video:request-accept', async (data) => {
    const { roomSlug, action, currentTime } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    if (action === 'play') {
      const ct = currentTime ?? 0;
      io.to(roomSlug).emit('video:play', { currentTime: ct, userId });
      const state = await getRoomState(roomSlug);
      await setRoomState(roomSlug, { ...state, currentTime: ct, isPlaying: true, updatedAt: Date.now() });
    } else if (action === 'seek' && currentTime !== undefined) {
      io.to(roomSlug).emit('video:seek', { currentTime, userId });
      const state = await getRoomState(roomSlug);
      await setRoomState(roomSlug, { ...state, currentTime, isPlaying: state?.isPlaying ?? false, updatedAt: Date.now() });
    }
  });

  socket.on('video:request-reject', (data) => {
    const { roomSlug, action } = data;
    socket.to(roomSlug).emit('video:request-rejected', { action });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const roomSlug = (socket.data as { roomSlug?: string }).roomSlug;
    if (roomSlug) {
      handleLeave(io, socket, roomSlug);
    }
  });
}

function handleLeave(io: TypedIO, socket: TypedSocket, roomSlug: string) {
  const { username, count } = removeUserFromRoom(roomSlug, socket.id);
  socket.leave(roomSlug);

  if (username) {
    io.to(roomSlug).emit('room:user-left', {
      userId: (socket.data as { userId?: string }).userId || 'unknown',
      username,
      usersCount: count,
    });

    // System message
    const systemMsg: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: roomSlug,
      userId: 'system',
      username: 'System',
      content: `${username} left the room`,
      type: 'system',
      reactions: [],
      createdAt: new Date().toISOString(),
      isSystem: true,
    };
    io.to(roomSlug).emit('chat:message', systemMsg);

    console.log(`[Room] ${username} left ${roomSlug} (${count} users remaining)`);
  }
}
