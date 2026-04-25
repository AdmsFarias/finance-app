'use server';

import { createSnapshotBatchSchema } from '@finance/common';

import { ApiClientError } from '../api/errors';
import { apiServerFetch } from '../api/server';

import type { ActionState } from '../auth/actions';
import type {
  CreateSnapshotBatchInput,
  SnapshotBatchDetailDto,
} from '@finance/common';

export async function createSnapshotAction(
  groupId: string,
  input: CreateSnapshotBatchInput,
): Promise<ActionState & { batch?: SnapshotBatchDetailDto }> {
  if (!isUuid(groupId)) return fieldFail('groupId');
  const parsed = createSnapshotBatchSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    const batch = await apiServerFetch<SnapshotBatchDetailDto>(
      `/groups/${groupId}/snapshots/batches`,
      { method: 'POST', body: parsed.data },
    );
    return { ok: true, batch };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function deleteSnapshotAction(
  groupId: string,
  batchId: string,
): Promise<ActionState> {
  if (!isUuid(groupId)) return fieldFail('groupId');
  if (!isUuid(batchId)) return fieldFail('batchId');
  try {
    await apiServerFetch<void>(
      `/groups/${groupId}/snapshots/batches/${batchId}`,
      { method: 'DELETE' },
    );
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

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
