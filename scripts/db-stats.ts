// Quick snapshot of what's in the database.
//   pnpm db:stats
import '../src/env';
import { getDb, closeDb } from '../src/db/client';
import { sql } from 'drizzle-orm';

const db = getDb();
try {
  const [counts] = await db.execute(sql`
    select
      (select count(*)::int from jobs) as jobs_total,
      (select count(*)::int from jobs where removed_at is null) as jobs_live,
      (select count(*)::int from jobs where removed_at is not null) as jobs_removed,
      (select count(*)::int from job_sightings) as sightings,
      (select count(*)::int from runs) as runs,
      (select count(*)::int from sources) as sources
  `);
  console.log('counts:', counts);

  const [recency] = await db.execute(sql`
    select
      count(*) filter (where coalesce(posted_at, first_seen_at) > now() - interval '24 hours')::int as green,
      count(*) filter (where coalesce(posted_at, first_seen_at) <= now() - interval '24 hours'
                         and coalesce(posted_at, first_seen_at) > now() - interval '7 days')::int as yellow,
      count(*) filter (where coalesce(posted_at, first_seen_at) <= now() - interval '7 days')::int as red
    from jobs where removed_at is null
  `);
  console.log('recency (live, by COALESCE(posted_at, first_seen_at)):', recency);

  const top = await db.execute(sql`
    select company, count(*)::int as live_roles
    from jobs where removed_at is null
    group by company order by live_roles desc, company limit 8
  `);
  console.log('top companies by live roles:');
  for (const r of top) console.log(`  ${String(r.live_roles).padStart(4)}  ${r.company}`);

  const [run] = await db.execute(sql`
    select id, new_count, still_live_count, disappeared_count, sources_ok, sources_total, duration_ms
    from runs where finished_at is not null order by id desc limit 1
  `);
  console.log('latest completed run:', run);
} finally {
  await closeDb();
}
