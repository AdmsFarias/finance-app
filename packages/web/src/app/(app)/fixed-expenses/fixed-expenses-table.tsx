'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type ActionState } from '@/lib/auth/actions';
import {
  archiveFixedExpenseAction,
  restoreFixedExpenseAction,
} from '@/lib/fixed-expenses/actions';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { useAmountFormatter } from '@/lib/intl/format';

import { EditFixedExpenseDialog } from './edit-fixed-expense-dialog';

import type { CurrencyDto, FixedExpenseDto } from '@finance/common';

interface Props {
  groupId: string;
  expenses: FixedExpenseDto[];
  currencies: CurrencyDto[];
  canWrite: boolean;
  canArchive: boolean;
}

export function FixedExpensesTable({
  groupId,
  expenses,
  currencies,
  canWrite,
  canArchive,
}: Props) {
  const t = useTranslations('app.fixedExpenses');
  const toMessage = useActionErrorMessage();
  const formatAmount = useAmountFormatter();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [topError, setTopError] = useState<ActionState | null>(null);

  const topMessage = toMessage(topError);

  function onArchive(expense: FixedExpenseDto) {
    if (!confirm(t('actions.archiveConfirm', { name: expense.name }))) return;
    setTopError(null);
    setBusyId(expense.id);
    startTransition(async () => {
      const result = await archiveFixedExpenseAction(groupId, expense.id);
      setBusyId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  function onRestore(expense: FixedExpenseDto) {
    if (!confirm(t('actions.restoreConfirm', { name: expense.name }))) return;
    setTopError(null);
    setBusyId(expense.id);
    startTransition(async () => {
      const result = await restoreFixedExpenseAction(groupId, expense.id);
      setBusyId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      {topMessage ? (
        <div className="mb-4">
          <Alert variant="error">{topMessage}</Alert>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t('table.name')}</th>
              <th className="py-2 pr-4 font-medium">{t('table.dayOfMonth')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('table.amount')}</th>
              <th className="py-2 pr-4 font-medium">{t('table.note')}</th>
              <th className="py-2 pr-4 font-medium sr-only">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => {
              const rowBusy = busyId === e.id && pending;
              const isArchived = !!e.archivedAt;
              return (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-b-0 data-[archived=true]:opacity-60"
                  data-archived={isArchived}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium">{e.name}</span>
                    {isArchived ? (
                      <span className="ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {t('archivedBadge')}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{t('table.dayValue', { day: e.dayOfMonth })}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                    {formatAmount(e.amount, e.currencyCode)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{e.note ?? '—'}</td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      {canWrite && !isArchived ? (
                        <EditFixedExpenseDialog
                          groupId={groupId}
                          expense={e}
                          currencies={currencies}
                        />
                      ) : null}
                      {canArchive && !isArchived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={rowBusy}
                          onClick={() => onArchive(e)}
                        >
                          {t('actions.archive')}
                        </Button>
                      ) : null}
                      {canArchive && isArchived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={rowBusy}
                          onClick={() => onRestore(e)}
                        >
                          {t('actions.restore')}
                        </Button>
                      ) : null}
                    </div>
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
