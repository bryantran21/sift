import { readFileSync } from 'node:fs';
import path from 'node:path';

// Base64 favicons from `pnpm build:logos`, loaded once server-side. Optional —
// companies without one fall back to a monogram in the UI.
let logos: Record<string, string> = {};
try {
  logos = JSON.parse(readFileSync(path.join(process.cwd(), 'src', 'data', 'logos.json'), 'utf8'));
} catch {
  logos = {};
}

export function logoFor(company: string): string | null {
  return logos[company] ?? null;
}
