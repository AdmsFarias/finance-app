'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

interface Props {
  checked: boolean;
}

export function ShowArchivedToggle({ checked }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations('app.fixedExpenses');
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(sp.toString());
    if (e.target.checked) params.set('archived', '1');
    else params.delete('archived');
    startTransition(() => {
      const qs = params.toString();
      router.replace(`/fixed-expenses${qs ? `?${qs}` : ''}`);
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border"
        checked={checked}
        onChange={onChange}
        disabled={pending}
      />
      {t('showArchived')}
    </label>
  );
}
