'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { setDisplayCurrencyAction } from '@/lib/dashboard/actions';

import type { CurrencyDto } from '@finance/common';

interface Props {
  currencies: CurrencyDto[];
  value: string;
  groupBaseCurrency: string;
}

export function DisplayCurrencySelect({ currencies, value, groupBaseCurrency }: Props) {
  const t = useTranslations('app.dashboard.displayCurrency');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    startTransition(async () => {
      const result = await setDisplayCurrencyAction(next || null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t('label')}</span>
      <select
        aria-label={t('label')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm font-medium"
      >
        <option value="">{t('groupDefault', { code: groupBaseCurrency })}</option>
        {currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
    </label>
  );
}
