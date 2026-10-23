import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';
import type { Ats, Source } from '../types';
import { companies, findCompany, industryOf } from '../data/companies';
import { isRejectedBoard } from './rejected-boards';

// sources.yaml is the primary asset of the project, so validate it strictly and
// fail with a readable message rather than letting a typo silently drop a company.

const sourceSchema = z.object({
  company: z.string().min(1),
  ats: z.enum([
    'greenhouse',
    'lever',
    'ashby',
    'smartrecruiters',
    'workable',
    'workday',
    'eightfold',
    'oraclehcm',
    'phenom',
    'amazon',
    'netflix',
  ]),
  slug: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  // Optional industry override (src/data/industries.ts); normally resolved from the registry.
  industry: z.string().optional(),
  // Workday / Eightfold / Oracle: query these terms instead of paging the whole board.
  search: z.array(z.string()).optional(),
  // Workday coordinates.
  tenant: z.string().optional(),
  shard: z.string().optional(),
  // Board id within the platform: Workday site, Eightfold domain param, Oracle siteNumber.
  site: z.string().optional(),
  // Eightfold / Oracle HCM API host.
  host: z.string().optional(),
});

const fileSchema = z.array(sourceSchema);

function rootPath(name: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, '..', '..', name);
}

function parseSourcesFile(resolved: string, label: string): Source[] {
  const parsed = load(readFileSync(resolved, 'utf8'));
  const result = fileSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - [${i.path.join('.') || 'root'}] ${i.message}`)
      .join('\n');
    throw new Error(`Invalid ${label}:\n${details}`);
  }
  return result.data.map(
    (s): Source => ({
      company: s.company,
      ats: s.ats,
      slug: s.slug,
      tier: s.tier,
      tags: s.tags,
      enabled: s.enabled,
      industry: s.industry,
      search: s.search,
      tenant: s.tenant,
      shard: s.shard,
      site: s.site,
      host: s.host,
    }),
  );
}

// Adapters a registry company can be auto-wired to (bespoke amazon/netflix stay in YAML).
const REGISTRY_ATS: Ats[] = [
  'greenhouse',
  'lever',
  'ashby',
  'smartrecruiters',
  'workday',
  'eightfold',
  'oraclehcm',
  'phenom',
];
// Paginated enterprise platforms where a non-tech giant's board is mostly store,
// warehouse, or nursing roles — those get tech search terms instead of the whole board.
const SEARCHABLE_ATS = new Set<Ats>(['workday', 'eightfold', 'oraclehcm', 'phenom']);

// Non-tech giants list thousands of roles (stores, warehouses, nursing) and the page cap
// would fill with them. For those, query tech terms directly instead.
export const TECH_SEARCH = [
  'software',
  'developer',
  'data engineer',
  'data scientist',
  'machine learning',
  'cloud',
  'devops',
  'cybersecurity',
];
const TECH_INDUSTRIES = new Set(['tech', 'semis', 'gaming', 'quant']);

// Registry companies with a verified board (`pnpm probe` → src/data/probe-results.json)
// become sources automatically — adding a company is: add it to src/data/brands.ts, run
// `pnpm probe "<Name>"`, commit. No YAML editing.
export function registrySources(): Source[] {
  const out: Source[] = [];
  for (const c of companies) {
    const ats = c.ats as Ats;
    if (c.status !== 'live' || !c.slug || !REGISTRY_ATS.includes(ats)) continue;
    if (missingCoords({ ats, tenant: c.tenant, shard: c.shard, site: c.site, host: c.host })) continue;
    const industry = industryOf(c);
    out.push({
      company: c.name,
      ats,
      slug: c.slug,
      tier: c.tier,
      tags: [c.tag],
      enabled: true,
      industry,
      tenant: c.tenant,
      shard: c.shard,
      site: c.site,
      host: c.host,
      search: SEARCHABLE_ATS.has(ats) && !TECH_INDUSTRIES.has(industry) ? TECH_SEARCH : undefined,
    });
  }
  return out;
}

// Three layers, highest precedence first:
//   1. sources.yaml            — hand-curated boards (and bespoke adapters)
//   2. the company registry    — boards verified by `pnpm probe`
//   3. sources.generated.yaml  — bulk startup boards from scripts/import-sources.ts
// Deduped by ats:slug, and a registry company already covered by a curated board is
// skipped so the same company is never ingested twice under different slugs.
export function loadSources(filePath?: string): Source[] {
  const curated = parseSourcesFile(filePath ?? rootPath('sources.yaml'), 'sources.yaml');
  if (filePath) return validate(curated); // explicit file → that file only (import script)

  const generated = generatedSources();

  const curatedCompanies = new Set(
    curated.map((s) => findCompany(s.company)?.name).filter((n): n is string => !!n),
  );
  const registry = registrySources().filter((s) => !curatedCompanies.has(s.company));

  return validate(dedupe([...curated, ...registry, ...generated]));
}

// The YAML layers only (curated + generated), without the registry. The probe uses this
// to find a company's existing board without counting its own earlier results.
export function yamlSources(): Source[] {
  const curated = parseSourcesFile(rootPath('sources.yaml'), 'sources.yaml');
  return dedupe([...curated, ...generatedSources()]);
}

function generatedSources(): Source[] {
  const genPath = rootPath('sources.generated.yaml');
  return existsSync(genPath) ? parseSourcesFile(genPath, 'sources.generated.yaml') : [];
}

// Dedupe by ats:slug (first wins) and drop reviewed-and-rejected boards.
function dedupe(list: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of list) {
    const key = `${s.ats}:${s.slug}`;
    if (seen.has(key) || isRejectedBoard(s.ats, s.slug)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// Platforms whose API URL needs coordinates beyond the slug.
function missingCoords(s: Pick<Source, 'ats' | 'tenant' | 'shard' | 'site' | 'host'>): string | null {
  if (s.ats === 'workday' && (!s.tenant || !s.shard || !s.site)) return 'tenant, shard, and site';
  if ((s.ats === 'eightfold' || s.ats === 'oraclehcm' || s.ats === 'phenom') && (!s.host || !s.site)) {
    return 'host and site';
  }
  return null;
}

function validate(sources: Source[]): Source[] {
  for (const s of sources) {
    const missing = missingCoords(s);
    if (missing) throw new Error(`${s.ats} source "${s.company}" needs ${missing} (from the careers URL).`);
  }
  return sources;
}
