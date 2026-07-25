import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazily created so nothing touches Postgres until a caller actually needs it —
// Phase 1's `pnpm ingest` runs console-only and never opens a connection.
let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  try {
    client = postgres(url, { max: 8, prepare: false });
  } catch {
    // Never surface the URL itself — it contains the password.
    throw new Error(
      'DATABASE_URL is not a valid Postgres connection string. Check .env.local — any special characters in the password must be percent-encoded (or use a letters-and-numbers-only password).',
    );
  }
  db = drizzle(client, { schema });
  return db;
}

export async function closeDb() {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    db = null;
  }
}

export { schema };
