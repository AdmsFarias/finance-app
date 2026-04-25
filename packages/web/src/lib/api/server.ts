import { cookies } from 'next/headers';

import { apiInternalUrl, refreshWithRawToken } from '../server/api-internal';
import {
  ACCESS_COOKIE,
  ACTIVE_GROUP_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from '../server/cookies';

import { toApiError } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ServerFetchOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /** If true, skips the refresh attempt on 401 — used by the refresh call itself and by public routes. */
  skipRefresh?: boolean;
}

/**
 * Server-side fetch (server components / server actions / route handlers).
 * - Injects Authorization with the access cookie, if present.
 * - On 401, attempts a single swap via /auth/refresh, updates cookies, and retries.
 * - Throws ApiClientError on any status != 2xx.
 *
 * Unlike the BFF proxy (which streams the raw response to the browser), this helper
 * returns parsed JSON directly to the server-side caller.
 */
export async function apiServerFetch<T>(path: string, options: ServerFetchOptions = {}): Promise<T> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value ?? null;
  const activeGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;

  const res = await doFetch(path, options, access, activeGroup);

  if (res.status === 401 && !options.skipRefresh) {
    const refreshed = await tryRefreshAndPersist();
    if (refreshed) {
      const retry = await doFetch(path, options, refreshed, activeGroup);
      return handleResponse<T>(retry);
    }
  }

  return handleResponse<T>(res);
}

async function doFetch(
  path: string,
  options: ServerFetchOptions,
  accessToken: string | null,
  activeGroup: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  // Header takes precedence over the cookie (caller can override for the rare case
  // of needing to access a group other than the active one)
  if (activeGroup && !('X-Group-Id' in headers) && !('x-group-id' in headers)) {
    headers['X-Group-Id'] = activeGroup;
  }
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  return fetch(apiInternalUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body,
    cache: 'no-store',
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;
  if (!res.ok) {
    throw toApiError(res.status, parsed);
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Reads the refresh cookie, tries to swap it for a new pair, and persists both
 * into Next's cookie store. Returns the new access token, or null on failure.
 *
 * In server actions this updates the response Set-Cookie; in server components
 * called during render Next ignores the mutation (the cookie store is readonly there).
 * That's fine: the next request arrives without access and triggers another refresh.
 */
export async function tryRefreshAndPersist(): Promise<string | null> {
  const store = await cookies();
  const rawRefresh = store.get(REFRESH_COOKIE)?.value;
  if (!rawRefresh) return null;

  const result = await refreshWithRawToken(rawRefresh);
  if (!result) {
    // refresh rejected — clear what we had to force re-login on the next navigation
    try {
      store.set(ACCESS_COOKIE, '', clearCookieOptions('/'));
      store.set(REFRESH_COOKIE, '', clearCookieOptions('/api/proxy/auth'));
    } catch {
      // cookie store readonly (render) — silently ignore
    }
    return null;
  }

  try {
    store.set(ACCESS_COOKIE, result.auth.accessToken, accessCookieOptions(result.auth.expiresIn));
    store.set(REFRESH_COOKIE, result.nextRefresh, refreshCookieOptions());
  } catch {
    // same as above
  }
  return result.auth.accessToken;
}
