'use client';

import { GroupMemberRole } from '@finance/common';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type ActionState } from '@/lib/auth/actions';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { changeMemberRoleAction, removeMemberAction } from '@/lib/groups/actions';

import type { GroupDto, GroupMemberDto } from '@finance/common';

interface Props {
  group: GroupDto;
  members: GroupMemberDto[];
  currentUserId: string;
  actorRole: string;
}

const EDITABLE_ROLES = [
  GroupMemberRole.OWNER,
  GroupMemberRole.ADMIN,
  GroupMemberRole.MEMBER,
  GroupMemberRole.VIEWER,
] as const;

export function MembersTable({ group, members, currentUserId, actorRole }: Props) {
  const t = useTranslations('app.settings.group.members');
  const tRoles = useTranslations('group.roles');
  const toMessage = useActionErrorMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [topError, setTopError] = useState<ActionState | null>(null);

  const topMessage = toMessage(topError);

  function canEditRole(target: GroupMemberDto): boolean {
    if (actorRole === 'OWNER') return true;
    if (actorRole === 'ADMIN') {
      // ADMIN cannot touch OWNER nor promote anyone to OWNER
      return target.role !== GroupMemberRole.OWNER;
    }
    return false;
  }

  function canRemove(target: GroupMemberDto): boolean {
    if (actorRole === 'OWNER') return true;
    if (actorRole === 'ADMIN') return target.role !== GroupMemberRole.OWNER;
    return false;
  }

  function allowedRolesForTarget(): readonly GroupMemberRole[] {
    if (actorRole === 'ADMIN') {
      // ADMIN cannot promote anyone to OWNER
      return EDITABLE_ROLES.filter((r) => r !== GroupMemberRole.OWNER);
    }
    return EDITABLE_ROLES;
  }

  function onChangeRole(target: GroupMemberDto, next: GroupMemberRole) {
    if (next === target.role) return;
    setTopError(null);
    setBusyUserId(target.userId);
    startTransition(async () => {
      const result = await changeMemberRoleAction(group.id, target.userId, { role: next });
      setBusyUserId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  function onRemove(target: GroupMemberDto) {
    if (!confirm(t('removeConfirm', { name: target.displayName }))) return;
    setTopError(null);
    setBusyUserId(target.userId);
    startTransition(async () => {
      const result = await removeMemberAction(group.id, target.userId);
      setBusyUserId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="mb-4">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('subtitle', { count: members.length })}</p>
      </header>

      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t('columns.name')}</th>
              <th className="py-2 pr-4 font-medium">{t('columns.email')}</th>
              <th className="py-2 pr-4 font-medium">{t('columns.role')}</th>
              <th className="py-2 pr-4 font-medium sr-only">{t('columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.userId === currentUserId;
              const rowBusy = busyUserId === m.userId && pending;
              const editable = canEditRole(m);
              const removable = canRemove(m);
              const allowed = allowedRolesForTarget();
              return (
                <tr key={m.userId} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-4">
                    {m.displayName}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-muted-foreground">({t('you')})</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{m.email}</td>
                  <td className="py-3 pr-4">
                    {editable ? (
                      <select
                        aria-label={t('columns.role')}
                        value={m.role}
                        disabled={rowBusy}
                        onChange={(e) =>
                          onChangeRole(m, e.target.value as GroupMemberRole)
                        }
                        className="h-8 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                      >
                        {allowed.map((r) => (
                          <option key={r} value={r}>
                            {tRoles(r)}
                          </option>
                        ))}
                        {/* If the current role isn't in the allowed list (ADMIN viewing an OWNER),
                            show it as disabled to keep the cell consistent */}
                        {!allowed.includes(m.role as GroupMemberRole) ? (
                          <option value={m.role} disabled>
                            {tRoles(m.role)}
                          </option>
                        ) : null}
                      </select>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {tRoles(m.role)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {removable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={rowBusy}
                        onClick={() => onRemove(m)}
                      >
                        {t('remove')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
