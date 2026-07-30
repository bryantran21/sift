import logosData from '../data/logos.json';

// Base64 favicons from `pnpm build:logos`, imported statically so they're bundled
// into the server build and available at runtime on Vercel (a runtime fs read of
// the JSON isn't reliably included in the serverless output). Optional per company —
// misses fall back to a monogram in the UI.
const logos = logosData as Record<string, string>;

export function logoFor(company: string): string | null {
  return logos[company] ?? null;
}
