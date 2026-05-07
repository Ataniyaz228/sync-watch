import { Hono } from 'hono';

const gifs = new Hono();

const GIPHY_KEY = process.env.GIPHY_API_KEY || '';

// GET /api/gifs/search?q=funny&limit=20
gifs.get('/search', async (c) => {
  const q = c.req.query('q') || '';
  const limit = c.req.query('limit') || '20';

  if (!q.trim()) {
    return c.json({ results: [] });
  }

  if (!GIPHY_KEY) {
    return c.json({ error: 'GIPHY_API_KEY not configured' }, 500);
  }

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13&lang=en`;
    const res = await fetch(url);
    const data = await res.json();

    const results = (data.data || []).map((g: any) => ({
      id: g.id,
      title: g.title || '',
      url: g.images?.fixed_height?.url || g.images?.original?.url || '',
      preview: g.images?.fixed_height_small?.url || g.images?.preview_gif?.url || g.images?.fixed_height?.url || '',
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

  if (!GIPHY_KEY) {
    return c.json({ error: 'GIPHY_API_KEY not configured' }, 500);
  }

  try {
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13`;
    const res = await fetch(url);
    const data = await res.json();

    const results = (data.data || []).map((g: any) => ({
      id: g.id,
      title: g.title || '',
      url: g.images?.fixed_height?.url || g.images?.original?.url || '',
      preview: g.images?.fixed_height_small?.url || g.images?.preview_gif?.url || g.images?.fixed_height?.url || '',
    }));

    return c.json({ results });
  } catch (err) {
    console.error('[GIFs] Trending error:', err);
    return c.json({ error: 'Failed to fetch trending GIFs' }, 500);
  }
});

export default gifs;
