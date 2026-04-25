'use client';

import {
  type CreateWalletInput,
  type CurrencyDto,
  WalletType,
  createWalletSchema,
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
import { createWalletAction } from '@/lib/wallets/actions';

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
  currencies: CurrencyDto[];
  defaultCurrency?: string;
}

export function CreateWalletDialog({ groupId, currencies, defaultCurrency = 'BRL' }: Props) {
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
    formState: { errors },
  } = useForm<CreateWalletInput>({
    resolver: zodResolver(createWalletSchema),
    defaultValues: {
      name: '',
      type: WalletType.CHECKING,
      currencyCode: defaultCurrency,
      initialBalance: '0',
    },
  });

  function onSubmit(data: CreateWalletInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await createWalletAction(groupId, data);
      if (result.ok) {
        reset();
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, key] of Object.entries(result.fieldErrors)) {
          setError(name as keyof CreateWalletInput, {
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
            id="new-wallet-name"
            label={t('fields.name')}
            error={translateValidationError(tValidation, errors.name?.message)}
          >
            <Input
              id="new-wallet-name"
              autoFocus
              aria-invalid={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <FormField
            id="new-wallet-type"
            label={t('fields.type')}
            error={translateValidationError(tValidation, errors.type?.message)}
          >
            <select
              id="new-wallet-type"
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
            id="new-wallet-currency"
            label={t('fields.currencyCode')}
            error={translateValidationError(tValidation, errors.currencyCode?.message)}
          >
            <select
              id="new-wallet-currency"
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
            id="new-wallet-initial"
            label={t('fields.initialBalance')}
            hint={t('fields.initialBalanceHint')}
            error={translateValidationError(tValidation, errors.initialBalance?.message)}
          >
            <Input
              id="new-wallet-initial"
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
            <Button type="submit" loading={pending}>
              {tCommon('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
