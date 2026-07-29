// One-time backfill of derived columns (category, country) for jobs that already
// exist in the DB. New ingest runs derive these going forward via normalize.ts, but
// rows that aren't re-seen keep their old defaults until this runs.
//   pnpm tsx scripts/backfill-derived.ts
import '../src/env';
import { getDb, closeDb, schema } from '../src/db/client';
import { sql } from 'drizzle-orm';
import { classifyCategory } from '../src/ingest/classify';
import { deriveCountry } from '../src/ingest/location';

const db = getDb();
try {
  const rows = await db
    .select({ id: schema.jobs.id, title: schema.jobs.title, locations: schema.jobs.locations })
    .from(schema.jobs);

  console.log(`recomputing category + country for ${rows.length} rows…`);
  let n = 0;
  for (const r of rows) {
    const category = classifyCategory(r.title);
    const country = deriveCountry(r.locations ?? []);
    await db
      .update(schema.jobs)
      .set({ category, country, updatedAt: new Date() })
      .where(sql`${schema.jobs.id} = ${r.id}`);
    if (++n % 500 === 0) console.log(`  …${n}`);
  }

  const dist = await db.execute(sql`
    select category, country, count(*)::int as n
    from jobs where removed_at is null
    group by category, country order by n desc limit 20
  `);
  console.log(`done (${n} rows). live distribution (top 20):`);
  for (const d of dist) console.log(`  ${String(d.n).padStart(5)}  ${d.category} · ${d.country}`);
} finally {
  await closeDb();
}
