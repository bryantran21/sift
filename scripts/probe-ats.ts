// Probe companies for a reachable, ingestable job board. For each company it tries the
// four single-GET ATSs (greenhouse / ashby / lever / smartrecruiters) across a handful of
// candidate slugs, and does a best-effort Workday sniff on the careers page. Prints the
// live hits (with job counts + sample titles to eyeball) and a blocked/unreachable report.
//
//   pnpm tsx scripts/probe-ats.ts [tag] [status]
//     tag    : quant | big-tech | fortune-500 | college | all   (default fortune-500)
//     status : live | pending | blocked | unknown | all          (default unknown)
//
// Read-only — it never writes sources.yaml or companies.ts. Wiring is a separate,
// reviewed step so we don't pull in a same-named decoy board.
import { companies, type Company } from '../src/data/companies';

const TAG = (process.argv[2] ?? 'fortune-500') as string;
const STATUS = (process.argv[3] ?? 'unknown') as string;
const CONCURRENCY = 6;
const TIMEOUT_MS = 9000;

interface Hit {
  ats: string;
  slug: string;
  count: number;
  sample: string[];
}
interface Probed {
  company: string;
  domain?: string;
  hit: Hit | null;
  workday?: string; // discovered "tenant.wdN.myworkdayjobs.com[/site]"
}

function slugCandidates(name: string, domain?: string): string[] {
  const out = new Set<string>();
  if (domain) out.add(domain.split('.')[0]);
  const base = name.toLowerCase().replace(/&/g, 'and').replace(/\./g, '');
  const alnum = base.replace(/[^a-z0-9]+/g, '');
  const firstWord = base.split(/[^a-z0-9]+/).filter(Boolean)[0];
  out.add(alnum);
  if (firstWord) out.add(firstWord);
  out.add(alnum.replace(/(inc|corp|co|company|group|holdings|airlines|airline|air|the)$/g, ''));
  return [...out].filter((s) => s && s.length >= 2 && s.length <= 40);
}

async function get(url: string, headers?: Record<string, string>): Promise<Response | null> {
  const ctl = AbortSignal.timeout(TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { 'User-Agent': 'sift-probe', ...headers }, signal: ctl });
  } catch {
    return null;
  }
}

async function probeGreenhouse(slug: string): Promise<Hit | null> {
  const r = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as { jobs?: { title: string }[] } | null;
  if (!j?.jobs?.length) return null;
  return { ats: 'greenhouse', slug, count: j.jobs.length, sample: j.jobs.slice(0, 2).map((x) => x.title) };
}
async function probeAshby(slug: string): Promise<Hit | null> {
  const r = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as { jobs?: { title: string }[] } | null;
  if (!j?.jobs?.length) return null;
  return { ats: 'ashby', slug, count: j.jobs.length, sample: j.jobs.slice(0, 2).map((x) => x.title) };
}
async function probeLever(slug: string): Promise<Hit | null> {
  const r = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as { text: string }[] | null;
  if (!Array.isArray(j) || !j.length) return null;
  return { ats: 'lever', slug, count: j.length, sample: j.slice(0, 2).map((x) => x.text) };
}
async function probeSmartRecruiters(slug: string): Promise<Hit | null> {
  const r = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=10`);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as { totalFound?: number; content?: { name: string }[] } | null;
  if (!j?.totalFound) return null;
  return {
    ats: 'smartrecruiters',
    slug,
    count: j.totalFound,
    sample: (j.content ?? []).slice(0, 2).map((x) => x.name),
  };
}

async function sniffWorkday(domain?: string): Promise<string | undefined> {
  if (!domain) return undefined;
  const urls = [`https://${domain}/careers`, `https://careers.${domain}`, `https://jobs.${domain}`];
  for (const u of urls) {
    const r = await get(u);
    if (!r || !r.ok) continue;
    const body = await r.text().catch(() => '');
    const m = body.match(/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com(\/[a-zA-Z0-9_-]+)?/);
    if (m) return m[0];
  }
  return undefined;
}

async function probeCompany(c: Company): Promise<Probed> {
  const slugs = slugCandidates(c.name, c.domain);
  for (const slug of slugs) {
    const hits = await Promise.all([
      probeGreenhouse(slug),
      probeAshby(slug),
      probeLever(slug),
      probeSmartRecruiters(slug),
    ]);
    const hit = hits.find((h) => h) ?? null;
    if (hit) return { company: c.name, domain: c.domain, hit };
  }
  // No single-GET board — see if the careers page is a Workday tenant.
  const workday = await sniffWorkday(c.domain);
  return { company: c.name, domain: c.domain, hit: null, workday };
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function main() {
  const targets = companies.filter(
    (c) => (TAG === 'all' || c.tag === TAG) && (STATUS === 'all' || c.status === STATUS),
  );
  console.error(`Probing ${targets.length} companies (tag=${TAG}, status=${STATUS})…\n`);

  const results = await pool(targets, CONCURRENCY, probeCompany);

  const live = results.filter((r) => r.hit);
  const workday = results.filter((r) => !r.hit && r.workday);
  const blocked = results.filter((r) => !r.hit && !r.workday);

  console.log('\n===== LIVE single-GET boards (review before wiring) =====');
  for (const r of live) {
    console.log(`✓ ${r.company.padEnd(24)} ${r.hit!.ats}:${r.hit!.slug}  (${r.hit!.count} jobs)  e.g. ${r.hit!.sample.join(' · ')}`);
  }
  console.log(`\n===== WORKDAY discovered (needs tenant/shard/site wiring) =====`);
  for (const r of workday) console.log(`~ ${r.company.padEnd(24)} ${r.workday}`);

  console.log(`\n===== BLOCKED / unreachable (no supported board) =====`);
  for (const r of blocked) console.log(`✗ ${r.company}${r.domain ? ' (' + r.domain + ')' : ''}`);

  console.log(
    `\nSummary: ${live.length} live · ${workday.length} workday-discovered · ${blocked.length} blocked  (of ${targets.length})`,
  );
}

main();
