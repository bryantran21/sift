// Downloads each company's favicon and writes them, base64-inlined, to
// src/data/logos.json (keyed by company name). The browser generator embeds these
// as data: URIs so the published artifact shows real icons without any external
// request (its sandbox blocks remote images). Monogram fallback covers misses.
//
//   pnpm build:logos
//
// Uses Google's favicon service, which returns a clean 64px PNG for most domains.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { companies } from '../src/data/companies';
import { mapLimit, jitter } from '../src/lib/concurrency';

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

async function fetchLogo(domain: string): Promise<string | null> {
  try {
    await jitter(150);
    const res = await fetch(faviconUrl(domain), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 80) return null; // too small to be a real icon
    const type = res.headers.get('content-type') ?? 'image/png';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function main() {
  const targets = companies
    .filter((c) => c.domain)
    .map((c) => ({ name: c.name, domain: c.domain! }));

  let ok = 0;
  const logos: Record<string, string> = {};
  await mapLimit(targets, 8, async (t) => {
    const uri = await fetchLogo(t.domain);
    if (uri) {
      logos[t.name] = uri;
      ok++;
    }
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(here, '..', 'src', 'data', 'logos.json');
  writeFileSync(outPath, JSON.stringify(logos, null, 0), 'utf8');
  console.log(`wrote ${outPath}: ${ok}/${targets.length} logos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
