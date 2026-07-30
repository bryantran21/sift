import { getJobDetail } from '../../../../db/job';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getJobDetail(id);
  if (!detail) return new Response('Not found', { status: 404 });
  return Response.json(detail);
}
