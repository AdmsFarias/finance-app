'use client';

import { useTranslations } from 'next-intl';

import type { ActionState } from '../auth/actions';

/**
 * Converts the top-level error (code) into translated text.
 * fieldErrors are applied by the caller directly via RHF's setError (messages are
 * the Zod keys from common's schemas — resolved via t('validation....')).
 */
export function useActionErrorMessage() {
  const t = useTranslations('errors');
  return function toMessage(state: ActionState | null | undefined): string | null {
    if (!state || state.ok) return null;
    const key = state.code;
    try {
      const translated = t(key);
      if (translated && translated !== `errors.${key}`) return translated;
    } catch {
      // falls through
    }
    return t('generic');
  };
}
