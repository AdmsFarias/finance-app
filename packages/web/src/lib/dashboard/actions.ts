'use server';

import { currencyCodeSchema } from '@finance/common';
import { cookies } from 'next/headers';

import {
  DISPLAY_CURRENCY_COOKIE,
  clearCookieOptions,
  displayCurrencyCookieOptions,
} from '../server/cookies';

import type { ActionState } from '../auth/actions';

/**
 * Writes (or clears, if input is empty) the user's preferred display currency for the dashboard.
 * The value goes through the common currency code schema — A-Z{3} format —
 * but semantic validation (currency exists / is active) happens on the backend
 * when /current/history are called; a failure there falls back gracefully.
 */
export async function setDisplayCurrencyAction(value: string | null): Promise<ActionState> {
  const store = await cookies();
  if (!value) {
    store.set(DISPLAY_CURRENCY_COOKIE, '', clearCookieOptions('/'));
    return { ok: true };
  }
  const parsed = currencyCodeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: { displayCurrency: parsed.error.issues[0]?.message ?? 'validation.invalid' },
    };
  }
  store.set(DISPLAY_CURRENCY_COOKIE, parsed.data, displayCurrencyCookieOptions());
  return { ok: true };
}
