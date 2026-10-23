import logosData from '../data/logos.json';
import { findCompany } from '../data/companies';

// Base64 favicons from `pnpm build:logos`, imported statically so they're bundled
// into the server build and available at runtime on Vercel (a runtime fs read of
// the JSON isn't reliably included in the serverless output). Optional per company —
// misses fall back to a monogram in the UI.
const logos = logosData as Record<string, string>;

// Exact name first, then the registry entry the name resolves to (sources spell
// companies inconsistently: "… (LLNL)", "The Home Depot", aliases like "Burger King").
export function logoFor(company: string): string | null {
  if (logos[company]) return logos[company];
  const c = findCompany(company);
  return (c && logos[c.name]) ?? null;
}
