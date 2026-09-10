import { and, desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import { applicationEvents, type ApplicationEventType } from './schema';
import { computeCooldown, type CooldownStatus } from '../data/cooldowns';

export interface TrackedEvent {
  id: number;
  company: string;
  type: ApplicationEventType;
  eventAt: string; // ISO
  notes: string | null;
}

export async function logEvent(
  deviceId: string,
  company: string,
  type: ApplicationEventType,
  eventAt: Date,
  notes?: string,
): Promise<void> {
  const db = getDb();
  await db.insert(applicationEvents).values({ deviceId, company, type, eventAt, notes: notes ?? null });
}

export async function deleteEvent(deviceId: string, id: number): Promise<void> {
  const db = getDb();
  await db
    .delete(applicationEvents)
    .where(and(eq(applicationEvents.id, id), eq(applicationEvents.deviceId, deviceId)));
}

export async function getEvents(deviceId: string): Promise<TrackedEvent[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: applicationEvents.id,
      company: applicationEvents.company,
      type: applicationEvents.type,
      eventAt: applicationEvents.eventAt,
      notes: applicationEvents.notes,
    })
    .from(applicationEvents)
    .where(eq(applicationEvents.deviceId, deviceId))
    .orderBy(desc(applicationEvents.eventAt));
  return rows.map((r) => ({ ...r, eventAt: r.eventAt.toISOString() }));
}

// Cooldown status per tracked company (active ones first, then by soonest end).
export async function getCooldownStatuses(deviceId: string): Promise<CooldownStatus[]> {
  const events = await getEvents(deviceId);
  const byCompany = new Map<string, TrackedEvent[]>();
  for (const e of events) {
    const arr = byCompany.get(e.company) ?? [];
    arr.push(e);
    byCompany.set(e.company, arr);
  }
  const out: CooldownStatus[] = [];
  for (const [company, evs] of byCompany) {
    const c = computeCooldown(company, evs);
    if (c) out.push(c);
  }
  out.sort(
    (a, b) => Number(b.active) - Number(a.active) || new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime(),
  );
  return out;
}
