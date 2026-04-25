'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

interface Props {
  checked: boolean;
}

export function ShowArchivedToggle({ checked }: Props) {
  const t = useTranslations('app.wallets');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = new URLSearchParams(params.toString());
    if (e.target.checked) next.set('archived', '1');
    else next.delete('archived');
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={pending}
        className="h-4 w-4 rounded border-border"
      />
      {t('showArchived')}
    </label>
  );
}
