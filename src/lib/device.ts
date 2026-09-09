import { cookies } from 'next/headers';

// The opaque per-device id set by middleware. Keys the durable per-device profile /
// OA log in Postgres. Null only on the very first request before the cookie round-trips.
export async function getDeviceId(): Promise<string | null> {
  return (await cookies()).get('sift_device')?.value ?? null;
}
