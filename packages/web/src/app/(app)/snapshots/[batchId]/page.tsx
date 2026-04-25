import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ApiClientError } from '@/lib/api/errors';
import { apiServerFetch } from '@/lib/api/server';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { getAmountFormatter, getSignedAmountFormatter } from '@/lib/intl/format';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import { DeleteSnapshotButton } from './delete-snapshot-button';

import type {
  BalanceSnapshotDto,
  MeResponseDto,
  SnapshotBatchDetailDto,
  SnapshotBatchSummaryDto,
} from '@finance/common';

interface Props {
  params: Promise<{ batchId: string }>;
}

interface DeltaRow {
  walletId: string;
  walletName: string;
  currencyCode: string;
  currentBase: string | null;
  previousBase: string | null;
  deltaBase: string;
}

interface DeltaSummary {
  previous: SnapshotBatchSummaryDto;
  totalDelta: string;
  rows: DeltaRow[];
}

function diff2(a: string | null, b: string | null): string {
  return ((a ? Number(a) : 0) - (b ? Number(b) : 0)).toFixed(2);
}

function buildDelta(
  current: SnapshotBatchDetailDto,
  previous: SnapshotBatchDetailDto,
): DeltaSummary {
  const prevByWallet = new Map<string, BalanceSnapshotDto>(
    previous.entries.map((e) => [e.walletId, e]),
  );
  const seen = new Set<string>();
  const rows: DeltaRow[] = [];

  for (const cur of current.entries) {
    const prev = prevByWallet.get(cur.walletId) ?? null;
    seen.add(cur.walletId);
    rows.push({
      walletId: cur.walletId,
      walletName: cur.walletName,
      currencyCode: cur.currencyCode,
      currentBase: cur.amountBase,
      previousBase: prev?.amountBase ?? null,
      deltaBase: diff2(cur.amountBase, prev?.amountBase ?? null),
    });
  }

  for (const prev of previous.entries) {
    if (seen.has(prev.walletId)) continue;
    rows.push({
      walletId: prev.walletId,
      walletName: prev.walletName,
      currencyCode: prev.currencyCode,
      currentBase: null,
      previousBase: prev.amountBase,
      deltaBase: diff2(null, prev.amountBase),
    });
  }

  rows.sort((a, b) => a.walletName.localeCompare(b.walletName));

  return {
    previous: {
      id: previous.id,
      groupId: previous.groupId,
      snapshotDate: previous.snapshotDate,
      source: previous.source,
      note: previous.note,
      baseCurrency: previous.baseCurrency,
      totalBase: previous.totalBase,
      entryCount: previous.entryCount,
      createdBy: previous.createdBy,
      createdAt: previous.createdAt,
    },
    totalDelta: diff2(current.totalBase, previous.totalBase),
    rows,
  };
}

async function findPreviousBatch(
  groupId: string,
  current: SnapshotBatchDetailDto,
): Promise<SnapshotBatchDetailDto | null> {
  const candidates = await apiServerFetch<SnapshotBatchSummaryDto[]>(
    `/groups/${groupId}/snapshots/batches?to=${current.snapshotDate}&limit=20`,
  );
  const currentCreatedAt = current.createdAt;
  // ORDER BY snapshot_date DESC, created_at DESC. Same-date batches created after the current one appear first.
  const prev = candidates.find((b) => {
    if (b.id === current.id) return false;
    if (b.snapshotDate < current.snapshotDate) return true;
    return b.snapshotDate === current.snapshotDate && b.createdAt < currentCreatedAt;
  });
  if (!prev) return null;
  return apiServerFetch<SnapshotBatchDetailDto>(
    `/groups/${groupId}/snapshots/batches/${prev.id}`,
  );
}

export default async function SnapshotDetailPage({ params }: Props) {
  const { batchId } = await params;

  const me = await apiServerFetch<MeResponseDto>('/auth/me');
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const [t, tDetail, tTypes, tSources, tFxSources, formatAmount, formatSignedAmount] =
    await Promise.all([
      getTranslations('app.snapshots'),
      getTranslations('app.snapshots.detail'),
      getTranslations('app.wallets.types'),
      getTranslations('app.snapshots.sources'),
      getTranslations('app.snapshots.fxSources'),
      getAmountFormatter(),
      getSignedAmountFormatter(),
    ]);

  if (!active) {
    const tSettings = await getTranslations('app.settings.group.create');
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('detail.title')}</h2>
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

  let batch: SnapshotBatchDetailDto;
  try {
    batch = await apiServerFetch<SnapshotBatchDetailDto>(
      `/groups/${active.id}/snapshots/batches/${batchId}`,
    );
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) notFound();
    throw err;
  }

  const previous = await findPreviousBatch(active.id, batch);
  const delta = previous ? buildDelta(batch, previous) : null;
  const canDelete = active.role === 'OWNER' || active.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/snapshots"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tDetail('back')}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {tDetail('title', { date: batch.snapshotDate })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tDetail('subtitle', {
              source: tSources(batch.source),
              count: batch.entryCount,
            })}
          </p>
        </div>
        {canDelete ? (
          <DeleteSnapshotButton
            groupId={active.id}
            batchId={batch.id}
            snapshotDate={batch.snapshotDate}
          />
        ) : null}
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-6 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            {tDetail('header.total')}
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {formatAmount(batch.totalBase, batch.baseCurrency)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            {tDetail('header.date')}
          </div>
          <div className="mt-1 text-sm">{batch.snapshotDate}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            {tDetail('header.note')}
          </div>
          <div className="mt-1 text-sm">{batch.note ?? '—'}</div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold">{tDetail('entries.title')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{tDetail('entries.columns.wallet')}</th>
                <th className="py-2 pr-4 font-medium">{tDetail('entries.columns.type')}</th>
                <th className="py-2 pr-4 font-medium">{tDetail('entries.columns.currency')}</th>
                <th className="py-2 pr-4 text-right font-medium">{tDetail('entries.columns.amount')}</th>
                <th className="py-2 pr-4 text-right font-medium">{tDetail('entries.columns.fxRate')}</th>
                <th className="py-2 pr-4 font-medium">{tDetail('entries.columns.fxSource')}</th>
                <th className="py-2 pr-4 text-right font-medium">{tDetail('entries.columns.amountBase')}</th>
              </tr>
            </thead>
            <tbody>
              {batch.entries.map((e) => {
                const sameCurrency = e.currencyCode === batch.baseCurrency;
                return (
                  <tr key={e.id} className="border-b border-border last:border-b-0">
                    <td className="py-3 pr-4 font-medium">{e.walletName}</td>
                    <td className="py-3 pr-4">{tTypes(e.walletType)}</td>
                    <td className="py-3 pr-4">{e.currencyCode}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatAmount(e.amount, e.currencyCode)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {sameCurrency ? '—' : Number(e.fxRate).toFixed(6)}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {sameCurrency ? '—' : tFxSources(e.fxSource)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatAmount(e.amountBase, batch.baseCurrency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold">{tDetail('delta.title')}</h3>
        {!delta ? (
          <p className="text-sm text-muted-foreground">{tDetail('delta.none')}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
              <div className="text-sm">
                <Link
                  href={`/snapshots/${delta.previous.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {tDetail('delta.previousLink', { date: delta.previous.snapshotDate })}
                </Link>
                <span className="ml-2 text-muted-foreground">
                  ({formatAmount(delta.previous.totalBase, delta.previous.baseCurrency)})
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase text-muted-foreground">
                  {tDetail('delta.totalLabel')}
                </div>
                <div className="font-mono text-base font-semibold tabular-nums">
                  {formatSignedAmount(delta.totalDelta, batch.baseCurrency)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">{tDetail('delta.columns.wallet')}</th>
                    <th className="py-2 pr-4 text-right font-medium">{tDetail('delta.columns.previous')}</th>
                    <th className="py-2 pr-4 text-right font-medium">{tDetail('delta.columns.current')}</th>
                    <th className="py-2 pr-4 text-right font-medium">{tDetail('delta.columns.delta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {delta.rows.map((r) => (
                    <tr key={r.walletId} className="border-b border-border last:border-b-0">
                      <td className="py-3 pr-4 font-medium">{r.walletName}</td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        {r.previousBase
                          ? formatAmount(r.previousBase, batch.baseCurrency)
                          : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        {r.currentBase
                          ? formatAmount(r.currentBase, batch.baseCurrency)
                          : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        {formatSignedAmount(r.deltaBase, batch.baseCurrency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
