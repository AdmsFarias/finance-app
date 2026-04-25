'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { type ActionState } from '@/lib/auth/actions';
import { toggleFixedExpenseCheckAction } from '@/lib/fixed-expenses/actions';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { useAmountFormatter } from '@/lib/intl/format';

import type { FixedExpenseChecklistItemDto } from '@finance/common';

interface Props {
  groupId: string;
  yearMonth: string;
  items: FixedExpenseChecklistItemDto[];
  canToggle: boolean;
}

export function ChecklistTable({ groupId, yearMonth, items, canToggle }: Props) {
  const t = useTranslations('app.fixedExpenses.checklist');
  const toMessage = useActionErrorMessage();
  const formatAmount = useAmountFormatter();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [topError, setTopError] = useState<ActionState | null>(null);

  const topMessage = toMessage(topError);

  function onToggle(expenseId: string) {
    setTopError(null);
    setBusyId(expenseId);
    startTransition(async () => {
      const result = await toggleFixedExpenseCheckAction(groupId, expenseId, { yearMonth });
      setBusyId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('empty')}
      </div>
    );
  }

  const totalsByCurrency = new Map<string, { expected: number; paid: number }>();
  for (const item of items) {
    const cur = item.expense.currencyCode;
    const row = totalsByCurrency.get(cur) ?? { expected: 0, paid: 0 };
    const exp = Number(item.expense.amount);
    if (!Number.isNaN(exp)) row.expected += exp;
    if (item.check) {
      const paidRaw = item.check.paidAmount ?? item.expense.amount;
      const paid = Number(paidRaw);
      if (!Number.isNaN(paid)) row.paid += paid;
    }
    totalsByCurrency.set(cur, row);
  }

  return (
    <section className="space-y-4">
      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="w-12 py-2 pl-4 pr-2 font-medium">
                  <span className="sr-only">{t('columns.check')}</span>
                </th>
                <th className="py-2 pr-4 font-medium">{t('columns.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('columns.dayOfMonth')}</th>
                <th className="py-2 pr-4 text-right font-medium">{t('columns.expected')}</th>
                <th className="py-2 pr-4 text-right font-medium">{t('columns.paid')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const { expense, check } = item;
                const checked = !!check;
                const rowBusy = busyId === expense.id && pending;
                return (
                  <tr
                    key={expense.id}
                    className="border-b border-border last:border-b-0"
                    data-checked={checked}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={checked}
                        disabled={!canToggle || rowBusy}
                        onChange={() => onToggle(expense.id)}
                        aria-label={expense.name}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <span className={checked ? 'text-muted-foreground line-through' : 'font-medium'}>
                        {expense.name}
                      </span>
                      {expense.note ? (
                        <span className="ml-2 text-xs text-muted-foreground">· {expense.note}</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{expense.dayOfMonth}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatAmount(expense.amount, expense.currencyCode)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {check ? formatAmount(check.paidAmount ?? expense.amount, expense.currencyCode) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="mb-2 font-medium">{t('totals.title')}</p>
        <ul className="space-y-1 text-muted-foreground">
          {[...totalsByCurrency.entries()].sort().map(([currency, totals]) => (
            <li key={currency} className="flex justify-between font-mono tabular-nums">
              <span>{currency}</span>
              <span>
                {formatAmount(totals.paid, currency)}
                {' / '}
                {formatAmount(totals.expected, currency)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">{t('totals.legend')}</p>
      </div>
    </section>
  );
}
