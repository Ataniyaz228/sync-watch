import { Hono } from 'hono';

const gifs = new Hono();

const TENOR_KEY = process.env.TENOR_API_KEY || '';

// GET /api/gifs/search?q=funny&limit=20
gifs.get('/search', async (c) => {
  const q = c.req.query('q') || '';
  const limit = c.req.query('limit') || '20';

  if (!q.trim()) {
    return c.json({ results: [] });
  }

  if (!TENOR_KEY) {
    return c.json({ error: 'TENOR_API_KEY not configured' }, 500);
  }

  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=${limit}&media_filter=gif&contentfilter=medium`;
    const res = await fetch(url);
    const data = await res.json();

    const results = (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.title || r.content_description || '',
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url || '',
      dims: r.media_formats?.gif?.dims || [200, 200],
    }));

    return c.json({ results });
  } catch (err) {
    console.error('[GIFs] Search error:', err);
    return c.json({ error: 'Failed to search GIFs' }, 500);
  }
});

// GET /api/gifs/trending?limit=20
gifs.get('/trending', async (c) => {
  const limit = c.req.query('limit') || '20';

  if (!TENOR_KEY) {
    return c.json({ error: 'TENOR_API_KEY not configured' }, 500);
  }

  try {
    const url = `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=${limit}&media_filter=gif&contentfilter=medium`;
    const res = await fetch(url);
    const data = await res.json();

    const results = (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.title || r.content_description || '',
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url || '',
      dims: r.media_formats?.gif?.dims || [200, 200],
    }));

    return c.json({ results });
  } catch (err) {
    console.error('[GIFs] Trending error:', err);
    return c.json({ error: 'Failed to fetch trending GIFs' }, 500);
  }
});

export default gifs;
