/**
 * Name of the httpOnly cookie that stores the raw refresh token.
 * Identical to the one used by the API (see packages/api/src/modules/auth/auth.controller.ts).
 * Same name and value, but different path: the API writes with path=/api/v1/auth;
 * the BFF re-emits with path=/api/proxy/auth so it's only sent on proxy calls
 * that hit auth endpoints.
 */
export const REFRESH_COOKIE = 'fin_rt';

/**
 * Access token JWT. httpOnly, only used server-side by the BFF.
 * Web-only — the API doesn't know about this cookie; it always returns Bearer in the body.
 */
export const ACCESS_COOKIE = 'fin_at';

/** Locale chosen by the user. Readable from the client to allow switching without a round-trip. */
export const LOCALE_COOKIE = 'fin_locale';

/**
 * User's active group (UUID). httpOnly: the server component renders the
 * <select> already with the correct value, so the client doesn't need to read it directly.
 * Revalidated at set time (must belong to the list returned by /auth/me).
 */
export const ACTIVE_GROUP_COOKIE = 'fin_active_group';

/**
 * User's preferred display currency for the dashboard.
 * httpOnly (same pattern as active group): the server component renders with
 * the value already resolved. Empty/absent = use the active group's baseCurrency.
 * Applied only on /dashboard — other screens still show the native currency per row.
 */
export const DISPLAY_CURRENCY_COOKIE = 'fin_display_currency';

export const SUPPORTED_LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const isProd = process.env.NODE_ENV === 'production';

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
  domain?: string;
}

export function accessCookieOptions(expiresInSec: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(1, expiresInSec - 5),
  };
}

/**
 * The refresh cookie is restricted to the BFF: the browser only sends it to /api/proxy/auth/*.
 * This prevents leaking the refresh on any other proxy route.
 */
export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/proxy/auth',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function clearCookieOptions(path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path,
    maxAge: 0,
  };
}

export function localeCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}

export function activeGroupCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}

export function displayCurrencyCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}
