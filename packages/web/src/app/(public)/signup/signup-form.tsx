'use client';

import { type RegisterInput, registerSchema } from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState, signUpAction } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';

export function SignUpForm() {
  const t = useTranslations('auth.signUp');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  function onSubmit(data: RegisterInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await signUpAction(data);
      if (result.ok) return;
      if (result.fieldErrors) {
        for (const [name, messageKey] of Object.entries(result.fieldErrors)) {
          setError(name as keyof RegisterInput, {
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

      <FormField
        id="displayName"
        label={t('displayName')}
        error={translateValidationError(tValidation, errors.displayName?.message)}
      >
        <Input
          id="displayName"
          type="text"
          autoComplete="name"
          autoFocus
          aria-invalid={!!errors.displayName}
          {...register('displayName')}
        />
      </FormField>

      <FormField
        id="email"
        label={t('email')}
        error={translateValidationError(tValidation, errors.email?.message)}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
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
          autoComplete="new-password"
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
