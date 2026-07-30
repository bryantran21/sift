import type { Ats, AtsAdapter } from '../types';
import { greenhouseAdapter } from './greenhouse';
import { workdayAdapter } from './workday';
import { ashbyAdapter } from './ashby';
import { leverAdapter } from './lever';
import { amazonAdapter } from './amazon';

// Adapters are registered here as they land. Greenhouse, Workday, Ashby, and Lever
// are live generic adapters; Amazon is a bespoke per-company adapter. SmartRecruiters
// + Workable remain. Sources whose ATS has no adapter yet are skipped by the ingest
// run with a clear note, not treated as errors.
const adapters: Partial<Record<Ats, AtsAdapter>> = {
  greenhouse: greenhouseAdapter,
  workday: workdayAdapter,
  ashby: ashbyAdapter,
  lever: leverAdapter,
  amazon: amazonAdapter,
};

export function getAdapter(ats: Ats): AtsAdapter | undefined {
  return adapters[ats];
}

export function supportedAts(): Ats[] {
  return Object.keys(adapters) as Ats[];
}
