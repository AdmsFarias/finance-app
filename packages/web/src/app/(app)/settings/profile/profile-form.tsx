'use client';

import {
  type AuthUserDto,
  type CurrencyDto,
  type UpdateProfileInput,
  updateProfileSchema,
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
import { SUPPORTED_LOCALES } from '@/lib/server/cookies';
import { updateProfileAction } from '@/lib/users/actions';

interface Props {
  user: AuthUserDto;
  currencies: CurrencyDto[];
}

const LOCALE_LABELS: Record<string, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-ES': 'Español',
};

export function ProfileForm({ user, currencies }: Props) {
  const t = useTranslations('app.settings.profile.profile');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      locale: user.locale,
      timezone: user.timezone,
      baseCurrency: user.baseCurrency,
    },
  });

  function onSubmit(data: UpdateProfileInput) {
    setTopError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateProfileAction(data);
      if (result.ok) {
        setSuccess(true);
        // Name/locale in the header depend on /auth/me — revalidate the layout
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, messageKey] of Object.entries(result.fieldErrors)) {
          setError(name as keyof UpdateProfileInput, {
            type: 'server',
            message: translateValidationError(tValidation, messageKey),
          });
        }
      }
      setTopError(result);
    });
  }

  const topMessage = toMessage(topError);

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}
      {success ? <Alert variant="success">{t('success')}</Alert> : null}

      <FormField
        id="displayName"
        label={t('displayName')}
        error={translateValidationError(tValidation, errors.displayName?.message)}
      >
        <Input
          id="displayName"
          autoComplete="name"
          aria-invalid={!!errors.displayName}
          {...register('displayName')}
        />
      </FormField>

      <FormField
        id="locale"
        label={t('locale')}
        error={translateValidationError(tValidation, errors.locale?.message)}
      >
        <select
          id="locale"
          aria-invalid={!!errors.locale}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          {...register('locale')}
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l] ?? l}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        id="timezone"
        label={t('timezone')}
        hint={t('timezoneHint')}
        error={translateValidationError(tValidation, errors.timezone?.message)}
      >
        <Input
          id="timezone"
          aria-invalid={!!errors.timezone}
          {...register('timezone')}
        />
      </FormField>

      <FormField
        id="baseCurrency"
        label={t('baseCurrency')}
        error={translateValidationError(tValidation, errors.baseCurrency?.message)}
      >
        <select
          id="baseCurrency"
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

      <Button type="submit" loading={pending} disabled={!isDirty}>
        {t('submit')}
      </Button>
    </form>
  );
}
