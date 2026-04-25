'use client';

import {
  type CurrencyDto,
  type GroupDto,
  type UpdateGroupInput,
  updateGroupSchema,
} from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { archiveGroupAction, updateGroupAction } from '@/lib/groups/actions';

interface Props {
  group: GroupDto;
  role: string;
  currencies: CurrencyDto[];
}

export function GroupDetailsForm({ group, role, currencies }: Props) {
  const t = useTranslations('app.settings.group.details');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();
  const router = useRouter();

  const canEdit = role === 'OWNER' || role === 'ADMIN';
  const canArchive = role === 'OWNER';

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateGroupInput>({
    resolver: zodResolver(updateGroupSchema),
    defaultValues: {
      name: group.name,
      baseCurrency: group.baseCurrency,
    },
  });

  function onSubmit(data: UpdateGroupInput) {
    setTopError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateGroupAction(group.id, data);
      if (result.ok) {
        setSuccess(true);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          setError(name as keyof UpdateGroupInput, {
            type: 'server',
            message: translateValidationError(tValidation, key),
          });
        }
      }
      setTopError(result);
    });
  }

  function onArchive() {
    if (!canArchive) return;
    if (!confirm(t('archiveConfirm', { name: group.name }))) return;
    setTopError(null);
    startTransition(async () => {
      const result = await archiveGroupAction(group.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  const topMessage = toMessage(topError);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canArchive ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onArchive}
            loading={pending}
          >
            {t('archive')}
          </Button>
        ) : null}
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}
        {success ? <Alert variant="success">{t('success')}</Alert> : null}

        <FormField
          id="group-name"
          label={t('name')}
          error={translateValidationError(tValidation, errors.name?.message)}
        >
          <Input
            id="group-name"
            disabled={!canEdit}
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </FormField>

        <FormField
          id="group-baseCurrency"
          label={t('baseCurrency')}
          error={translateValidationError(tValidation, errors.baseCurrency?.message)}
        >
          <select
            id="group-baseCurrency"
            disabled={!canEdit}
            aria-invalid={!!errors.baseCurrency}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm disabled:opacity-50"
            {...register('baseCurrency')}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </FormField>

        {canEdit ? (
          <Button type="submit" loading={pending} disabled={!isDirty}>
            {tCommon('save')}
          </Button>
        ) : null}
      </form>
    </section>
  );
}
