import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_REFRESH, COOKIE_ROLE } from '@/lib/constants';
import { ADMIN_LOGIN, PROTECTED_PREFIXES, ROLE_HOME, isRole, loginPathFor } from '@/lib/roles';

/**
 * Routes users before render. This is a UX layer only: the role cookie is client-written,
 * so the Django API remains the only real access control.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE_REFRESH)?.value);
  const roleValue = req.cookies.get(COOKIE_ROLE)?.value;
  const home = isRole(roleValue) ? ROLE_HOME[roleValue] : null;

  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (pathname === '/') return go(hasSession && home ? home : '/login');

  // Only login/register bounce signed-in users. Reset-password and verify-email links must keep working.
  if (pathname === '/login' || pathname === '/register') {
    return hasSession && home ? go(home) : NextResponse.next();
  }

  // Restaurant-team sign-in: open to everyone, but it sends signed-in team members straight to their own area.
  // A signed-in customer may still open it (to switch to a team account).
  if (pathname === ADMIN_LOGIN) {
    return hasSession && home && roleValue !== 'CUSTOMER' ? go(home) : NextResponse.next();
  }

  const area = PROTECTED_PREFIXES.find((p) => pathname === p || pathname.startsWith(p + '/'));
  if (area) {
    if (!hasSession) return go(`${loginPathFor(pathname)}?next=${encodeURIComponent(pathname)}`);
    if (home && area !== home) return go(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/register', '/customer/:path*', '/owner/:path*', '/kitchen/:path*', '/driver/:path*', '/admin/:path*'],
};
