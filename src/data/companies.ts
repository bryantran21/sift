// The curated company universe, organized by the tags you care about:
// quant · big-tech · fortune-500 (non-tech) · college. This is the browsing layer.
//
// `sources.yaml` is the *ingestable subset*: only companies with status 'live'
// (a working JSON board + an adapter that exists) belong there. Everything else is
// tracked here so you can see and organize the whole landscape, with an honest
// status for each:
//
//   live     — verified JSON board, adapter exists → ingesting now (Greenhouse/Workday).
//   pending  — on a supported ATS whose adapter is still coming (see `eta`).
//   blocked  — Oracle/Taleo/UCPath/custom careers site, no JSON API → out of scope.
//   unknown  — no board found at common slugs; ATS unconfirmed, needs a manual look.
//
// `domain` powers the row favicon (fetched + inlined by scripts/fetch-logos.ts).
// Job counts on `live` rows are from the last probe (2026-07) and drift over time.

export type CompanyTag = 'quant' | 'big-tech' | 'fortune-500' | 'college';
export type CompanyStatus = 'live' | 'pending' | 'blocked' | 'unknown';

export interface Company {
  name: string;
  tag: CompanyTag;
  industry?: string; // mainly for fortune-500 (airline, retail, bank, …)
  domain?: string; // for the favicon
  ats: string; // greenhouse | ashby | lever | workday | custom | unknown
  slug?: string; // set once we have a verified board
  status: CompanyStatus;
  eta?: string; // 'Live' | 'Phase 2' | 'Phase 7'
  tier: 1 | 2 | 3;
  jobs?: number | null; // last-probe open-role count, live boards only
  note?: string;
  // Workday only: coordinates read off the careers URL, needed to build its endpoint.
  tenant?: string;
  shard?: string;
  site?: string;
}

export const companies: Company[] = [
  // ── QUANT · live on Greenhouse ──────────────────────────────────────────────
  { name: 'Jane Street', tag: 'quant', domain: 'janestreet.com', ats: 'greenhouse', slug: 'janestreet', status: 'live', eta: 'Live', tier: 1, jobs: 216 },
  { name: 'Point72', tag: 'quant', domain: 'point72.com', ats: 'greenhouse', slug: 'point72', status: 'live', eta: 'Live', tier: 1, jobs: 232 },
  { name: 'IMC Trading', tag: 'quant', domain: 'imc.com', ats: 'greenhouse', slug: 'imc', status: 'live', eta: 'Live', tier: 1, jobs: 153 },
  { name: 'Jump Trading', tag: 'quant', domain: 'jumptrading.com', ats: 'greenhouse', slug: 'jumptrading', status: 'live', eta: 'Live', tier: 1, jobs: 98 },
  { name: 'WorldQuant', tag: 'quant', domain: 'worldquant.com', ats: 'greenhouse', slug: 'worldquant', status: 'live', eta: 'Live', tier: 2, jobs: 99 },
  { name: 'Tower Research Capital', tag: 'quant', domain: 'tower-research.com', ats: 'greenhouse', slug: 'towerresearchcapital', status: 'live', eta: 'Live', tier: 1, jobs: 79 },
  { name: 'Flow Traders', tag: 'quant', domain: 'flowtraders.com', ats: 'greenhouse', slug: 'flowtraders', status: 'live', eta: 'Live', tier: 2, jobs: 39 },
  { name: 'Virtu Financial', tag: 'quant', domain: 'virtu.com', ats: 'greenhouse', slug: 'virtu', status: 'live', eta: 'Live', tier: 2, jobs: 38 },
  { name: 'Akuna Capital', tag: 'quant', domain: 'akunacapital.com', ats: 'greenhouse', slug: 'akunacapital', status: 'live', eta: 'Live', tier: 2, jobs: 38 },
  { name: 'Old Mission Capital', tag: 'quant', domain: 'oldmissioncapital.com', ats: 'greenhouse', slug: 'oldmissioncapital', status: 'live', eta: 'Live', tier: 2, jobs: 32 },
  { name: 'Optiver', tag: 'quant', domain: 'optiver.com', ats: 'greenhouse', slug: 'optiver', status: 'live', eta: 'Live', tier: 1, jobs: 0, note: 'Live board, no open roles at last check.' },

  // ── QUANT · not reachable via a supported JSON API ──────────────────────────
  { name: 'Citadel', tag: 'quant', domain: 'citadel.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Citadel Securities', tag: 'quant', domain: 'citadelsecurities.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Two Sigma', tag: 'quant', domain: 'twosigma.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'D. E. Shaw', tag: 'quant', domain: 'deshaw.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Hudson River Trading', tag: 'quant', domain: 'hudson-trading.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Susquehanna (SIG)', tag: 'quant', domain: 'sig.com', ats: 'unknown', status: 'unknown', tier: 1, note: 'No Greenhouse board at common slugs; ATS unconfirmed.' },
  { name: 'DRW', tag: 'quant', domain: 'drw.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'ATS unconfirmed.' },
  { name: 'XTX Markets', tag: 'quant', domain: 'xtxmarkets.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'ATS unconfirmed.' },
  { name: 'Five Rings', tag: 'quant', domain: 'fiverings.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'ATS unconfirmed.' },
  { name: 'Radix Trading', tag: 'quant', domain: 'radix-trading.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'ATS unconfirmed.' },

  // ── BIG TECH · live on Greenhouse ───────────────────────────────────────────
  { name: 'Anthropic', tag: 'big-tech', domain: 'anthropic.com', ats: 'greenhouse', slug: 'anthropic', status: 'live', eta: 'Live', tier: 1, jobs: 412 },
  { name: 'Databricks', tag: 'big-tech', domain: 'databricks.com', ats: 'greenhouse', slug: 'databricks', status: 'live', eta: 'Live', tier: 1, jobs: 784 },
  { name: 'xAI', tag: 'big-tech', domain: 'x.ai', ats: 'greenhouse', slug: 'xai', status: 'live', eta: 'Live', tier: 1, jobs: 216 },
  { name: 'Scale AI', tag: 'big-tech', domain: 'scale.com', ats: 'greenhouse', slug: 'scaleai', status: 'live', eta: 'Live', tier: 1, jobs: 191 },
  { name: 'Stripe', tag: 'big-tech', domain: 'stripe.com', ats: 'greenhouse', slug: 'stripe', status: 'live', eta: 'Live', tier: 1, jobs: 520 },
  { name: 'Datadog', tag: 'big-tech', domain: 'datadoghq.com', ats: 'greenhouse', slug: 'datadog', status: 'live', eta: 'Live', tier: 2, jobs: 415 },
  { name: 'Cloudflare', tag: 'big-tech', domain: 'cloudflare.com', ats: 'greenhouse', slug: 'cloudflare', status: 'live', eta: 'Live', tier: 2, jobs: 261 },
  { name: 'Coinbase', tag: 'big-tech', domain: 'coinbase.com', ats: 'greenhouse', slug: 'coinbase', status: 'live', eta: 'Live', tier: 2, jobs: 151 },
  { name: 'Robinhood', tag: 'big-tech', domain: 'robinhood.com', ats: 'greenhouse', slug: 'robinhood', status: 'live', eta: 'Live', tier: 2, jobs: 115 },
  { name: 'Figma', tag: 'big-tech', domain: 'figma.com', ats: 'greenhouse', slug: 'figma', status: 'live', eta: 'Live', tier: 2, jobs: 172 },
  { name: 'Airbnb', tag: 'big-tech', domain: 'airbnb.com', ats: 'greenhouse', slug: 'airbnb', status: 'live', eta: 'Live', tier: 2, jobs: 198 },
  { name: 'Reddit', tag: 'big-tech', domain: 'reddit.com', ats: 'greenhouse', slug: 'reddit', status: 'live', eta: 'Live', tier: 2, jobs: 195 },
  { name: 'Vercel', tag: 'big-tech', domain: 'vercel.com', ats: 'greenhouse', slug: 'vercel', status: 'live', eta: 'Live', tier: 2, jobs: 73 },
  { name: 'SambaNova Systems', tag: 'big-tech', domain: 'sambanova.ai', ats: 'greenhouse', slug: 'sambanovasystems', status: 'live', eta: 'Live', tier: 2, jobs: 28 },
  { name: 'Discord', tag: 'big-tech', domain: 'discord.com', ats: 'greenhouse', slug: 'discord', status: 'live', eta: 'Live', tier: 2, jobs: 49 },
  { name: 'Okta', tag: 'big-tech', domain: 'okta.com', ats: 'greenhouse', slug: 'okta', status: 'live', eta: 'Live', tier: 3, jobs: 352 },
  { name: 'Samsara', tag: 'big-tech', domain: 'samsara.com', ats: 'greenhouse', slug: 'samsara', status: 'live', eta: 'Live', tier: 3, jobs: 332 },
  { name: 'Brex', tag: 'big-tech', domain: 'brex.com', ats: 'greenhouse', slug: 'brex', status: 'live', eta: 'Live', tier: 3, jobs: 260 },
  { name: 'Pinterest', tag: 'big-tech', domain: 'pinterest.com', ats: 'greenhouse', slug: 'pinterest', status: 'live', eta: 'Live', tier: 3, jobs: 190 },
  { name: 'Affirm', tag: 'big-tech', domain: 'affirm.com', ats: 'greenhouse', slug: 'affirm', status: 'live', eta: 'Live', tier: 3, jobs: 172 },
  { name: 'Twilio', tag: 'big-tech', domain: 'twilio.com', ats: 'greenhouse', slug: 'twilio', status: 'live', eta: 'Live', tier: 3, jobs: 168 },
  { name: 'GitLab', tag: 'big-tech', domain: 'gitlab.com', ats: 'greenhouse', slug: 'gitlab', status: 'live', eta: 'Live', tier: 3, jobs: 164 },
  { name: 'Lyft', tag: 'big-tech', domain: 'lyft.com', ats: 'greenhouse', slug: 'lyft', status: 'live', eta: 'Live', tier: 3, jobs: 152 },
  { name: 'Asana', tag: 'big-tech', domain: 'asana.com', ats: 'greenhouse', slug: 'asana', status: 'live', eta: 'Live', tier: 3, jobs: 140 },
  { name: 'Instacart', tag: 'big-tech', domain: 'instacart.com', ats: 'greenhouse', slug: 'instacart', status: 'live', eta: 'Live', tier: 3, jobs: 124 },
  { name: 'Gusto', tag: 'big-tech', domain: 'gusto.com', ats: 'greenhouse', slug: 'gusto', status: 'live', eta: 'Live', tier: 3, jobs: 74 },
  { name: 'Faire', tag: 'big-tech', domain: 'faire.com', ats: 'greenhouse', slug: 'faire', status: 'live', eta: 'Live', tier: 3, jobs: 72 },
  { name: 'Chime', tag: 'big-tech', domain: 'chime.com', ats: 'greenhouse', slug: 'chime', status: 'live', eta: 'Live', tier: 3, jobs: 67 },
  { name: 'Dropbox', tag: 'big-tech', domain: 'dropbox.com', ats: 'greenhouse', slug: 'dropbox', status: 'live', eta: 'Live', tier: 3, jobs: 35 },

  // ── BIG TECH · live via Workday (verified tenant/shard/site) ────────────────
  { name: 'NVIDIA', tag: 'big-tech', domain: 'nvidia.com', ats: 'workday', slug: 'nvidia', status: 'live', eta: 'Live', tier: 1, jobs: 2000, tenant: 'nvidia', shard: '5', site: 'NVIDIAExternalCareerSite' },
  { name: 'Salesforce', tag: 'big-tech', domain: 'salesforce.com', ats: 'workday', slug: 'salesforce', status: 'live', eta: 'Live', tier: 3, jobs: 1435, tenant: 'salesforce', shard: '12', site: 'External_Career_Site' },

  // ── BIG TECH · adapter pending (supported ATS, not yet built) ───────────────
  { name: 'OpenAI', tag: 'big-tech', domain: 'openai.com', ats: 'ashby', status: 'pending', eta: 'Phase 2', tier: 1, note: 'Ashby board — adapter lands in Phase 2.' },
  { name: 'Ramp', tag: 'big-tech', domain: 'ramp.com', ats: 'ashby', status: 'pending', eta: 'Phase 2', tier: 2, note: 'Ashby board — adapter lands in Phase 2.' },

  // ── BIG TECH · custom sites / unconfirmed ───────────────────────────────────
  { name: 'Google', tag: 'big-tech', domain: 'google.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Meta', tag: 'big-tech', domain: 'meta.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Amazon', tag: 'big-tech', domain: 'amazon.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Apple', tag: 'big-tech', domain: 'apple.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Microsoft', tag: 'big-tech', domain: 'microsoft.com', ats: 'custom', status: 'blocked', tier: 1, note: 'Custom careers site — no JSON board.' },
  { name: 'Snowflake', tag: 'big-tech', domain: 'snowflake.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'No Greenhouse board at common slugs; ATS unconfirmed.' },
  { name: 'DoorDash', tag: 'big-tech', domain: 'doordash.com', ats: 'unknown', status: 'unknown', tier: 3, note: 'ATS unconfirmed.' },
  { name: 'Plaid', tag: 'big-tech', domain: 'plaid.com', ats: 'unknown', status: 'unknown', tier: 3, note: 'ATS unconfirmed.' },
  { name: 'Notion', tag: 'big-tech', domain: 'notion.so', ats: 'unknown', status: 'unknown', tier: 2, note: 'ATS unconfirmed.' },
  { name: 'Netflix', tag: 'big-tech', domain: 'netflix.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'ATS unconfirmed.' },

  // ── COLLEGE · you'd work here ───────────────────────────────────────────────
  { name: 'Carnegie Mellon (CMU)', tag: 'college', domain: 'cmu.edu', ats: 'workday', slug: 'cmu', status: 'live', eta: 'Live', tier: 1, jobs: 203, tenant: 'cmu', shard: '5', site: 'CMU' },
  { name: 'Stanford University', tag: 'college', domain: 'stanford.edu', ats: 'oracle', status: 'blocked', tier: 1, note: 'University jobs are on Oracle/Taleo (careersearch.stanford.edu); only Stanford Healthcare is Workday.' },
  { name: 'Georgia Tech', tag: 'college', domain: 'gatech.edu', ats: 'unknown', status: 'unknown', tier: 2, note: 'Public postings appear to be on Trakstar; Workday tenant exists but its careers site is auth-gated (401).' },
  { name: 'UC Berkeley', tag: 'college', domain: 'berkeley.edu', ats: 'oracle', status: 'blocked', tier: 1, note: 'Staff jobs are on UCPath (Oracle), not a public Workday board.' },

  // ── FORTUNE 500 · non-tech (airlines, retail, banks, …) ─────────────────────
  // Most large enterprises run Workday (adapter: live — add tenant/shard/site) or
  // Taleo/iCIMS (out of scope). ATS per company is unconfirmed unless noted; each
  // needs a manual careers-URL check before it can move to 'live'.
  { name: 'Target', tag: 'fortune-500', industry: 'Retail', domain: 'target.com', ats: 'workday', slug: 'target', status: 'live', eta: 'Live', tier: 3, jobs: 2000, tenant: 'target', shard: '5', site: 'targetcareers' },
  { name: 'Mastercard', tag: 'fortune-500', industry: 'Payments', domain: 'mastercard.com', ats: 'workday', slug: 'mastercard', status: 'live', eta: 'Live', tier: 3, jobs: 1157, tenant: 'mastercard', shard: '1', site: 'CorporateCareers' },
  { name: 'Delta Air Lines', tag: 'fortune-500', industry: 'Airline', domain: 'delta.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'United Airlines', tag: 'fortune-500', industry: 'Airline', domain: 'united.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'American Airlines', tag: 'fortune-500', industry: 'Airline', domain: 'aa.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Southwest Airlines', tag: 'fortune-500', industry: 'Airline', domain: 'southwest.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Alaska Airlines', tag: 'fortune-500', industry: 'Airline', domain: 'alaskaair.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'JetBlue', tag: 'fortune-500', industry: 'Airline', domain: 'jetblue.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Walmart', tag: 'fortune-500', industry: 'Retail', domain: 'walmart.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Costco', tag: 'fortune-500', industry: 'Retail', domain: 'costco.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'The Home Depot', tag: 'fortune-500', industry: 'Retail', domain: 'homedepot.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: "Lowe's", tag: 'fortune-500', industry: 'Retail', domain: 'lowes.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Best Buy', tag: 'fortune-500', industry: 'Retail', domain: 'bestbuy.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Kroger', tag: 'fortune-500', industry: 'Retail', domain: 'kroger.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Walgreens', tag: 'fortune-500', industry: 'Retail', domain: 'walgreens.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'CVS Health', tag: 'fortune-500', industry: 'Retail/Health', domain: 'cvshealth.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Nike', tag: 'fortune-500', industry: 'Retail', domain: 'nike.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Starbucks', tag: 'fortune-500', industry: 'Retail/Food', domain: 'starbucks.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'JPMorgan Chase', tag: 'fortune-500', industry: 'Bank', domain: 'jpmorganchase.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'Large quant/eng org — worth verifying.' },
  { name: 'Bank of America', tag: 'fortune-500', industry: 'Bank', domain: 'bankofamerica.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Wells Fargo', tag: 'fortune-500', industry: 'Bank', domain: 'wellsfargo.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Goldman Sachs', tag: 'fortune-500', industry: 'Bank', domain: 'goldmansachs.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'Investment bank — quant-adjacent roles.' },
  { name: 'Morgan Stanley', tag: 'fortune-500', industry: 'Bank', domain: 'morganstanley.com', ats: 'unknown', status: 'unknown', tier: 2, note: 'Investment bank — quant-adjacent roles.' },
  { name: 'American Express', tag: 'fortune-500', industry: 'Finance', domain: 'americanexpress.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Capital One', tag: 'fortune-500', industry: 'Bank', domain: 'capitalone.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'AT&T', tag: 'fortune-500', industry: 'Telecom', domain: 'att.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Verizon', tag: 'fortune-500', industry: 'Telecom', domain: 'verizon.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Comcast', tag: 'fortune-500', industry: 'Telecom/Media', domain: 'comcast.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Marriott', tag: 'fortune-500', industry: 'Hospitality', domain: 'marriott.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Walt Disney', tag: 'fortune-500', industry: 'Media', domain: 'thewaltdisneycompany.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Ford', tag: 'fortune-500', industry: 'Automotive', domain: 'ford.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'General Motors', tag: 'fortune-500', industry: 'Automotive', domain: 'gm.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Boeing', tag: 'fortune-500', industry: 'Aerospace', domain: 'boeing.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'ExxonMobil', tag: 'fortune-500', industry: 'Energy', domain: 'exxonmobil.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'UnitedHealth Group', tag: 'fortune-500', industry: 'Healthcare', domain: 'unitedhealthgroup.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Pfizer', tag: 'fortune-500', industry: 'Pharma', domain: 'pfizer.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'PepsiCo', tag: 'fortune-500', industry: 'Food/CPG', domain: 'pepsico.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'Procter & Gamble', tag: 'fortune-500', industry: 'CPG', domain: 'pg.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'FedEx', tag: 'fortune-500', industry: 'Logistics', domain: 'fedex.com', ats: 'unknown', status: 'unknown', tier: 3 },
  { name: 'UPS', tag: 'fortune-500', industry: 'Logistics', domain: 'ups.com', ats: 'unknown', status: 'unknown', tier: 3 },
];

// Convenience selectors used by the ingest config and the browser generator.
export const liveCompanies = companies.filter((c) => c.status === 'live');

export function companyCounts() {
  const byTag = { quant: 0, 'big-tech': 0, 'fortune-500': 0, college: 0 } as Record<CompanyTag, number>;
  const byStatus = { live: 0, pending: 0, blocked: 0, unknown: 0 } as Record<CompanyStatus, number>;
  for (const c of companies) {
    byTag[c.tag]++;
    byStatus[c.status]++;
  }
  return { total: companies.length, byTag, byStatus };
}
