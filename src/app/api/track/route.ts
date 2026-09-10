import { getDeviceId } from '../../../lib/device';
import { logEvent, getEvents, getCooldownStatuses, deleteEvent } from '../../../db/events';
import type { ApplicationEventType } from '../../../db/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPES: ApplicationEventType[] = ['applied', 'oa', 'interview', 'rejected', 'offer'];

async function payload(deviceId: string) {
  const [events, cooldowns] = await Promise.all([getEvents(deviceId), getCooldownStatuses(deviceId)]);
  return Response.json({ events, cooldowns });
}

export async function GET() {
  const deviceId = await getDeviceId();
  if (!deviceId) return Response.json({ events: [], cooldowns: [] });
  return payload(deviceId);
}

export async function POST(req: Request) {
  const deviceId = await getDeviceId();
  if (!deviceId) return new Response('no device id', { status: 400 });
  let body: { company?: unknown; type?: unknown; eventAt?: unknown; notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const type = body.type as ApplicationEventType;
  if (!company || !TYPES.includes(type)) {
    return new Response('company and a valid type are required', { status: 400 });
  }
  const eventAt = body.eventAt ? new Date(body.eventAt as string) : new Date();
  if (Number.isNaN(eventAt.getTime())) return new Response('bad date', { status: 400 });
  await logEvent(deviceId, company, type, eventAt, typeof body.notes === 'string' ? body.notes : undefined);
  return payload(deviceId);
}

export async function DELETE(req: Request) {
  const deviceId = await getDeviceId();
  if (!deviceId) return new Response('no device id', { status: 400 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return new Response('id required', { status: 400 });
  await deleteEvent(deviceId, id);
  return payload(deviceId);
}
