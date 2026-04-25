'use client';

import { SnapshotSource } from '@finance/common';
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
import { createSnapshotAction } from '@/lib/snapshots/actions';

import type { WalletDto, WalletType } from '@finance/common';

interface FormValues {
  snapshotDate: string;
  note: string;
  entries: Array<{
    walletId: string;
    walletName: string;
    walletType: WalletType;
    currencyCode: string;
    amount: string;
  }>;
}

interface Props {
  groupId: string;
  baseCurrency: string;
  wallets: WalletDto[];
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const AMOUNT_REGEX = /^-?\d+(\.\d{1,10})?$/;

function buildDefaults(wallets: WalletDto[]): FormValues {
  return {
    snapshotDate: todayIso(),
    note: '',
    entries: wallets.map((w) => ({
      walletId: w.id,
      walletName: w.name,
      walletType: w.type,
      currencyCode: w.currencyCode.trim(),
      amount: '',
    })),
  };
}

export function NewSnapshotForm({ groupId, baseCurrency, wallets }: Props) {
  const t = useTranslations('app.snapshots');
  const tTypes = useTranslations('app.wallets.types');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);
  const [success, setSuccess] = useState<{ totalBase: string; entryCount: number } | null>(null);
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: buildDefaults(wallets) });

  function onSubmit(data: FormValues) {
    setTopError(null);
    setSuccess(null);
    clearErrors();

    const filled = data.entries
      .map((e, idx) => ({ ...e, idx }))
      .filter((e) => e.amount.trim() !== '');

    if (filled.length === 0) {
      setTopError({
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'validation.snapshot.entriesRequired',
      });
      return;
    }

    let invalidIdx = -1;
    for (const e of filled) {
      if (!AMOUNT_REGEX.test(e.amount.trim())) {
        invalidIdx = e.idx;
        break;
      }
    }
    if (invalidIdx >= 0) {
      setError(`entries.${invalidIdx}.amount` as const, {
        type: 'validate',
        message: 'validation.amount.invalid',
      });
      return;
    }

    const payload = {
      batchId,
      snapshotDate: data.snapshotDate,
      source: SnapshotSource.MANUAL,
      note: data.note.trim() || undefined,
      entries: filled.map((e) => ({ walletId: e.walletId, amount: e.amount.trim() })),
    };

    startTransition(async () => {
      const result = await createSnapshotAction(groupId, payload);
      if (result.ok) {
        if (result.batch) {
          setSuccess({
            totalBase: result.batch.totalBase,
            entryCount: result.batch.entryCount,
          });
        }
        setBatchId(crypto.randomUUID());
        reset(buildDefaults(wallets));
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          setError(name as 'snapshotDate' | 'note' | `entries.${number}.amount`, {
            type: 'server',
            message: key,
          });
        }
      }
      setTopError(result);
    });
  }

  const topMessage = toMessage(topError);

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      {success ? (
        <Alert variant="success">
          {t('success.message', {
            total: success.totalBase,
            currency: baseCurrency,
            count: success.entryCount,
          })}
        </Alert>
      ) : null}

      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <FormField
          id="snapshot-date"
          label={t('fields.snapshotDate')}
          error={translateValidationError(tValidation, errors.snapshotDate?.message)}
        >
          <Input
            id="snapshot-date"
            type="date"
            aria-invalid={!!errors.snapshotDate}
            {...register('snapshotDate', { required: 'validation.required' })}
          />
        </FormField>

        <FormField
          id="snapshot-note"
          label={t('fields.note')}
          hint={t('fields.noteHint')}
          error={translateValidationError(tValidation, errors.note?.message)}
        >
          <Input
            id="snapshot-note"
            maxLength={500}
            aria-invalid={!!errors.note}
            {...register('note')}
          />
        </FormField>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{t('balances.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('balances.subtitle')}</p>
        </div>
        <div className="flex flex-col gap-3">
          {wallets.map((w, i) => {
            const raw = errors.entries?.[i]?.amount?.message;
            const err = typeof raw === 'string' ? raw : undefined;
            return (
              <div
                key={w.id}
                className="grid grid-cols-[1fr_160px] items-end gap-3 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {tTypes(w.type)} — {w.currencyCode.trim()}
                  </div>
                </div>
                <FormField
                  id={`entry-${i}`}
                  label={w.currencyCode.trim()}
                  error={translateValidationError(tValidation, err)}
                >
                  <Input
                    id={`entry-${i}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={!!err}
                    {...register(`entries.${i}.amount`)}
                  />
                </FormField>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
