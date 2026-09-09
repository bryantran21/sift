import { eq, sql } from 'drizzle-orm';
import { getDb } from './client';
import { userProfile } from './schema';

export interface Profile {
  resumeSkills: string[];
  dreamCompanies: string[];
}

export async function getProfile(deviceId: string): Promise<Profile> {
  const db = getDb();
  const [row] = await db
    .select({ resumeSkills: userProfile.resumeSkills, dreamCompanies: userProfile.dreamCompanies })
    .from(userProfile)
    .where(eq(userProfile.deviceId, deviceId))
    .limit(1);
  return { resumeSkills: row?.resumeSkills ?? [], dreamCompanies: row?.dreamCompanies ?? [] };
}

export async function saveResumeSkills(deviceId: string, skills: string[]): Promise<void> {
  const db = getDb();
  await db
    .insert(userProfile)
    .values({ deviceId, resumeSkills: skills, resumeUpdatedAt: new Date() })
    .onConflictDoUpdate({
      target: userProfile.deviceId,
      set: { resumeSkills: skills, resumeUpdatedAt: sql`now()`, updatedAt: sql`now()` },
    });
}

export async function saveDreamCompanies(deviceId: string, companies: string[]): Promise<void> {
  const db = getDb();
  await db
    .insert(userProfile)
    .values({ deviceId, dreamCompanies: companies })
    .onConflictDoUpdate({
      target: userProfile.deviceId,
      set: { dreamCompanies: companies, updatedAt: sql`now()` },
    });
}
