import 'dotenv/config';
import { createServer } from 'http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { setupSocketIO } from './socket/index.js';
import health from './routes/health.js';
import rooms from './routes/rooms.js';
import videos from './routes/videos.js';
import gifs from './routes/gifs.js';

const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', cors({
  origin: (origin) => {
    // Allow configured client URL, any Vercel preview, and localhost
    const allowed = [CLIENT_URL, 'http://localhost:3000', 'http://localhost:3002'];
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) return origin;
    return CLIENT_URL;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use('*', logger());

// Routes
app.route('/api/health', health);
app.route('/api/rooms', rooms);
app.route('/api/videos', videos);
app.route('/api/gifs', gifs);

// Root
app.get('/', (c) => {
  return c.json({
    name: 'SyncWatch API',
    version: '1.0.0',
    endpoints: ['/api/health', '/api/rooms', '/api/videos/resolve'],
  });
});

// Create HTTP server manually (required for Socket.io integration)
const httpServer = createServer(async (req, res) => {
  try {
    // Convert Node.js request to a Web Request for Hono
    const url = `http://localhost:${PORT}${req.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    // Read body for non-GET requests
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise<string>((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
    }

    const webRequest = new Request(url, {
      method: req.method,
      headers,
      body: body || undefined,
    });

    const response = await app.fetch(webRequest);

    // Set response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.statusCode = response.status;

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } else {
      const text = await response.text();
      res.end(text);
    }
  } catch (err) {
    console.error('[Server] Request error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Attach Socket.io to the same HTTP server
setupSocketIO(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║          SyncWatch Server v1.0.0          ║
  ╠═══════════════════════════════════════════╣
  ║  HTTP API:    http://localhost:${PORT}        ║
  ║  Socket.io:   ws://localhost:${PORT}          ║
  ║  Client URL:  ${CLIENT_URL.padEnd(27)}║
  ╚═══════════════════════════════════════════╝
  `);
});
