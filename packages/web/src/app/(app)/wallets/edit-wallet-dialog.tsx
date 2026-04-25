'use client';

import {
  type CurrencyDto,
  type UpdateWalletInput,
  type WalletDto,
  WalletType,
  updateWalletSchema,
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
import { updateWalletAction } from '@/lib/wallets/actions';

const WALLET_TYPES: WalletType[] = [
  WalletType.CHECKING,
  WalletType.SAVINGS,
  WalletType.CASH,
  WalletType.CREDIT_CARD,
  WalletType.INVESTMENT,
  WalletType.OTHER,
];

interface Props {
  groupId: string;
  wallet: WalletDto;
  currencies: CurrencyDto[];
}

export function EditWalletDialog({ groupId, wallet, currencies }: Props) {
  const t = useTranslations('app.wallets');
  const tTypes = useTranslations('app.wallets.types');
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
  } = useForm<UpdateWalletInput>({
    resolver: zodResolver(updateWalletSchema),
    defaultValues: {
      name: wallet.name,
      type: wallet.type,
      currencyCode: wallet.currencyCode,
      initialBalance: wallet.initialBalance,
    },
  });

  function onSubmit(data: UpdateWalletInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await updateWalletAction(groupId, wallet.id, data);
      if (result.ok) {
        reset(data);
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          setError(name as keyof UpdateWalletInput, {
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
            id={`edit-wallet-name-${wallet.id}`}
            label={t('fields.name')}
            error={translateValidationError(tValidation, errors.name?.message)}
          >
            <Input
              id={`edit-wallet-name-${wallet.id}`}
              autoFocus
              aria-invalid={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <FormField
            id={`edit-wallet-type-${wallet.id}`}
            label={t('fields.type')}
            error={translateValidationError(tValidation, errors.type?.message)}
          >
            <select
              id={`edit-wallet-type-${wallet.id}`}
              aria-invalid={!!errors.type}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              {...register('type')}
            >
              {WALLET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tTypes(type)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id={`edit-wallet-currency-${wallet.id}`}
            label={t('fields.currencyCode')}
            error={translateValidationError(tValidation, errors.currencyCode?.message)}
          >
            <select
              id={`edit-wallet-currency-${wallet.id}`}
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

          <FormField
            id={`edit-wallet-initial-${wallet.id}`}
            label={t('fields.initialBalance')}
            hint={t('fields.initialBalanceHint')}
            error={translateValidationError(tValidation, errors.initialBalance?.message)}
          >
            <Input
              id={`edit-wallet-initial-${wallet.id}`}
              inputMode="decimal"
              aria-invalid={!!errors.initialBalance}
              {...register('initialBalance')}
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
