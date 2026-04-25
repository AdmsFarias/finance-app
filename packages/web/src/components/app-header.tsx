import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { ActiveGroupSelect } from '@/components/active-group-select';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { UserMenu } from '@/components/user-menu';

import type { AuthUserDto, GroupSummaryDto } from '@finance/common';

interface Props {
  user: AuthUserDto;
  groups: GroupSummaryDto[];
  activeGroupId: string | null;
}

export async function AppHeader({ user, groups, activeGroupId }: Props) {
  const t = await getTranslations('common');
  const tHeader = await getTranslations('app.header');
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tight"
        >
          {t('appName')}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/wallets" className="hover:text-foreground">
            {tHeader('wallets')}
          </Link>
          <Link href="/snapshots" className="hover:text-foreground">
            {tHeader('snapshots')}
          </Link>
          <Link href="/fixed-expenses" className="hover:text-foreground">
            {tHeader('fixedExpenses')}
          </Link>
          <Link href="/reports" className="hover:text-foreground">
            {tHeader('reports')}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ActiveGroupSelect groups={groups} activeId={activeGroupId} />
          <LocaleSwitcher />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
