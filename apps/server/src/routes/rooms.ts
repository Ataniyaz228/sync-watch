import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const AUTH_SECRET = process.env.AUTH_SECRET || 'syncwatch-dev-secret';

const rooms = new Hono();

// Login / Create account (simple — username + password)
rooms.post('/auth/login', async (c) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  if (username.length < 2 || username.length > 50) {
    return c.json({ error: 'Username must be 2-50 characters' }, 400);
  }

  if (password.length < 4) {
    return c.json({ error: 'Password must be at least 4 characters' }, 400);
  }

  const db = getDb();

  if (db) {
    // Check if user exists
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existing.length > 0) {
      // Verify password
      const valid = await bcrypt.compare(password, existing[0].passwordHash);
      if (!valid) {
        return c.json({ error: 'Invalid password' }, 401);
      }
      const token = jwt.sign({ userId: existing[0].id, username }, AUTH_SECRET, { expiresIn: '7d' });
      return c.json({ user: { id: existing[0].id, username: existing[0].username }, token });
    }

    // Create new user
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await db
      .insert(schema.users)
      .values({ username, passwordHash })
      .returning();

    const token = jwt.sign({ userId: newUser[0].id, username }, AUTH_SECRET, { expiresIn: '7d' });
    return c.json({ user: { id: newUser[0].id, username: newUser[0].username }, token, isNew: true });
  }

  // Fallback without DB — generate ephemeral user
  const userId = nanoid(12);
  const token = jwt.sign({ userId, username }, AUTH_SECRET, { expiresIn: '7d' });
  return c.json({ user: { id: userId, username }, token, isNew: true });
});

// Create room
rooms.post('/', async (c) => {
  const body = await c.req.json();
  const { name, userId } = body;

  if (!name) {
    return c.json({ error: 'Room name is required' }, 400);
  }

  const slug = nanoid(8);
  const db = getDb();

  if (db) {
    const room = await db
      .insert(schema.rooms)
      .values({
        slug,
        name,
        createdBy: userId || null,
      })
      .returning();

    return c.json(room[0]);
  }

  // Fallback without DB
  return c.json({
    id: nanoid(12),
    slug,
    name,
    createdBy: userId,
    isActive: true,
    currentUrl: null,
    videoType: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

// Get room by slug
rooms.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb();

  if (db) {
    const room = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.slug, slug))
      .limit(1);

    if (room.length === 0) {
      return c.json({ error: 'Room not found' }, 404);
    }

    return c.json(room[0]);
  }

  // Fallback
  return c.json({
    id: slug,
    slug,
    name: `Room ${slug}`,
    isActive: true,
    currentUrl: null,
    videoType: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

// Get room messages
rooms.get('/:slug/messages', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb();

  if (db) {
    const room = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.slug, slug))
      .limit(1);

    if (room.length === 0) {
      return c.json([]);
    }

    const msgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.roomId, room[0].id))
      .orderBy(schema.messages.createdAt)
      .limit(100);

    return c.json(msgs);
  }

  return c.json([]);
});

// Get watch history
rooms.get('/:slug/history', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb();

  if (db) {
    const room = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.slug, slug))
      .limit(1);

    if (room.length === 0) {
      return c.json([]);
    }

    const history = await db
      .select()
      .from(schema.watchHistory)
      .where(eq(schema.watchHistory.roomId, room[0].id))
      .orderBy(schema.watchHistory.createdAt)
      .limit(50);

    return c.json(history);
  }

  return c.json([]);
});

export default rooms;
