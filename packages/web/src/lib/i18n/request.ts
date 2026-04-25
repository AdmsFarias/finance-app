import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isSupportedLocale } from '../server/cookies';

import type { SUPPORTED_LOCALES } from '../server/cookies';

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});

async function resolveLocale(): Promise<(typeof SUPPORTED_LOCALES)[number]> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(fromCookie)) return fromCookie;

  const h = await headers();
  const acceptLanguage = h.get('accept-language');
  if (acceptLanguage) {
    const match = pickFromAcceptLanguage(acceptLanguage);
    if (match) return match;
  }

  return DEFAULT_LOCALE;
}

function pickFromAcceptLanguage(header: string): (typeof SUPPORTED_LOCALES)[number] | null {
  const tags = header
    .split(',')
    .map((t) => t.trim().split(';')[0]?.trim().toLowerCase() ?? '')
    .filter(Boolean);
  for (const tag of tags) {
    if (isSupportedLocale(tag)) return tag;
    const primary = tag.split('-')[0];
    if (primary === 'pt') return 'pt-BR';
    if (primary === 'en') return 'en-US';
    if (primary === 'es') return 'es-ES';
  }
  return null;
}
