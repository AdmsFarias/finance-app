'use client';

import { type ForgotPasswordInput, forgotPasswordSchema } from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState, forgotPasswordAction } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgot');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  function onSubmit(data: ForgotPasswordInput) {
    setTopError(null);
    setSent(false);
    startTransition(async () => {
      const result = await forgotPasswordAction(data);
      if (result.ok) {
        setSent(true);
        return;
      }
      if (result.fieldErrors) {
        for (const [name, messageKey] of Object.entries(result.fieldErrors)) {
          setError(name as keyof ForgotPasswordInput, {
            type: 'server',
            message: translateValidationError(tValidation, messageKey),
          });
        }
      }
      setTopError(result);
    });
  }

  const topMessage = toMessage(topError);

  if (sent) {
    return <Alert variant="success">{t('sent')}</Alert>;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

      <FormField
        id="email"
        label={t('email')}
        error={translateValidationError(tValidation, errors.email?.message)}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </FormField>

      <Button type="submit" loading={pending}>
        {t('submit')}
      </Button>
    </form>
  );
}
