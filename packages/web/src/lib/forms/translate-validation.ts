/**
 * Translates the keys produced by @finance/common Zod schemas
 * (pattern `validation.email.invalid` etc) into text from the `validation` namespace.
 * Returns the original key if the message doesn't exist — so we never lose info.
 */
export function translateValidationError(
  t: (key: string) => string,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  if (!key.startsWith('validation.')) return key;
  const lookup = key.slice('validation.'.length);
  try {
    const out = t(lookup);
    if (out && out !== lookup) return out;
  } catch {
    // falls through
  }
  return key;
}
