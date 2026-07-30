// One-time backfill of derived columns (category, country, seniority) for jobs that
// already exist in the DB. New ingest runs derive these going forward via normalize.ts,
// but rows that aren't re-seen keep their old defaults until this runs.
//   pnpm tsx scripts/backfill-derived.ts
import '../src/env';
import { getDb, closeDb, schema } from '../src/db/client';
import { sql } from 'drizzle-orm';
import { classifyCategory } from '../src/ingest/classify';
import { classifySeniority } from '../src/ingest/seniority';
import { deriveCountry } from '../src/ingest/location';

const db = getDb();
try {
  const rows = await db
    .select({ id: schema.jobs.id, title: schema.jobs.title, locations: schema.jobs.locations })
    .from(schema.jobs);

  console.log(`recomputing category + country + seniority for ${rows.length} rows…`);
  let n = 0;
  for (const r of rows) {
    const category = classifyCategory(r.title);
    const country = deriveCountry(r.locations ?? []);
    const seniority = classifySeniority(r.title);
    await db
      .update(schema.jobs)
      .set({ category, country, seniority, updatedAt: new Date() })
      .where(sql`${schema.jobs.id} = ${r.id}`);
    if (++n % 500 === 0) console.log(`  …${n}`);
  }

  const dist = await db.execute(sql`
    select seniority, count(*)::int as n
    from jobs where removed_at is null and category <> 'other' and country = 'US'
    group by seniority order by n desc
  `);
  console.log(`done (${n} rows). live tech+US roles by seniority:`);
  for (const d of dist) console.log(`  ${String(d.n).padStart(5)}  ${d.seniority}`);
} finally {
  await closeDb();
}
