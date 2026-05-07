import { Hono } from 'hono';
import { resolveVideo } from '../services/videoResolver.js';

const videos = new Hono();

videos.post('/resolve', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    const result = await resolveVideo(url);
    return c.json(result);
  } catch (err) {
    console.error('[Videos] Error resolving video:', err);
    return c.json({ error: 'Failed to resolve video URL' }, 500);
  }
});

export default videos;
