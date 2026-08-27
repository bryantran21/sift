import { getCompanyFit } from '../../../db/fit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Takes the résumé's already-extracted skills (the raw résumé stays in the browser)
// and returns per-company fit scores.
export async function POST(req: Request) {
  let skills: unknown;
  try {
    ({ skills } = await req.json());
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (!Array.isArray(skills) || skills.some((s) => typeof s !== 'string')) {
    return new Response('skills must be a string[]', { status: 400 });
  }
  const fits = await getCompanyFit(skills as string[]);
  return Response.json({ fits });
}
