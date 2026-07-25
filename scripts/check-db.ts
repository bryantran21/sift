// Verifies the DATABASE_URL connects, without ever printing the connection string.
//   pnpm db:check
import '../src/env';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set — check .env.local (needs a DATABASE_URL=... line).');
  process.exit(1);
}

let sql: ReturnType<typeof postgres> | undefined;
try {
  sql = postgres(url, { max: 1 });
  const [row] = await sql`select now() as now, version() as version`;
  console.log('✓ connected to Postgres');
  console.log('  server time:', row?.now);
  console.log('  version:', String(row?.version ?? '').split(',')[0]);
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log('  tables:', tables.map((t) => t.table_name).join(', ') || '(none)');
} catch (err) {
  // Only surface the message (never the URL/password).
  console.error('✗ connection failed:', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 5 });
}
