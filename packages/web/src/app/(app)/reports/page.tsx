import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { apiServerFetch } from '@/lib/api/server';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import { SnapshotEntriesPicker } from './snapshot-entries-picker';

import type { MeResponseDto, SnapshotBatchSummaryDto } from '@finance/common';

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default async function ReportsPage() {
  const me = await apiServerFetch<MeResponseDto>('/auth/me');
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const t = await getTranslations('app.reports');

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

  const batches = await apiServerFetch<SnapshotBatchSummaryDto[]>(
    `/groups/${active.id}/snapshots/batches?limit=50&offset=0`,
  );

  const batchOptions = batches.map((b) => ({
    id: b.id,
    label: `${b.snapshotDate} — ${b.entryCount} · ${b.totalBase} ${b.baseCurrency}`,
  }));

  const baseProxy = `/api/proxy/groups/${active.id}/reports`;
  const ym = currentYearMonth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle', { group: active.name })}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">{t('snapshots.title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('snapshots.description')}</p>
        <form
          method="get"
          action={`${baseProxy}/snapshots.csv`}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="snapshots-from" className="text-xs font-medium text-muted-foreground">
              {t('snapshots.fields.from')}
            </label>
            <input
              id="snapshots-from"
              type="date"
              name="from"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="snapshots-to" className="text-xs font-medium text-muted-foreground">
              {t('snapshots.fields.to')}
            </label>
            <input
              id="snapshots-to"
              type="date"
              name="to"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('snapshots.download')}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">{t('snapshotEntries.title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('snapshotEntries.description')}</p>
        <div className="mt-4">
          <SnapshotEntriesPicker
            groupId={active.id}
            batches={batchOptions}
            labels={{
              field: t('snapshotEntries.fields.batch'),
              placeholder: t('snapshotEntries.fields.placeholder'),
              download: t('snapshotEntries.download'),
              empty: t('snapshotEntries.empty'),
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">{t('fixedExpenses.title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('fixedExpenses.description')}</p>
        <form
          method="get"
          action={`${baseProxy}/fixed-expenses.csv`}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="fixed-ym" className="text-xs font-medium text-muted-foreground">
              {t('fixedExpenses.fields.yearMonth')}
            </label>
            <input
              id="fixed-ym"
              type="month"
              name="yearMonth"
              defaultValue={ym}
              required
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('fixedExpenses.download')}
          </button>
        </form>
      </section>
    </div>
  );
}
