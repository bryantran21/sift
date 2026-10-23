// Push source config (company, tier, tags, industry, Workday coords) from sources.yaml +
// sources.generated.yaml into the `sources` table without fetching any jobs. Run after
// editing the company registry or the YAML so labels update immediately rather than at
// the next scheduled ingest.
//
//   pnpm sources:sync
import '../src/env';
import { sql } from 'drizzle-orm';
import { loadSources } from '../src/config/sources';
import { getDb, closeDb } from '../src/db/client';
import { upsertSources } from '../src/ingest/persist';

const db = getDb();
try {
  const sources = loadSources();
  await upsertSources(db, sources);
  const rows = await db.execute(sql`
    select industry, count(*)::int as n from sources group by industry order by n desc
  `);
  console.log(`synced ${sources.length} sources. by industry:`);
  for (const r of rows as unknown as { industry: string; n: number }[]) {
    console.log(`  ${r.industry.padEnd(12)} ${r.n}`);
  }

  // --show: list every non-tech label so a wave's registry matches can be eyeballed.
  if (process.argv.includes('--show')) {
    const labeled = await db.execute(sql`
      select industry, company, ats, slug from sources
      where industry <> 'tech' order by industry, company
    `);
    console.log('\nnon-tech labels:');
    for (const r of labeled as unknown as { industry: string; company: string; ats: string; slug: string }[]) {
      console.log(`  ${r.industry.padEnd(11)} ${r.company.padEnd(42)} ${r.ats}:${r.slug}`);
    }
  }
} finally {
  await closeDb();
}
