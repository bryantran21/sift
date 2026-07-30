// Prune dead data to keep the DB small. Two targets:
//   1. job_sightings — append-only, one row per role per run (~7k × 48/day); this is
//      what actually balloons the DB. Delete rows older than the retention window,
//      in batches so one giant DELETE doesn't lock the table.
//   2. jobs that disappeared from the ATS (removed_at set) and have been gone past the
//      window — safe to hard-delete (they won't reappear). Cascades to any remaining
//      sightings + user_state. Live jobs are never deleted (ingest would re-add them).
//   pnpm prune
import '../src/env';
import { getDb, closeDb } from '../src/db/client';
import { sql } from 'drizzle-orm';

const RETAIN_DAYS = Number(process.env.PRUNE_RETAIN_DAYS ?? 30);
const BATCH = 10000;

const db = getDb();
try {
  const [before] = await db.execute(sql`
    select
      (select count(*)::int from job_sightings) as sightings,
      (select count(*)::int from jobs) as jobs,
      (select count(*)::int from jobs where removed_at is not null) as removed_jobs
  `);
  console.log(`retention: ${RETAIN_DAYS} days`);
  console.log('before:', before);

  // 1. Prune old sightings in batches (the bulk of the size).
  let sightingsDeleted = 0;
  for (;;) {
    const res = await db.execute(sql`
      delete from job_sightings
      where ctid in (
        select ctid from job_sightings
        where seen_at < now() - ${RETAIN_DAYS} * interval '1 day'
        limit ${BATCH}
      )
      returning 1
    `);
    const n = res.length;
    sightingsDeleted += n;
    if (n > 0) console.log(`  …pruned ${sightingsDeleted} old sightings`);
    if (n < BATCH) break;
  }

  // 2. Hard-delete jobs gone from the ATS past the window (cascades children).
  const delJobs = await db.execute(sql`
    delete from jobs
    where removed_at is not null and removed_at < now() - ${RETAIN_DAYS} * interval '1 day'
    returning 1
  `);
  console.log(`deleted ${delJobs.length} jobs removed > ${RETAIN_DAYS}d ago (${sightingsDeleted} sightings pruned)`);

  const [after] = await db.execute(sql`
    select
      (select count(*)::int from job_sightings) as sightings,
      (select count(*)::int from jobs) as jobs,
      (select count(*)::int from jobs where removed_at is null) as live_jobs
  `);
  console.log('after:', after);
} finally {
  await closeDb();
}
