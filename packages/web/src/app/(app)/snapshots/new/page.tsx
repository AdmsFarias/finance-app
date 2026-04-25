import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { apiServerFetch } from '@/lib/api/server';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import { NewSnapshotForm } from './new-snapshot-form';

import type { MeResponseDto, WalletDto } from '@finance/common';

export default async function NewSnapshotPage() {
  const me = await apiServerFetch<MeResponseDto>('/auth/me');
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const t = await getTranslations('app.snapshots');

  if (!active) {
    const tSettings = await getTranslations('app.settings.group.create');
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('new.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.noGroup')}</p>
        <div className="mt-4">
          <Link
            href="/settings/group"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            {tSettings('button')}
          </Link>
        </div>
      </div>
    );
  }

  if (active.role === 'VIEWER') {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('new.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.viewer')}</p>
      </div>
    );
  }

  const wallets = await apiServerFetch<WalletDto[]>(`/groups/${active.id}/wallets`);

  if (wallets.length === 0) {
    const tWallets = await getTranslations('app.wallets.create');
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('new.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.noWallets')}</p>
        <div className="mt-4">
          <Link
            href="/wallets"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            {tWallets('button')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('new.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('new.subtitle', { baseCurrency: active.baseCurrency })}
        </p>
      </div>
      <NewSnapshotForm
        groupId={active.id}
        baseCurrency={active.baseCurrency}
        wallets={wallets}
      />
    </div>
  );
}
