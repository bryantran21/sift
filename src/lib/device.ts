import { cookies } from 'next/headers';

// The opaque per-device id set by middleware. Keys the durable per-device profile /
// OA log in Postgres. Null only on the very first request before the cookie round-trips.
export async function getDeviceId(): Promise<string | null> {
  return (await cookies()).get('sift_device')?.value ?? null;
}

// The company watchlist the feed filters mirror into a cookie (feed-filters.tsx). Empty
// when unset, malformed, or explicitly cleared.
export async function savedWatchlist(): Promise<string[]> {
  const raw = (await cookies()).get('sift_watchlist')?.value;
  if (!raw) return [];
  try {
    const list = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 200) : [];
  } catch {
    return [];
  }
}
