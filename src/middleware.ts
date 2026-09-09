import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Assign a durable, opaque device id on first visit. It keys the per-device profile,
// OA log, etc. in Postgres (server-side durable — survives cache clears, unlike
// localStorage). Later this can be linked to a real account on login.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get('sift_device')?.value) {
    res.cookies.set('sift_device', crypto.randomUUID(), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 5, // 5 years
    });
  }
  return res;
}

// Run on pages + API, skip static assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
};
