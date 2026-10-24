import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazily created so nothing touches Postgres until a caller actually needs it —
// Phase 1's `pnpm ingest` runs console-only and never opens a connection.
//
// Held on globalThis so the dev server's hot reloads reuse one pool instead of leaking a
// new one per reload (each leaked pool kept its connections and exhausted the shared
// 15-client cap, 500-ing every page).
type Db = ReturnType<typeof drizzle<typeof schema>>;
const g = globalThis as unknown as { __siftPg?: ReturnType<typeof postgres> | null; __siftDb?: Db | null };
let client: ReturnType<typeof postgres> | null = g.__siftPg ?? null;
let db: Db | null = g.__siftDb ?? null;

export function getDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  try {
    // Keep the pool small: the shared Supabase session-mode pooler caps at 15 total
    // clients across every process (prod serverless + any local dev + ingest). 8-per-
    // process let a single extra process exhaust it and 500 production. A read feed
    // needs very few connections. (Transaction pooler on :6543 removes the cap.)
    // idle_timeout: release idle connections after 20s, so warm-but-idle serverless
    // instances don't sit on the shared cap.
    client = postgres(url, { max: 3, prepare: false, idle_timeout: 20 });
  } catch {
    // Never surface the URL itself — it contains the password.
    throw new Error(
      'DATABASE_URL is not a valid Postgres connection string. Check .env.local — any special characters in the password must be percent-encoded (or use a letters-and-numbers-only password).',
    );
  }
  db = drizzle(client, { schema });
  g.__siftPg = client;
  g.__siftDb = db;
  return db;
}

export async function closeDb() {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    db = null;
    g.__siftPg = null;
    g.__siftDb = null;
  }
}

export { schema };
