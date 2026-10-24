import { getGroupMembers } from '../../../db/feed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/group?company=Amazon&base=software%20development%20engineer
// → every live posting in that group (the drawer's expanded view).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const company = u.searchParams.get('company');
  const base = u.searchParams.get('base');
  if (!company || !base) return new Response('company and base are required', { status: 400 });
  return Response.json({ members: await getGroupMembers(company, base) });
}
