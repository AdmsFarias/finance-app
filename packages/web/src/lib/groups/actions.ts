'use server';

import {
  changeMemberRoleSchema,
  createGroupSchema,
  inviteMemberSchema,
  updateGroupSchema,
} from '@finance/common';
import { cookies } from 'next/headers';

import { ApiClientError } from '../api/errors';
import { apiServerFetch } from '../api/server';
import { ACTIVE_GROUP_COOKIE, activeGroupCookieOptions, clearCookieOptions } from '../server/cookies';

import type { ActionState } from '../auth/actions';
import type {
  ChangeMemberRoleInput,
  CreateGroupInput,
  GroupDto,
  GroupInviteDto,
  GroupMemberDto,
  InviteMemberInput,
  MeResponseDto,
  UpdateGroupInput,
} from '@finance/common';

/**
 * Writes the active group cookie. First validates that the group belongs to the
 * authenticated user — a hand-crafted cookie must not change the scope.
 */
export async function setActiveGroupAction(groupId: string): Promise<ActionState> {
  if (!isUuid(groupId)) {
    return { ok: false, code: 'VALIDATION_FAILED', message: 'validation.failed' };
  }

  const me = await apiServerFetch<MeResponseDto>('/auth/me');
  const belongs = me.groups.some((g) => g.id === groupId);
  if (!belongs) {
    return { ok: false, code: 'FORBIDDEN', message: 'errors.FORBIDDEN' };
  }

  const store = await cookies();
  store.set(ACTIVE_GROUP_COOKIE, groupId, activeGroupCookieOptions());
  return { ok: true };
}

export async function createGroupAction(
  input: CreateGroupInput,
): Promise<ActionState & { groupId?: string }> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    const group = await apiServerFetch<GroupDto>('/groups', {
      method: 'POST',
      body: parsed.data,
    });
    // immediately activate the freshly created group so the UX flows naturally
    const store = await cookies();
    store.set(ACTIVE_GROUP_COOKIE, group.id, activeGroupCookieOptions());
    return { ok: true, groupId: group.id };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function updateGroupAction(
  groupId: string,
  input: UpdateGroupInput,
): Promise<ActionState> {
  if (!isUuid(groupId)) return fieldFail('groupId');
  const parsed = updateGroupSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    await apiServerFetch<GroupDto>(`/groups/${groupId}`, {
      method: 'PATCH',
      body: parsed.data,
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function archiveGroupAction(groupId: string): Promise<ActionState> {
  if (!isUuid(groupId)) return fieldFail('groupId');
  try {
    await apiServerFetch<void>(`/groups/${groupId}/archive`, { method: 'POST' });
    // If the archived group is the active one, clear the cookie so resolveActiveGroup
    // recomputes on the next render.
    const store = await cookies();
    if (store.get(ACTIVE_GROUP_COOKIE)?.value === groupId) {
      store.set(ACTIVE_GROUP_COOKIE, '', clearCookieOptions('/'));
    }
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function changeMemberRoleAction(
  groupId: string,
  userId: string,
  input: ChangeMemberRoleInput,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(userId)) return fieldFail('id');
  const parsed = changeMemberRoleSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    await apiServerFetch<GroupMemberDto>(`/groups/${groupId}/members/${userId}`, {
      method: 'PATCH',
      body: parsed.data,
    });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function removeMemberAction(
  groupId: string,
  userId: string,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(userId)) return fieldFail('id');
  try {
    await apiServerFetch<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
    return { ok: true };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function createInviteAction(
  groupId: string,
  input: InviteMemberInput,
): Promise<ActionState & { invite?: GroupInviteDto; rawToken?: string }> {
  if (!isUuid(groupId)) return fieldFail('groupId');
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues);
  try {
    const out = await apiServerFetch<{ invite: GroupInviteDto; rawToken: string }>(
      `/groups/${groupId}/invites`,
      { method: 'POST', body: parsed.data },
    );
    return { ok: true, invite: out.invite, rawToken: out.rawToken };
  } catch (err) {
    return errorFromException(err);
  }
}

export async function revokeInviteAction(
  groupId: string,
  inviteId: string,
): Promise<ActionState> {
  if (!isUuid(groupId) || !isUuid(inviteId)) return fieldFail('id');
  try {
    await apiServerFetch<void>(`/groups/${groupId}/invites/${inviteId}`, {
      method: 'DELETE',
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
