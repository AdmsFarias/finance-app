import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { ForgotPasswordForm } from './forgot-form';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgot');
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <ForgotPasswordForm />
      <footer className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          {t('back')}
        </Link>
      </footer>
    </div>
  );
}
