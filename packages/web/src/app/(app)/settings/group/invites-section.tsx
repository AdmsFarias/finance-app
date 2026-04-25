'use client';

import {
  GroupMemberRole,
  type GroupInviteDto,
  type InviteMemberInput,
  inviteMemberSchema,
} from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { createInviteAction, revokeInviteAction } from '@/lib/groups/actions';
import { useDateFormatter } from '@/lib/intl/format';

interface Props {
  groupId: string;
  invites: GroupInviteDto[];
}

const INVITABLE_ROLES = [
  GroupMemberRole.ADMIN,
  GroupMemberRole.MEMBER,
  GroupMemberRole.VIEWER,
] as const;

export function InvitesSection({ groupId, invites }: Props) {
  const t = useTranslations('app.settings.group.invites');
  const tRoles = useTranslations('group.roles');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();
  const formatDate = useDateFormatter();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [topError, setTopError] = useState<ActionState | null>(null);
  const [recentToken, setRecentToken] = useState<{ email: string; token: string } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: GroupMemberRole.MEMBER },
  });

  function onCreate(data: InviteMemberInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await createInviteAction(groupId, data);
      if (result.ok) {
        if (result.rawToken && result.invite) {
          setRecentToken({ email: result.invite.email, token: result.rawToken });
        }
        reset();
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          setError(name as keyof InviteMemberInput, {
            type: 'server',
            message: translateValidationError(tValidation, key),
          });
        }
      }
      setTopError(result);
    });
  }

  function onRevoke(invite: GroupInviteDto) {
    if (!confirm(t('revokeConfirm', { email: invite.email }))) return;
    setTopError(null);
    setBusyInviteId(invite.id);
    startTransition(async () => {
      const result = await revokeInviteAction(groupId, invite.id);
      setBusyInviteId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  const topMessage = toMessage(topError);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="mb-4">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

      {recentToken ? (
        <Alert variant="info">
          <div className="flex flex-col gap-1">
            <span>{t('tokenGenerated', { email: recentToken.email })}</span>
            <code className="break-all rounded bg-background px-2 py-1 text-xs">
              {recentToken.token}
            </code>
            <span className="text-xs text-muted-foreground">{t('tokenHint')}</span>
          </div>
        </Alert>
      ) : null}

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={handleSubmit(onCreate)}
        noValidate
      >
        <FormField
          id="invite-email"
          label={t('email')}
          className="flex-1"
          error={translateValidationError(tValidation, errors.email?.message)}
        >
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>

        <FormField
          id="invite-role"
          label={t('role')}
          error={translateValidationError(tValidation, errors.role?.message)}
        >
          <select
            id="invite-role"
            aria-invalid={!!errors.role}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            {...register('role')}
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </select>
        </FormField>

        <Button type="submit" loading={pending && busyInviteId === null}>
          {t('submit')}
        </Button>
      </form>

      <div className="mt-6">
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {invites.map((invite) => {
              const rowBusy = busyInviteId === invite.id && pending;
              return (
                <li key={invite.id} className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{invite.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {tRoles(invite.role)} · {t('expiresAt', { date: formatDate(invite.expiresAt) })}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={rowBusy}
                    onClick={() => onRevoke(invite)}
                  >
                    {t('revoke')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
