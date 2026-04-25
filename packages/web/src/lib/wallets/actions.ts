'use server';

import { createWalletSchema, updateWalletSchema } from '@finance/common';

import { ApiClientError } from '../api/errors';
import { apiServerFetch } from '../api/server';

import type { ActionState } from '../auth/actions';
import type {
  CreateWalletInput,
  UpdateWalletInput,
  WalletDto,
} from '@finance/common';

export async function createWalletAction(
  groupId: string,
  input: CreateWalletInput,
): Promise<ActionState & { wallet?: WalletDto }> {
  if (!isUuid(groupId)) return fieldFail('groupId');
  const parsed = createWalletSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    const wallet = await apiServerFetch<WalletDto>(`/groups/${groupId}/wallets`, {
      method: 'POST',
      body: parsed.data,
    });
    return { ok: true, wallet };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function updateWalletAction(
  groupId: string,
  walletId: string,
  input: UpdateWalletInput,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(walletId)) return fieldFail('id');
  const parsed = updateWalletSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    await apiServerFetch<WalletDto>(`/groups/${groupId}/wallets/${walletId}`, {
      method: 'PATCH',
      body: parsed.data,
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function archiveWalletAction(
  groupId: string,
  walletId: string,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(walletId)) return fieldFail('id');
  try {
    await apiServerFetch<void>(`/groups/${groupId}/wallets/${walletId}`, {
      method: 'DELETE',
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function restoreWalletAction(
  groupId: string,
  walletId: string,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(walletId)) return fieldFail('id');
  try {
    await apiServerFetch<WalletDto>(`/groups/${groupId}/wallets/${walletId}/restore`, {
      method: 'POST',
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

// ---------- helpers ----------

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

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

function zodFail(
  issues: Array<{ path: (string | number)[]; message: string }>,
): ActionState {
  return {
    ok: false,
    code: 'VALIDATION_FAILED',
    message: 'validation.failed',
    fieldErrors: flattenZodErrors(issues),
  };
}

function fieldFail(field: string): ActionState {
  return {
    ok: false,
    code: 'VALIDATION_FAILED',
    message: 'validation.failed',
    fieldErrors: { [field]: 'validation.invalid' },
  };
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
