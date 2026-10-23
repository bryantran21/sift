// Delete stored jobs the feed can never show (non-tech roles, or known non-US) and compact
// the tables. Ingest stops persisting these (see isPersistable in src/ingest/run.ts); this
// clears what accumulated before that, and is safe to re-run.
//
//   pnpm tsx scripts/cleanup-irrelevant.ts
//
// Deletes in batches (cascades to job_sightings / user_state) so no single statement holds
// a long lock, then VACUUM FULL returns the space to the OS — the jobs table is locked for
// the duration of the vacuum (about a minute).
import '../src/env';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../src/db/client';

const BATCH = 5000;
const irrelevant = sql`(category = 'other' or country = 'non-US')`;

const db = getDb();
try {
  const size = async () =>
    ((await db.execute(sql`select pg_size_pretty(pg_database_size(current_database())) as s`)) as unknown as { s: string }[])[0]!.s;
  console.log('before:', await size());

  const [{ n, saved }] = (await db.execute(sql`
    select count(*)::int as n,
      (select count(*)::int from user_state us join jobs j on j.id = us.job_id where ${irrelevant}) as saved
    from jobs where ${irrelevant}`)) as unknown as { n: number; saved: number }[];
  console.log(`irrelevant jobs: ${n} (user_state rows attached: ${saved})`);

  let deleted = 0;
  for (;;) {
    const res = await db.execute(sql`
      delete from jobs where ctid in (select ctid from jobs where ${irrelevant} limit ${BATCH}) returning 1`);
    deleted += res.length;
    if (res.length < BATCH) break;
    console.log(`  …${deleted}`);
  }
  console.log(`deleted ${deleted} jobs (their sightings cascaded).`);

  for (const t of ['job_sightings', 'jobs']) {
    const t0 = Date.now();
    await db.execute(sql.raw(`vacuum full analyze ${t}`));
    console.log(`vacuum full ${t}: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log('after:', await size());
} finally {
  await closeDb();
}
