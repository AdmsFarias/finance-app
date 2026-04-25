'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type ActionState } from '@/lib/auth/actions';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { deleteSnapshotAction } from '@/lib/snapshots/actions';

interface Props {
  groupId: string;
  batchId: string;
  snapshotDate: string;
}

export function DeleteSnapshotButton({ groupId, batchId, snapshotDate }: Props) {
  const t = useTranslations('app.snapshots.detail.delete');
  const toMessage = useActionErrorMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ActionState | null>(null);

  const message = toMessage(error);

  function onClick() {
    if (!confirm(t('confirm', { date: snapshotDate }))) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSnapshotAction(groupId, batchId);
      if (result.ok) {
        router.push('/snapshots');
        router.refresh();
        return;
      }
      setError(result);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        loading={pending}
        onClick={onClick}
      >
        {t('button')}
      </Button>
      {message ? <Alert variant="error">{message}</Alert> : null}
    </div>
  );
}
