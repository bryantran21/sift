// The industry taxonomy every company (and therefore every job) is labeled with.
// Kept free of other imports so client components can use the labels cheaply.
export const INDUSTRIES = {
  tech: 'Tech & Software',
  semis: 'Semiconductors & Hardware',
  gaming: 'Gaming',
  quant: 'Trading & Quant',
  finance: 'Banking & Finance',
  insurance: 'Insurance',
  consulting: 'Consulting & Services',
  retail: 'Retail',
  food: 'Food & Beverage',
  consumer: 'Consumer Brands',
  media: 'Media & Entertainment',
  telecom: 'Telecom',
  airlines: 'Airlines',
  travel: 'Travel & Hospitality',
  auto: 'Automotive & Mobility',
  aerospace: 'Aerospace & Defense',
  industrial: 'Industrials & Manufacturing',
  energy: 'Energy & Utilities',
  health: 'Healthcare & Pharma',
  logistics: 'Logistics & Transport',
  education: 'Education & Research',
} as const;

export type Industry = keyof typeof INDUSTRIES;

export const INDUSTRY_KEYS = Object.keys(INDUSTRIES) as Industry[];

export function isIndustry(v: unknown): v is Industry {
  return typeof v === 'string' && v in INDUSTRIES;
}

export function industryLabel(v: string | null | undefined): string {
  return v && isIndustry(v) ? INDUSTRIES[v] : INDUSTRIES.tech;
}
