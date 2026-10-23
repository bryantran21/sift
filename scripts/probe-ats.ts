// Discover a reachable, ingestable job board for each registry company and classify it:
//
//   live     — already ingesting (an existing source), or a verified Greenhouse / Lever /
//              Ashby / SmartRecruiters board with jobs
//   workday  — a verified Workday tenant (CXS endpoint answers with jobs) → wire-ready
//   blocked  — no supported board; the careers platform we detected is recorded
//
// Discovery order, most → least trustworthy:
//   1. an existing source in sources.yaml / sources.generated.yaml for this company
//   2. the company's careers page: follow redirects and scan for ATS links/fingerprints
//      (this finds the real slug instead of guessing — no decoys)
//   3. slug guessing on single-GET ATSs, accepted only when the board validates as this
//      company (Greenhouse/SmartRecruiters report their name; Lever/Ashby need an exact
//      slug + a real job count)
//
// Writes src/data/probe-results.json (merged into the registry by companies.ts) and
// docs/coverage-report.md (the human-readable live / workday / blocked report).
//
//   pnpm probe                 # registry companies not yet live
//   pnpm probe all             # everything
//   pnpm probe industry:food   # one industry
//   pnpm probe platform:phenom # companies last blocked on a platform (after adding its adapter)
//   pnpm probe "Delta Air Lines,Nike"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { companies, findCompany, industryOf, normCompany, type Company } from '../src/data/companies';
import { INDUSTRIES, INDUSTRY_KEYS } from '../src/data/industries';
import { yamlSources } from '../src/config/sources';
import { isRejectedBoard } from '../src/config/rejected-boards';
import { DEFAULT_USER_AGENT } from '../src/lib/http';
import type { ProbeResult } from '../src/data/probe';

const ARG = process.argv[2] ?? 'unknown';

// Reviewed-and-rejected boards (src/config/rejected-boards.ts) count as not found.
const ok = (ats: string, slug: string) => !isRejectedBoard(ats, slug);
const CONCURRENCY = 8;
const TIMEOUT_MS = 10_000;
const RESULTS_PATH = path.resolve('src/data/probe-results.json');
const REPORT_PATH = path.resolve('docs/coverage-report.md');

// ── HTTP ──────────────────────────────────────────────────────────────────────
async function fetchText(url: string): Promise<{ url: string; status: number; body: string } | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await r.text().catch(() => '')).slice(0, 2_000_000);
    return { url: r.url, status: r.status, body };
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/json', ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// ── Board verification (returns the live job count, or 0) ────────────────────
async function greenhouseBoard(slug: string): Promise<{ count: number; name?: string }> {
  const [board, jobs] = await Promise.all([
    fetchJson<{ name?: string }>(`https://boards-api.greenhouse.io/v1/boards/${slug}`),
    fetchJson<{ jobs?: unknown[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`),
  ]);
  return { count: jobs?.jobs?.length ?? 0, name: board?.name };
}
async function leverBoard(slug: string): Promise<{ count: number }> {
  const j = await fetchJson<unknown[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return { count: Array.isArray(j) ? j.length : 0 };
}
async function ashbyBoard(slug: string): Promise<{ count: number }> {
  const j = await fetchJson<{ jobs?: unknown[] }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  return { count: j?.jobs?.length ?? 0 };
}
async function smartRecruitersBoard(slug: string): Promise<{ count: number; name?: string }> {
  const j = await fetchJson<{ totalFound?: number; content?: { company?: { name?: string } }[] }>(
    `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=5`,
  );
  return { count: j?.totalFound ?? 0, name: j?.content?.[0]?.company?.name };
}
async function workdayBoard(tenant: string, shard: string, site: string): Promise<{ count: number }> {
  const j = await fetchJson<{ total?: number }>(
    `https://${tenant}.wd${shard}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
    },
  );
  return { count: j?.total ?? 0 };
}
// Eightfold: PCSX (current) first, then the legacy v2 API. US-constrained like the adapter.
async function eightfoldBoard(host: string, domain: string): Promise<{ count: number }> {
  const q = `domain=${encodeURIComponent(domain)}&location=United%20States`;
  const pcsx = await fetchJson<{ data?: { count?: number } }>(`https://${host}/api/pcsx/search?${q}&query=&start=0`);
  if (pcsx?.data?.count) return { count: pcsx.data.count };
  const v2 = await fetchJson<{ count?: number }>(`https://${host}/api/apply/v2/jobs?${q}&start=0&num=1`);
  return { count: v2?.count ?? 0 };
}
async function phenomBoard(host: string, refNum: string): Promise<{ count: number }> {
  const j = await fetchJson<{ refineSearch?: { totalHits?: number } }>(`https://${host}/widgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang: 'en_us',
      deviceType: 'desktop',
      country: 'us',
      pageName: 'search-results',
      ddoKey: 'refineSearch',
      from: 0,
      size: 1,
      jobs: true,
      counts: true,
      siteType: 'external',
      keywords: '',
      global: true,
      selected_fields: {},
      refNum,
    }),
  });
  return { count: j?.refineSearch?.totalHits ?? 0 };
}
async function oracleBoard(host: string, site: string): Promise<{ count: number }> {
  const j = await fetchJson<{ items?: { TotalJobsCount?: number }[] }>(
    `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&finder=findReqs;siteNumber=${site},limit=1,offset=0`,
  );
  return { count: j?.items?.[0]?.TotalJobsCount ?? 0 };
}

// ── Careers-page fingerprinting ──────────────────────────────────────────────
interface Fingerprint {
  greenhouse?: string;
  lever?: string;
  ashby?: string;
  smartrecruiters?: string;
  workday?: { tenant: string; shard: string; site: string };
  eightfold?: { host: string; domain?: string };
  oracle?: { host: string; site: string };
  phenomRefNum?: string; // Phenom site id; the host is the careers page's own host
  platform?: string; // a non-supported platform, for the blocked report
}

const BLOCKED_PLATFORMS: [RegExp, string][] = [
  [/\.icims\.com/i, 'iCIMS'],
  [/taleo\.net/i, 'Oracle Taleo'],
  [/oraclecloud\.com\/hcmUI|\.fa\.[a-z0-9]+\.oraclecloud\.com/i, 'Oracle HCM'],
  [/successfactors\.(com|eu)|career\d*\.sapsf\.|jobs\.sap\.com/i, 'SAP SuccessFactors'],
  [/phenompeople|cdn\.phenom|phenom\.com/i, 'Phenom'],
  [/radancy|talentbrew|tmpwebeng/i, 'Radancy'],
  [/eightfold\.ai/i, 'Eightfold'],
  [/avature\.net/i, 'Avature'],
  [/brassring\.com/i, 'BrassRing'],
  [/jobvite\.com/i, 'Jobvite'],
  [/apply\.workable\.com/i, 'Workable'],
  [/ultipro\.com|ukg\.net|recruiting\.ultipro/i, 'UKG'],
  [/workforcenow\.adp\.com|myjobs\.adp\.com/i, 'ADP'],
  [/dayforcehcm\.com/i, 'Dayforce'],
  [/csod\.com/i, 'Cornerstone'],
  [/paylocity\.com/i, 'Paylocity'],
  [/jibeapply|jibecdn/i, 'Jibe'],
];

const WORKDAY_RE = /([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}[-_][a-z]{2}\/)?([a-z0-9_-]+)/gi;
const NOT_A_SITE = new Set(['wday', 'en-us', 'en_us', 'login', 'assets', 'static']);

function fingerprint(text: string): Fingerprint {
  const fp: Fingerprint = {};
  const gh = text.match(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/i);
  if (gh && !['embed', 'v1'].includes(gh[1].toLowerCase())) fp.greenhouse = gh[1];
  const ghFor = text.match(/greenhouse\.io\/embed\/job_board(?:\/js)?\?for=([a-z0-9_-]+)/i);
  if (ghFor) fp.greenhouse = ghFor[1];
  const lv = text.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
  if (lv) fp.lever = lv[1];
  const ab = text.match(/jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i);
  if (ab) fp.ashby = ab[1];
  const sr = text.match(/(?:jobs|careers)\.smartrecruiters\.com\/([a-z0-9_-]+)/i);
  if (sr && !['oneclick-ui', 'sr-jobs'].includes(sr[1].toLowerCase())) fp.smartrecruiters = sr[1];
  for (const m of text.matchAll(WORKDAY_RE)) {
    if (!NOT_A_SITE.has(m[3].toLowerCase())) {
      fp.workday = { tenant: m[1].toLowerCase(), shard: m[2], site: m[3] };
      break;
    }
  }
  const ef = text.match(/([a-z0-9-]+\.eightfold\.ai)/i);
  if (ef && !/^(app|www|static|cdn)\./i.test(ef[1])) {
    const dom = text.match(/eightfold\.ai[^"'\s]*[?&]domain=([a-z0-9.-]+)/i);
    fp.eightfold = { host: ef[1].toLowerCase(), domain: dom?.[1]?.toLowerCase() };
  }
  const or = text.match(/([a-z0-9.-]+\.oraclecloud\.com)\/hcmUI\/CandidateExperience\/[a-z_-]+\/sites\/([A-Za-z0-9_]+)/i);
  if (or) fp.oracle = { host: or[1].toLowerCase(), site: or[2] };
  const ph = text.match(/"refNum"\s*:\s*"([A-Z0-9]{3,20})"/);
  if (ph) fp.phenomRefNum = ph[1];
  for (const [re, name] of BLOCKED_PLATFORMS) {
    if (re.test(text)) {
      fp.platform = name;
      break;
    }
  }
  return fp;
}

function careersUrls(c: Company): string[] {
  const urls: string[] = [];
  if (c.careers) urls.push(c.careers);
  if (!c.domain) return urls;
  const bare = c.domain.replace(/^www\./, '');
  const root = bare.split('.')[0];
  urls.push(
    `https://careers.${bare}`,
    `https://${bare}/careers`,
    `https://jobs.${bare}`,
    `https://www.${root}careers.com`, // capitalonecareers.com, disneycareers.com, …
    `https://www.${bare}/careers`,
    `https://${bare}/jobs`,
  );
  return urls;
}

// ── Slug guessing (fallback) with identity validation ────────────────────────
function slugCandidates(c: Company): string[] {
  const out = new Set<string>();
  if (c.domain) out.add(c.domain.replace(/^www\./, '').split('.')[0]);
  for (const n of [c.name, ...(c.aliases ?? [])]) out.add(normCompany(n).replace(/ /g, ''));
  return [...out].filter((s) => s.length >= 2 && s.length <= 40);
}

function isSameCompany(c: Company, reportedName?: string): boolean {
  if (!reportedName) return false;
  return findCompany(reportedName) === c || normCompany(reportedName) === normCompany(c.name);
}

// ── Per-company probe ────────────────────────────────────────────────────────
type Existing = Map<string, { ats: string; slug: string }>;

async function probe(c: Company, existing: Existing): Promise<ProbeResult> {
  const now = new Date().toISOString();
  const base = { probedAt: now };

  // 1. Already ingesting?
  const ex = existing.get(c.name);
  if (ex) return { ...base, status: 'live', ats: ex.ats, slug: ex.slug, via: 'existing-source' };

  // 2. Careers page.
  let platform: string | undefined;
  let careersUrl: string | undefined;
  {
    for (const url of careersUrls(c)) {
      const page = await fetchText(url);
      if (!page || page.status >= 400) continue;
      careersUrl ??= page.url;
      const fp = fingerprint(`${page.url}\n${page.body}`);
      platform ??= fp.platform;

      if (fp.workday) {
        const { tenant, shard, site } = fp.workday;
        const wd = await workdayBoard(tenant, shard, site);
        if (wd.count > 0) {
          return { ...base, status: 'workday', ats: 'workday', slug: tenant, tenant, shard, site, jobs: wd.count, via: 'careers-page', careersUrl: page.url };
        }
      }
      if (fp.greenhouse && ok('greenhouse', fp.greenhouse)) {
        const b = await greenhouseBoard(fp.greenhouse);
        if (b.count > 0) return { ...base, status: 'live', ats: 'greenhouse', slug: fp.greenhouse, jobs: b.count, via: 'careers-page', careersUrl: page.url };
      }
      if (fp.lever && ok('lever', fp.lever)) {
        const b = await leverBoard(fp.lever);
        if (b.count > 0) return { ...base, status: 'live', ats: 'lever', slug: fp.lever, jobs: b.count, via: 'careers-page', careersUrl: page.url };
      }
      if (fp.ashby && ok('ashby', fp.ashby)) {
        const b = await ashbyBoard(fp.ashby);
        if (b.count > 0) return { ...base, status: 'live', ats: 'ashby', slug: fp.ashby, jobs: b.count, via: 'careers-page', careersUrl: page.url };
      }
      if (fp.smartrecruiters && ok('smartrecruiters', fp.smartrecruiters)) {
        const b = await smartRecruitersBoard(fp.smartrecruiters);
        if (b.count > 0) return { ...base, status: 'live', ats: 'smartrecruiters', slug: fp.smartrecruiters, jobs: b.count, via: 'careers-page', careersUrl: page.url };
      }
      if (fp.eightfold) {
        const domain = fp.eightfold.domain ?? c.domain?.replace(/^www\./, '') ?? '';
        const b = await eightfoldBoard(fp.eightfold.host, domain);
        if (b.count > 0) {
          const slug = fp.eightfold.host.split('.')[0];
          return { ...base, status: 'workday', ats: 'eightfold', slug, host: fp.eightfold.host, site: domain, jobs: b.count, via: 'careers-page', careersUrl: page.url };
        }
      }
      if (fp.oracle) {
        const b = await oracleBoard(fp.oracle.host, fp.oracle.site);
        if (b.count > 0) {
          const slug = fp.oracle.host.split('.')[0];
          return { ...base, status: 'workday', ats: 'oraclehcm', slug, host: fp.oracle.host, site: fp.oracle.site, jobs: b.count, via: 'careers-page', careersUrl: page.url };
        }
      }
      if (fp.phenomRefNum) {
        const host = new URL(page.url).host;
        const b = await phenomBoard(host, fp.phenomRefNum);
        if (b.count > 0) {
          return { ...base, status: 'workday', ats: 'phenom', slug: fp.phenomRefNum.toLowerCase(), host, site: fp.phenomRefNum, jobs: b.count, via: 'careers-page', careersUrl: page.url };
        }
      }
      // An unsupported platform is recorded but we keep checking the other candidate URLs —
      // a careers page can mention one platform while the real board lives elsewhere.
    }
  }

  // Eightfold tenants are usually {brand}.eightfold.ai — a cheap, validated guess.
  if (c.domain) {
    const bare = c.domain.replace(/^www\./, '');
    const host = `${bare.split('.')[0]}.eightfold.ai`;
    const b = await eightfoldBoard(host, bare);
    if (b.count > 0) {
      return { ...base, status: 'workday', ats: 'eightfold', slug: host.split('.')[0], host, site: bare, jobs: b.count, via: 'slug-guess' };
    }
  }

  // 3. Slug guessing, accepted only when the board validates as this company.
  for (const slug of slugCandidates(c)) {
    const [gh, sr] = await Promise.all([greenhouseBoard(slug), smartRecruitersBoard(slug)]);
    if (gh.count >= 3 && isSameCompany(c, gh.name) && ok('greenhouse', slug)) return { ...base, status: 'live', ats: 'greenhouse', slug, jobs: gh.count, via: 'slug-guess' };
    if (sr.count >= 3 && isSameCompany(c, sr.name) && ok('smartrecruiters', slug)) return { ...base, status: 'live', ats: 'smartrecruiters', slug, jobs: sr.count, via: 'slug-guess' };
    // Ashby reports no company name — require the exact full-name slug + real volume.
    // Lever isn't guessed at all: unvalidatable guesses there were mostly decoys (junk
    // test boards, foreign sales-agent boards); Lever boards are found via careers pages.
    if (slug === normCompany(c.name).replace(/ /g, '') && ok('ashby', slug)) {
      const ab = await ashbyBoard(slug);
      if (ab.count >= 5) return { ...base, status: 'live', ats: 'ashby', slug, jobs: ab.count, via: 'slug-guess' };
    }
  }

  return {
    ...base,
    status: 'blocked',
    platform: platform ?? (careersUrl ? 'Custom careers site' : 'No careers page reached'),
    careersUrl,
    via: 'careers-page',
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
        if (++done % 25 === 0) console.error(`  …${done}/${items.length}`);
      }
    }),
  );
  return out;
}

function selectTargets(): Company[] {
  if (ARG === 'all') return companies;
  if (ARG === 'unknown') return companies.filter((c) => c.status !== 'live');
  if (ARG.startsWith('industry:')) {
    const ind = ARG.slice('industry:'.length);
    return companies.filter((c) => industryOf(c) === ind);
  }
  // Re-probe companies last blocked on a given platform — e.g. after adding its adapter.
  if (ARG.startsWith('platform:')) {
    const want = ARG.slice('platform:'.length).toLowerCase();
    const prev: Record<string, ProbeResult> = existsSync(RESULTS_PATH) ? JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) : {};
    return companies.filter((c) => prev[c.name]?.status === 'blocked' && prev[c.name]?.platform?.toLowerCase().includes(want));
  }
  const names = new Set(ARG.split(',').map((s) => normCompany(s)));
  return companies.filter((c) => names.has(normCompany(c.name)));
}

function writeReport(all: Record<string, ProbeResult>) {
  const rows = companies.map((c) => ({ c, r: all[c.name] }));
  const line = (c: Company, r?: ProbeResult) => {
    if (!r) return `- ${c.name} — _not probed_`;
    if (r.status === 'live') return `- **${c.name}** — ${r.ats}:${r.slug}${r.jobs ? ` (${r.jobs} jobs)` : ''}`;
    if (r.status === 'workday') {
      const board = r.ats === 'workday' ? `workday ${r.tenant}/wd${r.shard}/${r.site}` : `${r.ats} ${r.host}/${r.site}`;
      return `- **${c.name}** — ${board} (${r.jobs} jobs)`;
    }
    return `- ${c.name} — ${r.platform}`;
  };
  const count = (s: string) => rows.filter(({ c, r }) => (r?.status ?? (c.status === 'live' ? 'live' : '')) === s).length;
  const md: string[] = [
    '# Company coverage report',
    '',
    `_Generated by \`pnpm probe\` on ${new Date().toISOString().slice(0, 10)}. Do not hand-edit._`,
    '',
    `**${companies.length} companies** · ${count('live')} live · ${count('workday')} Workday-ready · ${count('blocked')} blocked`,
    '',
  ];
  for (const k of INDUSTRY_KEYS) {
    const group = rows.filter(({ c }) => industryOf(c) === k);
    if (!group.length) continue;
    md.push(`## ${INDUSTRIES[k]} (${group.length})`, '');
    for (const status of ['live', 'workday', 'blocked'] as const) {
      const items = group.filter(({ c, r }) => (r?.status ?? (c.status === 'live' ? 'live' : 'blocked')) === status);
      if (!items.length) continue;
      md.push(`**${status === 'live' ? 'Live' : status === 'workday' ? 'Workday-ready' : 'Blocked'}** (${items.length})`, '');
      for (const { c, r } of items) md.push(line(c, r));
      md.push('');
    }
  }
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, md.join('\n'), 'utf8');
}

async function main() {
  const targets = selectTargets();
  console.error(`Probing ${targets.length} companies (${ARG})…`);

  // Map every existing YAML source back to its registry company. YAML only: the registry
  // layer is built from earlier probe results, and counting it would let a bad result
  // re-confirm itself.
  const existing: Existing = new Map();
  for (const s of yamlSources()) {
    if (!s.enabled || isRejectedBoard(s.ats, s.slug)) continue;
    const c = findCompany(s.company);
    if (c && !existing.has(c.name)) existing.set(c.name, { ats: s.ats, slug: s.slug });
  }

  const results = await pool(targets, CONCURRENCY, (c) => probe(c, existing));

  const prev: Record<string, ProbeResult> = existsSync(RESULTS_PATH)
    ? JSON.parse(readFileSync(RESULTS_PATH, 'utf8'))
    : {};
  const merged = { ...prev };
  targets.forEach((c, i) => (merged[c.name] = results[i]));
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(RESULTS_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  writeReport(sorted);

  const by = (s: string) => results.filter((r) => r.status === s).length;
  console.log(`\nprobed ${targets.length}: ${by('live')} live · ${by('workday')} workday-ready · ${by('blocked')} blocked`);
  const platforms: Record<string, number> = {};
  for (const r of results) if (r.status === 'blocked') platforms[r.platform ?? '?'] = (platforms[r.platform ?? '?'] ?? 0) + 1;
  console.log('blocked by platform:', JSON.stringify(platforms));
  console.log(`wrote ${path.relative('.', RESULTS_PATH)} and ${path.relative('.', REPORT_PATH)}`);
}

main();
