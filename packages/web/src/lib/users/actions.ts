'use server';

import { changePasswordSchema, updateProfileSchema } from '@finance/common';

import { ApiClientError } from '../api/errors';
import { apiServerFetch } from '../api/server';

import type { ActionState } from '../auth/actions';
import type {
  AuthUserDto,
  ChangePasswordInput,
  UpdateProfileInput,
} from '@finance/common';

function flattenZodErrors(
  issues: Array<{ path: (string | number)[]; message: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

function errorFromException(err: unknown): ActionState {
  if (err instanceof ApiClientError) {
    return {
      ok: false,
      code: err.payload.code,
      message: err.payload.message ?? err.payload.code,
      fieldErrors: err.payload.fieldErrors,
    };
  }
  return { ok: false, code: 'INTERNAL_ERROR', message: 'Unexpected error' };
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionState> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }
  try {
    await apiServerFetch<AuthUserDto>('/users/me', {
      method: 'PATCH',
      body: parsed.data,
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'validation.failed',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }
  try {
    await apiServerFetch<void>('/users/me/password', {
      method: 'POST',
      body: parsed.data,
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}
