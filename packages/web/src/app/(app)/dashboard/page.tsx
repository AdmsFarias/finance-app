import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Alert } from '@/components/ui/alert';
import { apiServerFetch } from '@/lib/api/server';
import { fetchCurrencies } from '@/lib/currencies/api';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import {
  getAmountFormatter,
  getNumberFormatter,
  getSignedAmountFormatter,
} from '@/lib/intl/format';
import { ACTIVE_GROUP_COOKIE, DISPLAY_CURRENCY_COOKIE } from '@/lib/server/cookies';

import { DisplayCurrencySelect } from './display-currency-select';
import { Sparkline } from './sparkline';

import type {
  DashboardCurrentDto,
  DashboardHistoryPointDto,
  FixedExpenseChecklistItemDto,
  MeResponseDto,
} from '@finance/common';

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function DashboardPage() {
  const me = await apiServerFetch<MeResponseDto>('/auth/me');
  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);
  const t = await getTranslations('app.dashboard');

  if (!active) {
    const tSettings = await getTranslations('app.settings.group.create');
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        </header>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('empty.noGroup')}</p>
          <div className="mt-4">
            <Link
              href="/settings/group"
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              {tSettings('button')}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const yearMonth = currentYearMonth();
  const canWrite = active.role !== 'VIEWER';
  const cookieDisplay = store.get(DISPLAY_CURRENCY_COOKIE)?.value || '';
  const displayQs = cookieDisplay ? `&displayCurrency=${encodeURIComponent(cookieDisplay)}` : '';
  const currentQs = cookieDisplay ? `?displayCurrency=${encodeURIComponent(cookieDisplay)}` : '';

  const [current, history, checklist, currencies, formatAmount, formatSigned, formatNumber] =
    await Promise.all([
      apiServerFetch<DashboardCurrentDto | undefined>(
        `/groups/${active.id}/snapshots/stats/current${currentQs}`,
      ),
      apiServerFetch<DashboardHistoryPointDto[]>(
        `/groups/${active.id}/snapshots/stats/history?limit=30${displayQs}`,
      ),
      apiServerFetch<FixedExpenseChecklistItemDto[]>(
        `/groups/${active.id}/fixed-expenses/checklist?yearMonth=${yearMonth}`,
      ),
      fetchCurrencies(),
      getAmountFormatter(),
      getSignedAmountFormatter(),
      getNumberFormatter(),
    ]);

  const last = history[history.length - 1];
  const prev = history.length >= 2 ? history[history.length - 2] : undefined;
  const sameCurrency = !!(last && prev && last.displayCurrency === prev.displayCurrency);
  const deltaValue =
    sameCurrency && last && prev ? Number(last.displayAmount) - Number(prev.displayAmount) : null;
  const sparkValues = sameCurrency ? history.map((p) => Number(p.displayAmount)) : [];

  const paidCount = checklist.filter((i) => i.check !== null).length;
  const totalCount = checklist.length;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { group: active.name })}</p>
        </div>
        <DisplayCurrencySelect
          currencies={currencies}
          value={cookieDisplay}
          groupBaseCurrency={active.baseCurrency}
        />
      </header>

      {current?.fallback ? (
        <Alert variant="info">
          {t('fallback.warning', {
            requested: current.fallback.requested,
            base: current.baseCurrency,
          })}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">{t('current.title')}</h2>
          {current ? (
            <>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {formatAmount(current.consolidatedAmount, current.displayCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('current.asOf', { date: current.snapshotDate })}
              </p>
              {current.breakdown.length > 1 ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('current.breakdownLabel')}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
                    {current.breakdown.map((b) => (
                      <li key={b.currencyCode} className="text-foreground">
                        <span className="font-medium">{b.currencyCode}</span>{' '}
                        <span>{formatNumber(b.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-muted-foreground">{t('current.noData')}</p>
              {canWrite ? (
                <Link
                  href="/snapshots/new"
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  {t('current.cta')}
                </Link>
              ) : null}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">{t('delta.title')}</h2>
          {deltaValue !== null && last && prev ? (
            <>
              <p
                className={`mt-2 text-3xl font-semibold tabular-nums ${
                  deltaValue > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : deltaValue < 0
                      ? 'text-destructive'
                      : ''
                }`}
              >
                {formatSigned(deltaValue, last.displayCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('delta.from', { previous: prev.snapshotDate, current: last.snapshotDate })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {last && prev && !sameCurrency ? t('delta.currencyMismatch') : t('delta.noPrevious')}
            </p>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card p-6 md:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">{t('history.title')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('history.subtitle', { count: history.length })}
              </p>
            </div>
            {history.length > 0 ? (
              <Link href="/snapshots" className="text-xs font-medium text-primary hover:underline">
                {t('history.viewAll')}
              </Link>
            ) : null}
          </div>
          <div className="mt-4">
            {sparkValues.length >= 2 && last ? (
              <>
                <Sparkline values={sparkValues} ariaLabel={t('history.title')} />
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>{history[0]!.snapshotDate}</span>
                  <span>{last.snapshotDate}</span>
                </div>
              </>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('history.needMore')}</p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card p-6 md:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">{t('checklist.title')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('checklist.subtitle', { yearMonth })}
              </p>
            </div>
            {totalCount > 0 ? (
              <Link
                href="/fixed-expenses/checklist"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('checklist.viewAll')}
              </Link>
            ) : null}
          </div>
          {totalCount > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-3xl font-semibold tabular-nums">
                {t('checklist.progress', { paid: paidCount, total: totalCount })}
              </p>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={paidCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
              >
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(paidCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t('checklist.empty')}</p>
          )}
        </article>
      </div>
    </section>
  );
}
