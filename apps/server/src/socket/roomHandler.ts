import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, ChatMessage } from '../types/index.js';
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
      createdAt: new Date().toISOString(),
      isSystem: true,
    };
    io.to(roomSlug).emit('chat:message', systemMsg);

    // Send current room state to the new user
    const state = await getRoomState(roomSlug);
    if (state) {
      socket.emit('video:sync-state', state);
    }

    console.log(`[Room] ${username} joined ${roomSlug} (${usersCount} users)`);
  });

  socket.on('room:leave', (data) => {
    const { roomSlug } = data;
    handleLeave(io, socket, roomSlug);
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
      createdAt: new Date().toISOString(),
      isSystem: true,
    };
    io.to(roomSlug).emit('chat:message', systemMsg);

    console.log(`[Room] ${username} left ${roomSlug} (${count} users remaining)`);
  }
}
