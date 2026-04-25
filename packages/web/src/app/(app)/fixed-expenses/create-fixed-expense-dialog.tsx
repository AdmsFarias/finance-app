'use client';

import {
  type CreateFixedExpenseInput,
  type CurrencyDto,
  RecurrenceFreq,
  createFixedExpenseSchema,
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
import { createFixedExpenseAction } from '@/lib/fixed-expenses/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';

interface Props {
  groupId: string;
  currencies: CurrencyDto[];
  defaultCurrency?: string;
}

export function CreateFixedExpenseDialog({
  groupId,
  currencies,
  defaultCurrency = 'BRL',
}: Props) {
  const t = useTranslations('app.fixedExpenses');
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
  } = useForm<CreateFixedExpenseInput>({
    resolver: zodResolver(createFixedExpenseSchema),
    defaultValues: {
      name: '',
      amount: '0',
      currencyCode: defaultCurrency,
      dayOfMonth: 1,
      recurrence: RecurrenceFreq.MONTHLY,
    },
  });

  function onSubmit(data: CreateFixedExpenseInput) {
    setTopError(null);
    startTransition(async () => {
      const payload: CreateFixedExpenseInput = {
        ...data,
        note: data.note === '' ? undefined : data.note,
      };
      const result = await createFixedExpenseAction(groupId, payload);
      if (result.ok) {
        reset();
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          if (name === '_') continue;
          setError(name as keyof CreateFixedExpenseInput, {
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
        <Button variant="primary" size="sm">
          {t('create.button')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('create.title')} description={t('create.subtitle')}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

          <FormField
            id="new-fe-name"
            label={t('fields.name')}
            error={translateValidationError(tValidation, errors.name?.message)}
          >
            <Input id="new-fe-name" autoFocus aria-invalid={!!errors.name} {...register('name')} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="new-fe-amount"
              label={t('fields.amount')}
              error={translateValidationError(tValidation, errors.amount?.message)}
            >
              <Input
                id="new-fe-amount"
                inputMode="decimal"
                aria-invalid={!!errors.amount}
                {...register('amount')}
              />
            </FormField>

            <FormField
              id="new-fe-currency"
              label={t('fields.currencyCode')}
              error={translateValidationError(tValidation, errors.currencyCode?.message)}
            >
              <select
                id="new-fe-currency"
                aria-invalid={!!errors.currencyCode}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                {...register('currencyCode')}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField
            id="new-fe-day"
            label={t('fields.dayOfMonth')}
            hint={t('fields.dayOfMonthHint')}
            error={translateValidationError(tValidation, errors.dayOfMonth?.message)}
          >
            <Input
              id="new-fe-day"
              type="number"
              min={1}
              max={31}
              aria-invalid={!!errors.dayOfMonth}
              {...register('dayOfMonth', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            id="new-fe-note"
            label={t('fields.note')}
            hint={t('fields.noteHint')}
            error={translateValidationError(tValidation, errors.note?.message)}
          >
            <Input
              id="new-fe-note"
              aria-invalid={!!errors.note}
              {...register('note')}
            />
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
