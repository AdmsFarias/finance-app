import { getTranslations } from 'next-intl/server';

import { apiServerFetch } from '@/lib/api/server';
import { fetchCurrencies } from '@/lib/currencies/api';

import { PasswordForm } from './password-form';
import { ProfileForm } from './profile-form';

import type { AuthUserDto } from '@finance/common';

export default async function ProfilePage() {
  const [me, currencies] = await Promise.all([
    apiServerFetch<AuthUserDto>('/users/me'),
    fetchCurrencies(),
  ]);
  const t = await getTranslations('app.settings.profile');

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-6">
        <header className="mb-4">
          <h2 className="text-lg font-semibold">{t('profile.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
        </header>
        <ProfileForm user={me} currencies={currencies} />
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <header className="mb-4">
          <h2 className="text-lg font-semibold">{t('password.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('password.subtitle')}</p>
        </header>
        <PasswordForm />
      </section>
    </div>
  );
}
