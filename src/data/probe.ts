import results from './probe-results.json';

// Output of `pnpm probe` (scripts/probe-ats.ts), keyed by registry company name. The
// registry (companies.ts) merges these over its hand-written entries, so probing a
// company is all it takes to record its board or its blocked status.
export interface ProbeResult {
  status: 'live' | 'workday' | 'blocked'; // 'workday' = any paginated enterprise board
  ats?: string;
  slug?: string;
  tenant?: string; // Workday coordinates
  shard?: string;
  site?: string; // Workday site · Eightfold domain param · Oracle siteNumber
  host?: string; // Eightfold / Oracle HCM API host
  jobs?: number; // job count at probe time
  platform?: string; // blocked: the careers platform detected (Radancy, iCIMS, …)
  via: 'existing-source' | 'careers-page' | 'slug-guess';
  careersUrl?: string;
  probedAt: string;
}

export const probeResults = results as Record<string, ProbeResult>;
