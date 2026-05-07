import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/index.js';
import { getUsernameBySocket, getUserRoomBySocket } from '../services/redis.js';

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Track which sockets are in voice per room: roomSlug -> Set<socketId>
const voiceRooms = new Map<string, Set<string>>();
// socketId -> { roomSlug, userId }
const socketVoiceState = new Map<string, { roomSlug: string; userId: string }>();

export function setupVoiceHandler(io: TypedIO, socket: TypedSocket) {
  socket.on('voice:join', (data) => {
    const { roomSlug } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';
    const username = (socket.data as { username?: string }).username || 'Anonymous';

    if (!voiceRooms.has(roomSlug)) voiceRooms.set(roomSlug, new Set());
    voiceRooms.get(roomSlug)!.add(socket.id);
    socketVoiceState.set(socket.id, { roomSlug, userId });

    // Tell everyone in room that this user joined voice
    socket.to(roomSlug).emit('voice:user-joined', { userId, username });
    console.log(`[Voice] ${username} joined voice in ${roomSlug}`);
  });

  socket.on('voice:leave', (data) => {
    const { roomSlug } = data;
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    voiceRooms.get(roomSlug)?.delete(socket.id);
    socketVoiceState.delete(socket.id);

    socket.to(roomSlug).emit('voice:user-left', { userId });
    console.log(`[Voice] ${userId} left voice in ${roomSlug}`);
  });

  // WebRTC signaling: forward offer to target user
  socket.on('voice:offer', (data) => {
    const { roomSlug, sdp, targetUserId } = data;
    const fromUserId = (socket.data as { userId?: string }).userId || 'unknown';

    // Find target socket by userId
    const targetSocket = findSocketByUserId(io, roomSlug, targetUserId);
    if (targetSocket) {
      targetSocket.emit('voice:offer', { sdp, from: fromUserId });
    }
  });

  // WebRTC signaling: forward answer
  socket.on('voice:answer', (data) => {
    const { roomSlug, sdp, targetUserId } = data;
    const fromUserId = (socket.data as { userId?: string }).userId || 'unknown';

    const targetSocket = findSocketByUserId(io, roomSlug, targetUserId);
    if (targetSocket) {
      targetSocket.emit('voice:answer', { sdp, from: fromUserId });
    }
  });

  // WebRTC signaling: forward ICE candidate
  socket.on('voice:ice-candidate', (data) => {
    const { roomSlug, candidate, targetUserId } = data;
    const fromUserId = (socket.data as { userId?: string }).userId || 'unknown';

    const targetSocket = findSocketByUserId(io, roomSlug, targetUserId);
    if (targetSocket) {
      targetSocket.emit('voice:ice-candidate', { candidate, from: fromUserId });
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    const state = socketVoiceState.get(socket.id);
    if (state) {
      voiceRooms.get(state.roomSlug)?.delete(socket.id);
      socketVoiceState.delete(socket.id);
      socket.to(state.roomSlug).emit('voice:user-left', { userId: state.userId });
    }
  });
}

function findSocketByUserId(io: TypedIO, roomSlug: string, targetUserId: string): TypedSocket | undefined {
  const room = io.sockets.adapter.rooms.get(roomSlug);
  if (!room) return undefined;

  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId) as TypedSocket | undefined;
    if (s && (s.data as { userId?: string }).userId === targetUserId) {
      return s;
    }
  }
  return undefined;
}
