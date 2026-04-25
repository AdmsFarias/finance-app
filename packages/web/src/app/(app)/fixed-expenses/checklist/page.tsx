import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { apiServerFetch } from '@/lib/api/server';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import { ChecklistTable } from './checklist-table';
import { MonthNavigator } from './month-navigator';

import type { FixedExpenseChecklistItemDto, MeResponseDto } from '@finance/common';

interface Props {
  searchParams?: Promise<{ yearMonth?: string }>;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function ChecklistPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const yearMonth =
    sp.yearMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.yearMonth)
      ? sp.yearMonth
      : currentYearMonth();

  const me = await apiServerFetch<MeResponseDto>('/auth/me');
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const t = await getTranslations('app.fixedExpenses');
  const tList = await getTranslations('app.fixedExpenses.checklist');

  if (!active) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{tList('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.noGroup')}</p>
      </div>
    );
  }

  const canToggle = active.role !== 'VIEWER';

  const items = await apiServerFetch<FixedExpenseChecklistItemDto[]>(
    `/groups/${active.id}/fixed-expenses/checklist?yearMonth=${yearMonth}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{tList('title')}</h2>
          <p className="text-sm text-muted-foreground">{tList('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/fixed-expenses"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            {tList('backToList')}
          </Link>
          <MonthNavigator yearMonth={yearMonth} />
        </div>
      </div>

      <ChecklistTable
        groupId={active.id}
        yearMonth={yearMonth}
        items={items}
        canToggle={canToggle}
      />
    </div>
  );
}
