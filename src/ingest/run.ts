import 'dotenv/config';
import { loadSources } from '../config/sources';
import { getAdapter, supportedAts } from '../ats/registry';
import { normalizeJob } from './normalize';
import { collapseFanout, renderLocations, type CollapsedJob } from './collapse';
import { jitter, mapLimit } from '../lib/concurrency';
import { ageLabel, recencyBucket, type Recency } from '../lib/recency';
import type { NormalizedJob, Source } from '../types';

// ANSI colors for the recency indicator in the console feed.
const ANSI: Record<Recency, string> = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  none: '\x1b[90m',
};
const RESET = '\x1b[0m';

function effectiveDate(j: NormalizedJob): Date | null {
  // Pre-persistence: postedAt is all we have. firstSeenAt takes over in Phase 2.
  return j.postedAt;
}

// Phase 1 ingest: fetch every runnable source concurrently, normalize, and print.
// Persistence and diffing arrive in Phase 2 — this run touches no database.

const CONCURRENCY = 8;
const JITTER_MS = 300;

interface SourceResult {
  source: Source;
  ok: boolean;
  jobs: NormalizedJob[];
  error?: string;
  ms: number;
}

async function fetchSource(source: Source): Promise<SourceResult> {
  const started = Date.now();
  const adapter = getAdapter(source.ats);
  if (!adapter) {
    return { source, ok: false, jobs: [], error: `no adapter for "${source.ats}"`, ms: 0 };
  }
  try {
    await jitter(JITTER_MS);
    const raw = await adapter.fetchJobs(source);
    const jobs = raw.map(normalizeJob);
    return { source, ok: true, jobs, ms: Date.now() - started };
  } catch (err) {
    return { source, ok: false, jobs: [], error: errorMessage(err), ms: Date.now() - started };
  }
}

async function main(): Promise<void> {
  const runStart = Date.now();
  const all = loadSources();
  const supported = new Set(supportedAts());
  const runnable = all.filter((s) => s.enabled && supported.has(s.ats));
  const awaiting = all.filter((s) => s.enabled && !supported.has(s.ats));

  console.log('\nsift ingest · Phase 1 (console only — no persistence yet)');
  console.log(new Date().toISOString());
  console.log(
    `\nSources: ${all.length} total · ${runnable.length} runnable · ${awaiting.length} awaiting adapters`,
  );
  if (awaiting.length > 0) {
    const byAts = countBy(awaiting, (s) => s.ats);
    console.log(`  (awaiting: ${formatCounts(byAts)})`);
  }
  console.log(`\nFetching ${runnable.length} sources (concurrency ${CONCURRENCY})…\n`);

  const results = await mapLimit(runnable, CONCURRENCY, fetchSource);
  results.sort((a, b) => a.source.company.localeCompare(b.source.company));

  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    const name = pad(r.source.company, 22);
    const ats = pad(r.source.ats, 12);
    if (r.ok) {
      console.log(`  ${mark} ${name} ${ats} ${String(r.jobs.length).padStart(4)} jobs  ${r.ms}ms`);
    } else {
      console.log(`  ${mark} ${name} ${ats} ERROR  ${r.error}`);
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const jobs = results.flatMap((r) => r.jobs);
  const withPosted = jobs.filter((j) => j.postedAt !== null).length;

  console.log(`\nSource health: ${okCount} of ${results.length} healthy · ${jobs.length} jobs normalized`);
  console.log(
    `postedAt coverage: ${withPosted}/${jobs.length} have a source date` +
      ` (${pct(withPosted, jobs.length)}); the rest fall back to firstSeenAt in the live feed.`,
  );

  // Phase 3: collapse fan-out (one row per req, locations unioned).
  const roles = collapseFanout(jobs);
  const merged = jobs.length - roles.length;
  console.log(
    `\nFan-out collapse: ${jobs.length} postings → ${roles.length} unique roles ` +
      `(${merged} duplicate postings merged, ${pct(merged, jobs.length)}).`,
  );
  printBiggestFanouts(roles, 8);

  const now = new Date();
  const buckets = { green: 0, yellow: 0, red: 0, none: 0 };
  for (const j of roles) buckets[recencyBucket(effectiveDate(j), now)]++;
  console.log(
    `\nRecency (by postedAt): ${ANSI.green}● ${buckets.green} fresh <24h${RESET} · ` +
      `${ANSI.yellow}● ${buckets.yellow} aging <7d${RESET} · ` +
      `${ANSI.red}● ${buckets.red} stale >7d${RESET} · ${buckets.none} undated`,
  );

  printSample(roles, 15);

  console.log(
    `\nDone in ${Date.now() - runStart}ms.` +
      ` Next: Stage-1 classification, blocklist + relevance scoring, then persistence.\n`,
  );
}

// ── console table ──────────────────────────────────────────────────────────────

function printBiggestFanouts(roles: CollapsedJob[], limit: number): void {
  const top = roles
    .filter((r) => r.mergedCount > 1)
    .sort((a, b) => b.mergedCount - a.mergedCount)
    .slice(0, limit);
  if (top.length === 0) return;
  console.log('\nBiggest fan-outs (postings merged into one role):');
  for (const r of top) {
    console.log(
      `  ×${String(r.mergedCount).padStart(2)}  ${pad(r.company, 18)}${pad(r.title, 40)}${renderLocations(r.locations, 5)}`,
    );
  }
}

function printSample(roles: CollapsedJob[], limit: number): void {
  if (roles.length === 0) return;

  // Sorted by source postedAt (newest first). The live feed will sort by
  // COALESCE(postedAt, firstSeenAt) and label the column "Added"; here we show what
  // we actually sorted. "×N" marks how many postings collapsed into the row.
  const sample = [...roles]
    .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
    .slice(0, limit);

  console.log(`\nNewest ${sample.length} roles by source postedAt:\n`);
  const header = pad('COMPANY', 18) + pad('TITLE', 40) + pad('LOCATIONS', 26) + pad('POSTED', 12) + 'AGE';
  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length + 6));
  const now = new Date();
  for (const j of sample) {
    const bucket = recencyBucket(effectiveDate(j), now);
    const age = `${ANSI[bucket]}● ${ageLabel(effectiveDate(j), now)}${RESET}`;
    const posts = j.mergedCount > 1 ? `  ${ANSI.none}×${j.mergedCount}${RESET}` : '';
    const row =
      pad(j.company, 18) +
      pad(j.title, 40) +
      pad(renderLocations(j.locations), 26) +
      pad(formatDate(j.postedAt), 12) +
      age +
      posts;
    console.log('  ' + row);
  }
}

// ── small formatting helpers ────────────────────────────────────────────────────

function pad(s: string, width: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean.length <= width - 1) return clean.padEnd(width);
  return clean.slice(0, Math.max(0, width - 2)) + '… ';
}

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

function formatCounts(counts: Map<string, number>): string {
  return [...counts.entries()].map(([k, v]) => `${v} ${k}`).join(', ');
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

main().catch((err) => {
  console.error('\ningest failed:', err);
  process.exit(1);
});
