import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { LoginForm } from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth.login');
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <LoginForm />
      <footer className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
          {t('forgot')}
        </Link>
        <p className="text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t('signUpLink')}
          </Link>
        </p>
      </footer>
    </div>
  );
}
