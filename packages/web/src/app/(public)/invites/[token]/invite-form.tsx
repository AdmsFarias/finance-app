'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type ActionState, acceptInviteAction } from '@/lib/auth/actions';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';

export function InviteForm({ token }: { token: string }) {
  const t = useTranslations('auth.invite');
  const toMessage = useActionErrorMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);
  const [accepted, setAccepted] = useState(false);

  function onAccept() {
    setTopError(null);
    startTransition(async () => {
      const result = await acceptInviteAction({ token });
      if (result.ok) {
        setAccepted(true);
        setTimeout(() => router.replace('/dashboard'), 1200);
        return;
      }
      setTopError(result);
    });
  }

  if (accepted) {
    return <Alert variant="success">{t('accepted')}</Alert>;
  }

  const topMessage = toMessage(topError);

  return (
    <div className="flex flex-col gap-4">
      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}
      <Button type="button" onClick={onAccept} loading={pending}>
        {t('submit')}
      </Button>
    </div>
  );
}
