import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { apiServerFetch } from '@/lib/api/server';
import { fetchCurrencies } from '@/lib/currencies/api';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import { CreateFixedExpenseDialog } from './create-fixed-expense-dialog';
import { FixedExpensesTable } from './fixed-expenses-table';
import { ShowArchivedToggle } from './show-archived-toggle';

import type { FixedExpenseDto, MeResponseDto } from '@finance/common';

interface Props {
  searchParams?: Promise<{ archived?: string }>;
}

export default async function FixedExpensesPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const includeArchived = sp.archived === '1';

  const [me, currencies] = await Promise.all([
    apiServerFetch<MeResponseDto>('/auth/me'),
    fetchCurrencies(),
  ]);
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const t = await getTranslations('app.fixedExpenses');

  if (!active) {
    const tSettings = await getTranslations('app.settings.group.create');
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
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

  const canWrite = active.role !== 'VIEWER';
  const canArchive = active.role === 'OWNER' || active.role === 'ADMIN';

  const expenses = await apiServerFetch<FixedExpenseDto[]>(
    `/groups/${active.id}/fixed-expenses${includeArchived ? '?includeArchived=true' : ''}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/fixed-expenses/checklist"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            {t('checklistLink')}
          </Link>
          <ShowArchivedToggle checked={includeArchived} />
          {canWrite ? (
            <CreateFixedExpenseDialog groupId={active.id} currencies={currencies} />
          ) : null}
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('empty.noExpenses')}
        </div>
      ) : (
        <FixedExpensesTable
          groupId={active.id}
          expenses={expenses}
          currencies={currencies}
          canWrite={canWrite}
          canArchive={canArchive}
        />
      )}
    </div>
  );
}
