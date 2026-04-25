'use server';

import {
  createFixedExpenseSchema,
  toggleFixedExpenseCheckSchema,
  updateFixedExpenseSchema,
} from '@finance/common';

import { ApiClientError } from '../api/errors';
import { apiServerFetch } from '../api/server';

import type { ActionState } from '../auth/actions';
import type {
  CreateFixedExpenseInput,
  FixedExpenseCheckDto,
  FixedExpenseDto,
  ToggleFixedExpenseCheckInput,
  UpdateFixedExpenseInput,
} from '@finance/common';

export async function createFixedExpenseAction(
  groupId: string,
  input: CreateFixedExpenseInput,
): Promise<ActionState & { expense?: FixedExpenseDto }> {
  if (!isUuid(groupId)) return fieldFail('groupId');
  const parsed = createFixedExpenseSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    const expense = await apiServerFetch<FixedExpenseDto>(
      `/groups/${groupId}/fixed-expenses`,
      { method: 'POST', body: parsed.data },
    );
    return { ok: true, expense };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function updateFixedExpenseAction(
  groupId: string,
  expenseId: string,
  input: UpdateFixedExpenseInput,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(expenseId)) return fieldFail('id');
  const parsed = updateFixedExpenseSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    await apiServerFetch<FixedExpenseDto>(
      `/groups/${groupId}/fixed-expenses/${expenseId}`,
      { method: 'PATCH', body: parsed.data },
    );
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function archiveFixedExpenseAction(
  groupId: string,
  expenseId: string,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(expenseId)) return fieldFail('id');
  try {
    await apiServerFetch<void>(`/groups/${groupId}/fixed-expenses/${expenseId}`, {
      method: 'DELETE',
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function restoreFixedExpenseAction(
  groupId: string,
  expenseId: string,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(expenseId)) return fieldFail('id');
  try {
    await apiServerFetch<FixedExpenseDto>(
      `/groups/${groupId}/fixed-expenses/${expenseId}/restore`,
      { method: 'POST' },
    );
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export type ToggleCheckResult =
  | (ActionState & { state: 'checked'; check: FixedExpenseCheckDto })
  | (ActionState & { state: 'unchecked' })
  | ActionState;

export async function toggleFixedExpenseCheckAction(
  groupId: string,
  expenseId: string,
  input: ToggleFixedExpenseCheckInput,
): Promise<ToggleCheckResult> {
  if (!isUuid(groupId) || !isUuid(expenseId)) return fieldFail('id');
  const parsed = toggleFixedExpenseCheckSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    const check = await apiServerFetch<FixedExpenseCheckDto | undefined>(
      `/groups/${groupId}/fixed-expenses/${expenseId}/checks`,
      { method: 'POST', body: parsed.data },
    );
    if (check === undefined) return { ok: true, state: 'unchecked' };
    return { ok: true, state: 'checked', check };
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
