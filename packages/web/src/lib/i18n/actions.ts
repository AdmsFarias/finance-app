'use server';

import { cookies } from 'next/headers';

import {
  LOCALE_COOKIE,
  isSupportedLocale,
  localeCookieOptions,
} from '../server/cookies';

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, localeCookieOptions());
}
