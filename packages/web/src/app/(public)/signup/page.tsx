import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SignUpForm } from './signup-form';

export default async function SignUpPage() {
  const t = await getTranslations('auth.signUp');
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <SignUpForm />
      <footer className="text-center text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t('loginLink')}
        </Link>
      </footer>
    </div>
  );
}
