'use client';

import { type LoginInput, loginSchema } from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState, signInAction } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  function onSubmit(data: LoginInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await signInAction(data);
      if (result.ok) return; // redirect em fluxo normal
      if (result.fieldErrors) {
        for (const [name, messageKey] of Object.entries(result.fieldErrors)) {
          setError(name as keyof LoginInput, {
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

      <FormField id="email" label={t('email')} error={translateValidationError(tValidation, errors.email?.message)}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </FormField>

      <FormField
        id="password"
        label={t('password')}
        error={translateValidationError(tValidation, errors.password?.message)}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
      </FormField>

      <Button type="submit" loading={pending}>
        {t('submit')}
      </Button>
    </form>
  );
}

