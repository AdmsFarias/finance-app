import { NextResponse, type NextRequest } from 'next/server';

import {
  apiInternalUrl,
  extractRefreshFromSetCookie,
  refreshWithRawToken,
} from '@/lib/server/api-internal';
import {
  ACCESS_COOKIE,
  ACTIVE_GROUP_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from '@/lib/server/cookies';

import type { AuthResponseDto } from '@finance/common';

/**
 * Generic BFF proxy: /api/proxy/<anything> -> API_INTERNAL_URL/<anything>
 *
 * Responsibilities:
 *  - Inject Authorization Bearer by reading the httpOnly fin_at cookie
 *  - Intercept /auth/login|register|refresh: persist accessToken into the cookie,
 *    re-emit the refresh received from the API as a web cookie (path /api/proxy/auth),
 *    and strip the accessToken from the body returned to the browser
 *  - Intercept /auth/logout: clear both cookies
 *  - Transparent refresh on 401 (when not an auth route), retrying once
 */

type Params = { params: Promise<{ path: string[] }> };

const FORWARD_REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-type',
  'x-request-id',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'set-cookie',
]);

export async function GET(req: NextRequest, ctx: Params) {
  return handle(req, ctx);
}
export async function POST(req: NextRequest, ctx: Params) {
  return handle(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: Params) {
  return handle(req, ctx);
}
export async function PUT(req: NextRequest, ctx: Params) {
  return handle(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: Params) {
  return handle(req, ctx);
}

async function handle(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { path } = await params;
  const targetPath = `/${path.join('/')}`;
  const search = req.nextUrl.search;
  const url = apiInternalUrl(`${targetPath}${search}`);

  const isAuthLogin = matches(targetPath, ['/auth/login', '/auth/register']);
  const isAuthRefresh = matches(targetPath, ['/auth/refresh']);
  const isAuthLogout = matches(targetPath, ['/auth/logout']);

  // body is read once; needs to be reusable for the post-refresh retry
  const bodyBuffer = ['GET', 'HEAD'].includes(req.method)
    ? undefined
    : await req.arrayBuffer();

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const activeGroup = req.cookies.get(ACTIVE_GROUP_COOKIE)?.value;

  // For /auth/refresh the browser doesn't have the fin_rt cookie (path-restricted to the proxy),
  // but since this route IS the proxy, Next attaches the cookie automatically.
  // Same for /auth/logout.
  const upstreamCookie = buildUpstreamCookieHeader(refresh, isAuthRefresh || isAuthLogout);

  const upstream = await doUpstream(url, req.method, req.headers, bodyBuffer, access, upstreamCookie, activeGroup);

  const isMutatingApi = !isAuthLogin && !isAuthRefresh && !isAuthLogout;
  if (upstream.status === 401 && isMutatingApi && refresh) {
    // try refresh once, queue cookies to apply on the response, and retry
    const refreshed = await refreshWithRawToken(refresh);
    if (refreshed) {
      const retry = await doUpstream(
        url,
        req.method,
        req.headers,
        bodyBuffer,
        refreshed.auth.accessToken,
        undefined,
        activeGroup,
      );
      return finishResponse(retry, {
        setAccess: {
          token: refreshed.auth.accessToken,
          expiresIn: refreshed.auth.expiresIn,
        },
        setRefresh: { token: refreshed.nextRefresh },
      });
    }
    // refresh failed: clear cookies and let the 401 propagate
    return finishResponse(upstream, { clearAuth: true });
  }

  if (isAuthLogin || isAuthRefresh) {
    const authBody = await upstream.clone().json() as AuthResponseDto | { code?: string };
    if (upstream.ok && 'accessToken' in authBody) {
      const apiRefresh = extractRefreshFromSetCookie(upstream.headers.get('set-cookie'));
      return writeAuthResponse(upstream.status, authBody, apiRefresh?.value ?? null);
    }
    return finishResponse(upstream, {});
  }

  if (isAuthLogout) {
    return finishResponse(upstream, { clearAuth: true });
  }

  return finishResponse(upstream, {});
}

function matches(path: string, list: string[]): boolean {
  return list.some((p) => path === p || path.startsWith(`${p}/`));
}

function buildUpstreamCookieHeader(
  refresh: string | undefined,
  includeRefresh: boolean,
): string | undefined {
  if (includeRefresh && refresh) {
    return `fin_rt=${refresh}`;
  }
  return undefined;
}

async function doUpstream(
  url: string,
  method: string,
  incoming: Headers,
  body: ArrayBuffer | undefined,
  accessToken: string | undefined,
  upstreamCookie: string | undefined,
  activeGroup: string | undefined,
): Promise<Response> {
  const headers = new Headers();
  for (const [k, v] of incoming) {
    if (FORWARD_REQUEST_HEADERS.has(k.toLowerCase())) {
      headers.set(k, v);
    }
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (upstreamCookie) headers.set('Cookie', upstreamCookie);
  // The client cannot choose X-Group-Id — only the httpOnly cookie defines the scope.
  if (activeGroup) headers.set('X-Group-Id', activeGroup);

  return fetch(url, {
    method,
    headers,
    body: body ?? undefined,
    cache: 'no-store',
    redirect: 'manual',
  });
}

interface FinishOptions {
  setAccess?: { token: string; expiresIn: number };
  setRefresh?: { token: string };
  clearAuth?: boolean;
}

async function finishResponse(upstream: Response, opts: FinishOptions): Promise<NextResponse> {
  const bodyBuffer = await upstream.arrayBuffer();
  const res = new NextResponse(bodyBuffer.byteLength ? bodyBuffer : null, {
    status: upstream.status,
    statusText: upstream.statusText,
  });
  for (const [k, v] of upstream.headers) {
    if (!STRIPPED_RESPONSE_HEADERS.has(k.toLowerCase())) {
      res.headers.set(k, v);
    }
  }
  if (opts.setAccess) {
    res.cookies.set(ACCESS_COOKIE, opts.setAccess.token, accessCookieOptions(opts.setAccess.expiresIn));
  }
  if (opts.setRefresh) {
    res.cookies.set(REFRESH_COOKIE, opts.setRefresh.token, refreshCookieOptions());
  }
  if (opts.clearAuth) {
    res.cookies.set(ACCESS_COOKIE, '', clearCookieOptions('/'));
    res.cookies.set(REFRESH_COOKIE, '', clearCookieOptions('/api/proxy/auth'));
    res.cookies.set(ACTIVE_GROUP_COOKIE, '', clearCookieOptions('/'));
  }
  return res;
}

/**
 * Responds to /auth/login, /auth/register, and /auth/refresh:
 * - Writes accessToken into fin_at (httpOnly, path /)
 * - Writes refresh into fin_rt (httpOnly, path /api/proxy/auth)
 * - Strips accessToken from the body returned to the browser
 */
function writeAuthResponse(
  status: number,
  auth: AuthResponseDto,
  apiRefresh: string | null,
): NextResponse {
  const safeBody = {
    expiresIn: auth.expiresIn,
    user: auth.user,
    groups: auth.groups,
  };
  const res = NextResponse.json(safeBody, { status });
  res.cookies.set(ACCESS_COOKIE, auth.accessToken, accessCookieOptions(auth.expiresIn));
  if (apiRefresh) {
    res.cookies.set(REFRESH_COOKIE, apiRefresh, refreshCookieOptions());
  }
  return res;
}
