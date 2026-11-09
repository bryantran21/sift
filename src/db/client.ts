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

// Supabase's session-mode pooler (:5432) pins one Postgres backend per open client socket
// and caps them at 15. Vercel freezes idle function instances with their sockets still
// open, so idle_timeout never fires and the slots fill up until every page 500s. The
// transaction pooler (:6543, same host and credentials) hands backends out per query and
// has no such cap. Nothing here uses session state (LISTEN, advisory locks, SET), so it
// is safe everywhere. SIFT_SESSION_POOLER=1 opts out.
export function poolerUrl(url: string): string {
  if (process.env.SIFT_SESSION_POOLER === '1') return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('.pooler.supabase.com') && (u.port === '5432' || u.port === '')) {
      u.port = '6543';
      return u.toString();
    }
  } catch {
    // fall through — postgres() reports the bad URL below without echoing it
  }
  return url;
}

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
    // max_pipeline: 0 — one in-flight query per connection. Supavisor's transaction mode
    // drops pipelined parameterless queries (getCompanies, getFeedMeta): the backend sits
    // in ClientRead forever and the page never finishes rendering. Reproduced with 8
    // concurrent `select count(*) from sources` over max: 3; this setting fixes it.
    client = postgres(poolerUrl(url), { max: 3, prepare: false, idle_timeout: 20, max_pipeline: 0 });
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
