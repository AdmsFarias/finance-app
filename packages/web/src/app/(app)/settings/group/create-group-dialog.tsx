'use client';

import {
  type CreateGroupInput,
  type CurrencyDto,
  createGroupSchema,
} from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { createGroupAction } from '@/lib/groups/actions';

interface Props {
  currencies: CurrencyDto[];
}

export function CreateGroupDialog({ currencies }: Props) {
  const t = useTranslations('app.settings.group.create');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: '', baseCurrency: 'BRL' },
  });

  function onSubmit(data: CreateGroupInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await createGroupAction(data);
      if (result.ok) {
        reset();
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          setError(name as keyof CreateGroupInput, {
            type: 'server',
            message: translateValidationError(tValidation, key),
          });
        }
      }
      setTopError(result);
    });
  }

  const topMessage = toMessage(topError);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('title')} description={t('subtitle')}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

          <FormField
            id="newgroup-name"
            label={t('name')}
            error={translateValidationError(tValidation, errors.name?.message)}
          >
            <Input
              id="newgroup-name"
              autoFocus
              aria-invalid={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <FormField
            id="newgroup-currency"
            label={t('baseCurrency')}
            error={translateValidationError(tValidation, errors.baseCurrency?.message)}
          >
            <select
              id="newgroup-currency"
              aria-invalid={!!errors.baseCurrency}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              {...register('baseCurrency')}
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                {tCommon('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {tCommon('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
