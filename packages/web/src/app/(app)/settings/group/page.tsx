import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { apiServerFetch } from '@/lib/api/server';
import { fetchCurrencies } from '@/lib/currencies/api';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import { CreateGroupDialog } from './create-group-dialog';
import { GroupDetailsForm } from './group-details-form';
import { InvitesSection } from './invites-section';
import { MembersTable } from './members-table';

import type {
  GroupDto,
  GroupInviteDto,
  GroupMemberDto,
  MeResponseDto,
} from '@finance/common';

export default async function GroupSettingsPage() {
  const [me, currencies] = await Promise.all([
    apiServerFetch<MeResponseDto>('/auth/me'),
    fetchCurrencies(),
  ]);
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const t = await getTranslations('app.settings.group');
  const tRoles = await getTranslations('group.roles');

  if (!active) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('empty.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.subtitle')}</p>
        <div className="mt-4">
          <CreateGroupDialog currencies={currencies} />
        </div>
      </div>
    );
  }

  const canManage = active.role === 'OWNER' || active.role === 'ADMIN';
  const [group, members, invites] = await Promise.all([
    apiServerFetch<GroupDto>(`/groups/${active.id}`),
    apiServerFetch<GroupMemberDto[]>(`/groups/${active.id}/members`),
    canManage
      ? apiServerFetch<GroupInviteDto[]>(`/groups/${active.id}/invites`)
      : Promise.resolve<GroupInviteDto[]>([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <p className="text-sm text-muted-foreground">
            {t('header.subtitle', { role: tRoles(active.role) })}
          </p>
        </div>
        <CreateGroupDialog currencies={currencies} />
      </div>

      <GroupDetailsForm group={group} role={active.role} currencies={currencies} />

      <MembersTable
        group={group}
        members={members}
        currentUserId={me.user.id}
        actorRole={active.role}
      />

      {canManage ? <InvitesSection groupId={group.id} invites={invites} /> : null}
    </div>
  );
}
