import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { apiServerFetch } from '@/lib/api/server';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { getAmountFormatter } from '@/lib/intl/format';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import type { MeResponseDto, SnapshotBatchSummaryDto } from '@finance/common';

const PAGE_SIZE = 50;

interface Props {
  searchParams?: Promise<{ page?: string }>;
}

function parsePage(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export default async function SnapshotsListPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const page = parsePage(sp.page);
  const offset = (page - 1) * PAGE_SIZE;

  const me = await apiServerFetch<MeResponseDto>('/auth/me');
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const t = await getTranslations('app.snapshots');

  if (!active) {
    const tSettings = await getTranslations('app.settings.group.create');
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('list.title')}</h2>
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

  // Request limit+1 to detect if a next page exists without needing a COUNT in the API
  const [fetched, formatAmount, tSources] = await Promise.all([
    apiServerFetch<SnapshotBatchSummaryDto[]>(
      `/groups/${active.id}/snapshots/batches?limit=${PAGE_SIZE + 1}&offset=${offset}`,
    ),
    getAmountFormatter(),
    getTranslations('app.snapshots.sources'),
  ]);
  const hasNext = fetched.length > PAGE_SIZE;
  const batches = hasNext ? fetched.slice(0, PAGE_SIZE) : fetched;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('list.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('list.subtitle')}</p>
        </div>
        {canWrite ? (
          <Link
            href="/snapshots/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('list.cta')}
          </Link>
        ) : null}
      </div>

      {batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('list.empty')}
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t('list.columns.date')}</th>
                  <th className="py-2 pr-4 font-medium">{t('list.columns.source')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('list.columns.entries')}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t('list.columns.total')}</th>
                  <th className="py-2 pr-4 font-medium sr-only">{t('list.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-b-0">
                    <td className="py-3 pr-4 font-medium">{b.snapshotDate}</td>
                    <td className="py-3 pr-4">{tSources(b.source)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{b.entryCount}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatAmount(b.totalBase, b.baseCurrency)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Link
                        href={`/snapshots/${b.id}`}
                        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                      >
                        {t('list.view')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasPrev || hasNext ? (
            <nav
              aria-label={t('list.pagination.label')}
              className="mt-4 flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {t('list.pagination.page', { page })}
              </span>
              <div className="flex gap-2">
                {hasPrev ? (
                  <Link
                    href={page - 1 === 1 ? '/snapshots' : `/snapshots?page=${page - 1}`}
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                  >
                    {t('list.pagination.prev')}
                  </Link>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium opacity-40">
                    {t('list.pagination.prev')}
                  </span>
                )}
                {hasNext ? (
                  <Link
                    href={`/snapshots?page=${page + 1}`}
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                  >
                    {t('list.pagination.next')}
                  </Link>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium opacity-40">
                    {t('list.pagination.next')}
                  </span>
                )}
              </div>
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
