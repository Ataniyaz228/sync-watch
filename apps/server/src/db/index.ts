import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!DATABASE_URL) {
    console.warn('[DB] DATABASE_URL not set — database features disabled');
    return null;
  }

  if (!db) {
    const sql = neon(DATABASE_URL);
    db = drizzle({ client: sql, schema });
    console.log('[DB] Connected to Neon PostgreSQL');
  }

  return db;
}

export { schema };
