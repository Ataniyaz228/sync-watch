import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/index.js';
import { setupRoomHandler } from './roomHandler.js';
import { setupChatHandler } from './chatHandler.js';
import { setupVoiceHandler } from './voiceHandler.js';

export function setupSocketIO(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const allowed = [clientUrl, 'http://localhost:3000', 'http://localhost:3002'];
        if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          callback(null, true); // allow all for now
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    setupRoomHandler(io, socket);
    setupChatHandler(io, socket);
    setupVoiceHandler(io, socket);
  });

  console.log('[Socket.io] Initialized');

  return io;
}
