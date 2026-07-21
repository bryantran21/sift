import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';
import type { Source } from '../types';

// sources.yaml is the primary asset of the project, so validate it strictly and
// fail with a readable message rather than letting a typo silently drop a company.

const sourceSchema = z.object({
  company: z.string().min(1),
  ats: z.enum(['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'workday']),
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

function defaultSourcesPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, '..', '..', 'sources.yaml');
}

export function loadSources(filePath?: string): Source[] {
  const resolved = filePath ?? defaultSourcesPath();
  const raw = readFileSync(resolved, 'utf8');
  const parsed = load(raw);

  const result = fileSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - [${i.path.join('.') || 'root'}] ${i.message}`)
      .join('\n');
    throw new Error(`Invalid sources.yaml:\n${details}`);
  }

  const sources = result.data.map(
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

  // Workday needs all three coordinates or its POST endpoint can't be built.
  for (const s of sources) {
    if (s.ats === 'workday' && (!s.tenant || !s.shard || !s.site)) {
      throw new Error(
        `Workday source "${s.company}" needs tenant, shard, and site (from the careers URL).`,
      );
    }
  }

  // Guard against accidental duplicate boards.
  const seen = new Set<string>();
  for (const s of sources) {
    const key = `${s.ats}:${s.slug}`;
    if (seen.has(key)) throw new Error(`Duplicate source in sources.yaml: ${key}`);
    seen.add(key);
  }

  return sources;
}
