import { getTranslations } from 'next-intl/server';

import { ResetPasswordForm } from './reset-form';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const t = await getTranslations('auth.reset');
  const { token } = await params;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <ResetPasswordForm token={token} />
    </div>
  );
}
