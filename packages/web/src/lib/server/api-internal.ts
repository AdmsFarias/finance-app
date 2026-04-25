import type { AuthResponseDto } from '@finance/common';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3333/api/v1';

export function apiInternalUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_INTERNAL_URL}${normalized}`;
}

/**
 * Tries to swap a refresh token for a new pair (access + refresh).
 * The API responds 200 with the body + Set-Cookie for the next refresh.
 * Returns null if the API rejects it (invalid/expired token or reuse detected).
 */
export async function refreshWithRawToken(rawRefresh: string): Promise<RefreshResult | null> {
  const res = await fetch(apiInternalUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      Cookie: `fin_rt=${rawRefresh}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as AuthResponseDto;
  const setCookie = res.headers.get('set-cookie');
  const nextRefresh = extractRefreshFromSetCookie(setCookie);
  if (!nextRefresh) {
    return null;
  }

  return {
    auth: body,
    nextRefresh: nextRefresh.value,
    nextRefreshExpires: nextRefresh.expires,
  };
}

export interface RefreshResult {
  auth: AuthResponseDto;
  nextRefresh: string;
  nextRefreshExpires: Date | null;
}

/**
 * Simple parse of a Set-Cookie header looking for `fin_rt=...`.
 * The Next runtime doesn't expose a parser, and the API emits a single cookie in this response.
 */
export function extractRefreshFromSetCookie(
  header: string | null,
): { value: string; expires: Date | null } | null {
  if (!header) return null;
  const match = /(?:^|,\s*)fin_rt=([^;,\s]+)(.*)$/i.exec(header);
  if (!match) return null;
  const value = decodeURIComponent(match[1]!);
  const rest = match[2] ?? '';
  const expiresMatch = /expires=([^;]+)/i.exec(rest);
  const expires = expiresMatch ? new Date(expiresMatch[1]!) : null;
  return { value, expires: expires && !Number.isNaN(expires.getTime()) ? expires : null };
}
