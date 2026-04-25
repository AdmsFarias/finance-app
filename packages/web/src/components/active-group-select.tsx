'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { setActiveGroupAction } from '@/lib/groups/actions';

import type { GroupSummaryDto } from '@finance/common';

interface Props {
  groups: GroupSummaryDto[];
  activeId: string | null;
}

export function ActiveGroupSelect({ groups, activeId }: Props) {
  const t = useTranslations('app.header');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    if (!next || next === activeId) return;
    startTransition(async () => {
      const result = await setActiveGroupAction(next);
      if (result.ok) router.refresh();
    });
  }

  if (groups.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">{t('noGroups')}</span>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('activeGroup')}</span>
      <select
        aria-label={t('activeGroup')}
        value={activeId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm font-medium"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} · {g.baseCurrency}
          </option>
        ))}
      </select>
    </label>
  );
}
