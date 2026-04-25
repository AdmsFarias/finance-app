import { NextResponse, type NextRequest } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from './lib/server/cookies';

/**
 * Simple auth gate:
 *  - If the route is public or an asset, let it through.
 *  - If neither access nor refresh is present, redirect to /login preserving the destination in ?next=
 *  - If at least one of them is present, let it through (the server component/route will attempt
 *    automatic refresh via lib/api/server.ts).
 *
 * i18n does not use a URL prefix — locale is resolved server-side via cookie/header in lib/i18n/request.ts.
 */

/**
 * Public routes that ALSO accept a logged-in user (e.g. accept invite).
 * Auth-only routes are handled separately in isAuthOnlyPath.
 */
const PUBLIC_PREFIXES = ['/invites'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasAccess = !!req.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefresh = !!req.cookies.get(REFRESH_COOKIE)?.value;
  const authenticated = hasAccess || hasRefresh;

  if (isAuthOnlyPath(pathname)) {
    // user already logged in on /login, /signup, etc — send them to the dashboard
    if (authenticated) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (authenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', req.url);
  const target = pathname + req.nextUrl.search;
  if (target !== '/' && target !== '/login') {
    loginUrl.searchParams.set('next', target);
  }
  return NextResponse.redirect(loginUrl);
}

/** Routes that only make sense for non-logged-in visitors. */
function isAuthOnlyPath(path: string): boolean {
  const authOnly = ['/login', '/signup', '/forgot-password', '/reset-password'];
  return authOnly.some((p) => path === p || path.startsWith(`${p}/`));
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export const config = {
  matcher: [
    /*
     * Excludes:
     *  - /api/* (the proxy handles its own auth)
     *  - /_next/* (build assets)
     *  - favicon and static files
     */
    '/((?!api/|_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
