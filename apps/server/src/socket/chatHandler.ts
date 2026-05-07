import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, ChatMessage, ChatReaction } from '../types/index.js';
import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const messageReactions = new Map<string, ChatReaction[]>();

export function setupChatHandler(io: TypedIO, socket: TypedSocket) {
  socket.on('chat:message', async (data) => {
    const { roomSlug, content } = data;
    const username = (socket.data as { username?: string }).username || 'Anonymous';
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: roomSlug,
      userId,
      username,
      content,
      type: 'text',
      reactions: [],
      createdAt: new Date().toISOString(),
    };

    io.to(roomSlug).emit('chat:message', message);

    const db = getDb();
    if (db) {
      try {
        const room = await db.select().from(schema.rooms).where(eq(schema.rooms.slug, roomSlug)).limit(1);
        if (room.length > 0) {
          await db.insert(schema.messages).values({ roomId: room[0].id, userId, username, content });
        }
      } catch (err) {
        console.error('[Chat] DB error:', err);
      }
    }
  });

  socket.on('chat:reaction', (data) => {
    const { roomSlug, messageId, emoji } = data;
    const username = (socket.data as { username?: string }).username || 'Anonymous';
    const userId = (socket.data as { userId?: string }).userId || 'unknown';

    const reactions = messageReactions.get(messageId) || [];
    const existing = reactions.findIndex(r => r.userId === userId && r.emoji === emoji);

    let action: 'add' | 'remove';
    if (existing >= 0) { reactions.splice(existing, 1); action = 'remove'; }
    else { reactions.push({ emoji, userId, username }); action = 'add'; }

    messageReactions.set(messageId, reactions);
    io.to(roomSlug).emit('chat:reaction', { messageId, reaction: { emoji, userId, username }, action });
  });
}
