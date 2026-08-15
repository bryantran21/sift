import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';
import type { Source } from '../types';

// sources.yaml is the primary asset of the project, so validate it strictly and
// fail with a readable message rather than letting a typo silently drop a company.

const sourceSchema = z.object({
  company: z.string().min(1),
  ats: z.enum(['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'workday', 'amazon', 'netflix']),
  slug: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  // Workday coordinates (only meaningful for ats: workday).
  tenant: z.string().optional(),
  shard: z.string().optional(),
  site: z.string().optional(),
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
      tenant: s.tenant,
      shard: s.shard,
      site: s.site,
    }),
  );
}

// Curated sources.yaml (hand-maintained) plus an optional machine-generated
// sources.generated.yaml (from scripts/import-sources.ts). Curated wins on any
// (ats:slug) conflict; the generated set fills out coverage in bulk.
export function loadSources(filePath?: string): Source[] {
  const curated = parseSourcesFile(filePath ?? rootPath('sources.yaml'), 'sources.yaml');

  let generated: Source[] = [];
  const genPath = rootPath('sources.generated.yaml');
  if (!filePath && existsSync(genPath)) {
    generated = parseSourcesFile(genPath, 'sources.generated.yaml');
  }

  // Merge + dedupe by ats:slug (curated first → curated wins).
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const s of [...curated, ...generated]) {
    const key = `${s.ats}:${s.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(s);
  }

  // Workday needs all three coordinates or its POST endpoint can't be built.
  for (const s of sources) {
    if (s.ats === 'workday' && (!s.tenant || !s.shard || !s.site)) {
      throw new Error(
        `Workday source "${s.company}" needs tenant, shard, and site (from the careers URL).`,
      );
    }
  }

  return sources;
}
