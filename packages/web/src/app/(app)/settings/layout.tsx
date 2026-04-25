import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';

import { SettingsNav } from './settings-nav';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('app.settings');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
