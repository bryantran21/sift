import type { Ats, AtsAdapter } from '../types';
import { greenhouseAdapter } from './greenhouse';
import { workdayAdapter } from './workday';
import { ashbyAdapter } from './ashby';
import { leverAdapter } from './lever';
import { amazonAdapter } from './amazon';
import { netflixAdapter } from './netflix';
import { smartRecruitersAdapter } from './smartrecruiters';
import { eightfoldAdapter } from './eightfold';
import { oracleHcmAdapter } from './oraclehcm';
import { phenomAdapter } from './phenom';

// Adapters are registered here as they land. Greenhouse, Workday, Ashby, Lever,
// SmartRecruiters, Eightfold, Oracle HCM and Phenom are generic adapters; Amazon + Netflix are
// bespoke per-company adapters. Workable remains. Sources whose ATS has no adapter yet are
// skipped by the ingest run with a clear note, not treated as errors.
const adapters: Partial<Record<Ats, AtsAdapter>> = {
  greenhouse: greenhouseAdapter,
  workday: workdayAdapter,
  ashby: ashbyAdapter,
  lever: leverAdapter,
  amazon: amazonAdapter,
  netflix: netflixAdapter,
  smartrecruiters: smartRecruitersAdapter,
  eightfold: eightfoldAdapter,
  oraclehcm: oracleHcmAdapter,
  phenom: phenomAdapter,
};

export function getAdapter(ats: Ats): AtsAdapter | undefined {
  return adapters[ats];
}

export function supportedAts(): Ats[] {
  return Object.keys(adapters) as Ats[];
}
