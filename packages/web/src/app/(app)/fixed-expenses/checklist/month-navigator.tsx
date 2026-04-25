'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

interface Props {
  yearMonth: string;
}

function addMonths(ym: string, delta: number): string {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function MonthNavigator({ yearMonth }: Props) {
  const t = useTranslations('app.fixedExpenses.checklist');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(delta: number) {
    const target = addMonths(yearMonth, delta);
    startTransition(() => {
      router.replace(`/fixed-expenses/checklist?yearMonth=${target}`);
    });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return;
    startTransition(() => {
      router.replace(`/fixed-expenses/checklist?yearMonth=${v}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
      >
        {t('prev')}
      </button>
      <input
        type="month"
        value={yearMonth}
        onChange={onPick}
        disabled={pending}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm"
      />
      <button
        type="button"
        onClick={() => go(1)}
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
      >
        {t('next')}
      </button>
    </div>
  );
}
