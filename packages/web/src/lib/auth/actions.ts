'use server';

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  acceptInviteSchema,
} from '@finance/common';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { apiInternalUrl, extractRefreshFromSetCookie } from '../server/api-internal';
import {
  ACCESS_COOKIE,
  ACTIVE_GROUP_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from '../server/cookies';

import type {
  AuthResponseDto,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  AcceptInviteInput,
} from '@finance/common';

export type ActionState =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * Calls the backend API directly and, if it's an auth call (login/register/refresh),
 * writes the web session cookies before responding to the caller.
 * Returns AuthResponseDto or throws a serializable error object.
 */
async function postToApi<T>(path: string, body: unknown): Promise<{
  status: number;
  data: T | undefined;
  setCookie: string | null;
}> {
  let res: Response;
  try {
    res = await fetch(apiInternalUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    // network-level failure (API down, DNS, timeout) — surface as status 0 so the
    // caller maps it to a user-facing NETWORK error instead of crashing the action
    return { status: 0, data: undefined, setCookie: null };
  }
  const setCookie = res.headers.get('set-cookie');
  if (res.status === 204) {
    return { status: 204, data: undefined, setCookie };
  }
  const text = await res.text();
  const data = text ? (safeJson(text) as T) : undefined;
  return { status: res.status, data, setCookie };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function persistAuthCookies(auth: AuthResponseDto, setCookie: string | null): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, auth.accessToken, accessCookieOptions(auth.expiresIn));
  const refresh = extractRefreshFromSetCookie(setCookie);
  if (refresh?.value) {
    store.set(REFRESH_COOKIE, refresh.value, refreshCookieOptions());
  }
}

function flattenZodErrors(issues: Array<{ path: (string | number)[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

function errorFromApi(status: number, data: unknown): ActionState {
  if (status === 0) {
    return { ok: false, code: 'NETWORK', message: 'errors.NETWORK' };
  }
  if (data && typeof data === 'object' && 'code' in data) {
    const body = data as { code: string; message?: string; fieldErrors?: Record<string, string> };
    return {
      ok: false,
      code: body.code,
      message: body.message ?? body.code,
      fieldErrors: body.fieldErrors,
    };
  }
  return {
    ok: false,
    code: status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED',
    message: 'Unexpected response',
  };
}

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------

export async function signUpAction(input: RegisterInput): Promise<ActionState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const { status, data, setCookie } = await postToApi<AuthResponseDto>('/auth/register', parsed.data);
  if (status === 201 && data) {
    await persistAuthCookies(data, setCookie);
    redirect('/dashboard');
  }
  return errorFromApi(status, data);
}

export async function signInAction(input: LoginInput): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const { status, data, setCookie } = await postToApi<AuthResponseDto>('/auth/login', parsed.data);
  if (status === 200 && data) {
    await persistAuthCookies(data, setCookie);
    redirect('/dashboard');
  }
  return errorFromApi(status, data);
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    // best-effort — failure here must not block the local logout
    try {
      await fetch(apiInternalUrl('/auth/logout'), {
        method: 'POST',
        headers: { Cookie: `fin_rt=${refresh}` },
        cache: 'no-store',
      });
    } catch {
      // ignore
    }
  }
  store.set(ACCESS_COOKIE, '', clearCookieOptions('/'));
  store.set(REFRESH_COOKIE, '', clearCookieOptions('/api/proxy/auth'));
  store.set(ACTIVE_GROUP_COOKIE, '', clearCookieOptions('/'));
  redirect('/login');
}

export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const { status, data } = await postToApi<unknown>('/auth/forgot-password', parsed.data);
  // API always responds 204 (hides whether the email exists)
  if (status === 204) return { ok: true };
  return errorFromApi(status, data);
}

export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const { status, data } = await postToApi<unknown>('/auth/reset-password', parsed.data);
  if (status === 204) return { ok: true };
  return errorFromApi(status, data);
}

/**
 * Accepts an invite. Requires an authenticated user — the invite token is NOT the session token.
 * Propagates the current user's Bearer and, if no session is present, returns an error so the caller can redirect.
 */
export async function acceptInviteAction(input: AcceptInviteInput): Promise<ActionState> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) {
    return { ok: false, code: 'TOKEN_INVALID', message: 'Not authenticated' };
  }

  let res: Response;
  try {
    res = await fetch(apiInternalUrl('/invites/accept'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return errorFromApi(0, undefined);
  }
  if (res.status === 204 || res.status === 200) {
    return { ok: true };
  }
  const text = await res.text();
  return errorFromApi(res.status, text ? safeJson(text) : undefined);
}
