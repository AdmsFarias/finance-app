'use client';

import {
  type CurrencyDto,
  type FixedExpenseDto,
  type UpdateFixedExpenseInput,
  updateFixedExpenseSchema,
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
import { updateFixedExpenseAction } from '@/lib/fixed-expenses/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';

interface Props {
  groupId: string;
  expense: FixedExpenseDto;
  currencies: CurrencyDto[];
}

export function EditFixedExpenseDialog({ groupId, expense, currencies }: Props) {
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
    formState: { errors, isDirty },
  } = useForm<UpdateFixedExpenseInput>({
    resolver: zodResolver(updateFixedExpenseSchema),
    defaultValues: {
      name: expense.name,
      amount: expense.amount,
      currencyCode: expense.currencyCode,
      dayOfMonth: expense.dayOfMonth,
      note: expense.note ?? '',
    },
  });

  function onSubmit(data: UpdateFixedExpenseInput) {
    setTopError(null);
    startTransition(async () => {
      const payload: UpdateFixedExpenseInput = {
        ...data,
        note: data.note === '' ? null : data.note,
      };
      const result = await updateFixedExpenseAction(groupId, expense.id, payload);
      if (result.ok) {
        reset(data);
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          if (name === '_') continue;
          setError(name as keyof UpdateFixedExpenseInput, {
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
        <Button variant="ghost" size="sm">
          {t('actions.edit')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('edit.title')} description={t('edit.subtitle')}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

          <FormField
            id={`edit-fe-name-${expense.id}`}
            label={t('fields.name')}
            error={translateValidationError(tValidation, errors.name?.message)}
          >
            <Input
              id={`edit-fe-name-${expense.id}`}
              autoFocus
              aria-invalid={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id={`edit-fe-amount-${expense.id}`}
              label={t('fields.amount')}
              error={translateValidationError(tValidation, errors.amount?.message)}
            >
              <Input
                id={`edit-fe-amount-${expense.id}`}
                inputMode="decimal"
                aria-invalid={!!errors.amount}
                {...register('amount')}
              />
            </FormField>

            <FormField
              id={`edit-fe-currency-${expense.id}`}
              label={t('fields.currencyCode')}
              error={translateValidationError(tValidation, errors.currencyCode?.message)}
            >
              <select
                id={`edit-fe-currency-${expense.id}`}
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
            id={`edit-fe-day-${expense.id}`}
            label={t('fields.dayOfMonth')}
            error={translateValidationError(tValidation, errors.dayOfMonth?.message)}
          >
            <Input
              id={`edit-fe-day-${expense.id}`}
              type="number"
              min={1}
              max={31}
              aria-invalid={!!errors.dayOfMonth}
              {...register('dayOfMonth', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            id={`edit-fe-note-${expense.id}`}
            label={t('fields.note')}
            error={translateValidationError(tValidation, errors.note?.message)}
          >
            <Input
              id={`edit-fe-note-${expense.id}`}
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
            <Button type="submit" loading={pending} disabled={!isDirty}>
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
