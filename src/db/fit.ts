import { sql } from 'drizzle-orm';
import { getDb } from './client';

// "Target-company readiness": score how well a résumé's skills match each company's
// aggregate skill demand, computed from the skills already extracted onto every live
// tech+US role (jobs.skills). Pure data — no LLM. Both sides use the same lexicon
// (src/scoring/skills.ts), so labels line up exactly.

export interface CompanyFit {
  company: string;
  score: number; // 0–100: weighted share of the company's most-wanted skills you have
  roleCount: number;
  matched: string[]; // your skills the company wants most
  gaps: string[]; // most-wanted skills you're missing
}

const TOP_K = 15; // score against each company's 15 most-demanded skills
const MIN_ROLES = 3; // ignore companies with too little signal

export async function getCompanyFit(resumeSkills: string[]): Promise<CompanyFit[]> {
  const db = getDb();
  const resume = new Set(resumeSkills);

  const live = sql`removed_at is null and category <> 'other' and country = 'US'
    and coalesce(posted_at, first_seen_at) >= now() - interval '45 days'`;

  const skillRows = (await db.execute(sql`
    select company, skill, count(*)::int as n
    from jobs, jsonb_array_elements_text(skills) as skill
    where ${live}
    group by company, skill
  `)) as unknown as Array<{ company: string; skill: string; n: number }>;

  const roleRows = (await db.execute(sql`
    select company, count(*)::int as n from jobs where ${live} group by company
  `)) as unknown as Array<{ company: string; n: number }>;
  const roleCount = new Map<string, number>();
  for (const r of roleRows) roleCount.set(r.company, r.n);

  const byCompany = new Map<string, Array<{ skill: string; n: number }>>();
  for (const r of skillRows) {
    const arr = byCompany.get(r.company) ?? [];
    arr.push({ skill: r.skill, n: r.n });
    byCompany.set(r.company, arr);
  }

  const out: CompanyFit[] = [];
  for (const [company, skills] of byCompany) {
    const roles = roleCount.get(company) ?? 0;
    if (roles < MIN_ROLES) continue;
    const top = skills.sort((a, b) => b.n - a.n).slice(0, TOP_K);
    const totalDemand = top.reduce((s, x) => s + x.n, 0);
    if (totalDemand === 0) continue;

    let matchedWeight = 0;
    const matched: string[] = [];
    const gaps: string[] = [];
    for (const { skill, n } of top) {
      if (resume.has(skill)) {
        matchedWeight += n;
        matched.push(skill);
      } else {
        gaps.push(skill);
      }
    }
    out.push({
      company,
      score: Math.round((matchedWeight / totalDemand) * 100),
      roleCount: roles,
      matched: matched.slice(0, 8),
      gaps: gaps.slice(0, 5),
    });
  }

  out.sort((a, b) => b.score - a.score || b.roleCount - a.roleCount);
  return out.slice(0, 60);
}
