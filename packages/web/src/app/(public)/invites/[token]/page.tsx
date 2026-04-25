import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/server/cookies';

import { InviteForm } from './invite-form';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const store = await cookies();
  const authenticated = !!store.get(ACCESS_COOKIE)?.value || !!store.get(REFRESH_COOKIE)?.value;
  if (!authenticated) {
    redirect(`/login?next=${encodeURIComponent(`/invites/${token}`)}`);
  }

  const t = await getTranslations('auth.invite');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <InviteForm token={token} />
    </div>
  );
}
