// Dry-run every source through its adapter — no database writes — and report job counts,
// tech/US yield, timing, and failures. Run before wiring a batch of new boards so the
// ingest's time budget and health are known up front.
//
//   pnpm sources:check            # registry-wired boards only (the ones `pnpm probe` added)
//   pnpm sources:check all        # every source the ingest would fetch
import '../src/env';
import { loadSources, registrySources, yamlSources } from '../src/config/sources';
import { getAdapter } from '../src/ats/registry';
import { normalizeJob } from '../src/ingest/normalize';
import { mapLimit } from '../src/lib/concurrency';
import type { Source } from '../src/types';

const ALL = process.argv[2] === 'all';
const CONCURRENCY = 12; // same as the ingest

interface Result {
  source: Source;
  ok: boolean;
  raw: number;
  techUs: number;
  ms: number;
  error?: string;
}

async function check(source: Source): Promise<Result> {
  const adapter = getAdapter(source.ats);
  const t0 = Date.now();
  if (!adapter) return { source, ok: false, raw: 0, techUs: 0, ms: 0, error: `no adapter for ${source.ats}` };
  try {
    const raw = await adapter.fetchJobs(source);
    const techUs = raw.map(normalizeJob).filter((j) => j.category !== 'other' && j.country === 'US').length;
    return { source, ok: true, raw: raw.length, techUs, ms: Date.now() - t0 };
  } catch (e) {
    return { source, ok: false, raw: 0, techUs: 0, ms: Date.now() - t0, error: (e as Error).message.slice(0, 120) };
  }
}

async function main() {
  let targets: Source[];
  if (ALL) targets = loadSources();
  else {
    // Registry boards that aren't already covered by a YAML board.
    const yamlKeys = new Set(yamlSources().map((s) => `${s.ats}:${s.slug}`));
    const wired = new Set(loadSources().map((s) => `${s.ats}:${s.slug}`));
    targets = registrySources().filter((s) => !yamlKeys.has(`${s.ats}:${s.slug}`) && wired.has(`${s.ats}:${s.slug}`));
  }
  console.error(`Checking ${targets.length} sources (concurrency ${CONCURRENCY})…`);
  const t0 = Date.now();
  const results = await mapLimit(targets, CONCURRENCY, check);
  const wall = Date.now() - t0;

  results.sort((a, b) => b.techUs - a.techUs);
  for (const r of results) {
    const s = r.source;
    const tag = r.ok ? '✓' : '✗';
    const mode = s.search?.length ? ' [tech-search]' : '';
    console.log(
      `${tag} ${s.company.padEnd(28)} ${`${s.ats}:${s.slug}`.padEnd(32)} raw ${String(r.raw).padStart(4)}  tech+US ${String(r.techUs).padStart(4)}  ${(r.ms / 1000).toFixed(1).padStart(5)}s${mode}${r.error ? '  ' + r.error : ''}`,
    );
  }
  const ok = results.filter((r) => r.ok);
  const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 5);
  console.log(`\n${ok.length}/${results.length} ok · ${results.reduce((n, r) => n + r.raw, 0)} raw jobs · ${results.reduce((n, r) => n + r.techUs, 0)} tech+US`);
  console.log(`wall time ${(wall / 1000).toFixed(0)}s · slowest: ${slowest.map((r) => `${r.source.company} ${(r.ms / 1000).toFixed(0)}s`).join(', ')}`);
}

main();
