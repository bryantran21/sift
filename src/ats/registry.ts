import type { Ats, AtsAdapter } from '../types';
import { greenhouseAdapter } from './greenhouse';
import { workdayAdapter } from './workday';

// Adapters are registered here as they land. Greenhouse (Phase 1) and Workday
// (pulled forward) are live; the remaining GET adapters (Lever, Ashby,
// SmartRecruiters, Workable) arrive in Phase 2. Sources whose ATS has no adapter
// yet are skipped by the ingest run with a clear note, not treated as errors.
const adapters: Partial<Record<Ats, AtsAdapter>> = {
  greenhouse: greenhouseAdapter,
  workday: workdayAdapter,
};

export function getAdapter(ats: Ats): AtsAdapter | undefined {
  return adapters[ats];
}

export function supportedAts(): Ats[] {
  return Object.keys(adapters) as Ats[];
}
