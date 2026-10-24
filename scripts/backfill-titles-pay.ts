// Backfill jobs.title_base + salary_* + pay_by_location for live rows ingested before those
// columns existed.
// New ingests derive them in normalize.ts; this fills the gap in one pass, batched (a single
// UPDATE … FROM (VALUES …) per 500 rows instead of one round-trip per row).
//
//   pnpm tsx scripts/backfill-titles-pay.ts
import '../src/env';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../src/db/client';
import { baseTitle } from '../src/ingest/title-base';
import { parseSalary, parsePayByLocation } from '../src/ingest/salary';

const BATCH = 500;
const db = getDb();
try {
  const rows = (await db.execute(
    sql`select id, title, description from jobs where removed_at is null`,
  )) as unknown as { id: string; title: string; description: string }[];
  console.log(`backfilling ${rows.length} live rows…`);

  let withPay = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const values = rows.slice(i, i + BATCH).map((r) => {
      const pay = parseSalary(r.description);
      if (pay) withPay++;
      const byLoc = JSON.stringify(parsePayByLocation(r.description));
      return sql`(${r.id}, ${baseTitle(r.title)}, ${pay?.min ?? null}::double precision, ${pay?.max ?? null}::double precision, ${pay?.period ?? null}, ${byLoc}::jsonb)`;
    });
    await db.execute(sql`
      update jobs set title_base = v.tb, salary_min = v.mn, salary_max = v.mx, salary_period = v.pd,
        pay_by_location = v.pl
      from (values ${sql.join(values, sql`, `)}) as v(id, tb, mn, mx, pd, pl)
      where jobs.id = v.id`);
  }
  console.log(`done · ${withPay} rows have a posted pay range`);

  const top = await db.execute(sql`
    select company, title_base, count(*)::int n from jobs
    where removed_at is null and category <> 'other' and country = 'US'
    group by 1, 2 having count(*) > 4 order by n desc limit 8`);
  console.log('biggest groups:');
  for (const t of top as unknown as { company: string; title_base: string; n: number }[]) {
    console.log(`  ${String(t.n).padStart(4)}  ${t.company} — ${t.title_base}`);
  }
} finally {
  await closeDb();
}
