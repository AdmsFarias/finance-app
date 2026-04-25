'use client';

import { type ResetPasswordInput, resetPasswordSchema } from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState, resetPasswordAction } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth.reset');
  const tLogin = useTranslations('auth.login');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '' },
  });

  function onSubmit(data: ResetPasswordInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(data);
      if (result.ok) {
        setDone(true);
        return;
      }
      if (result.fieldErrors) {
        for (const [name, messageKey] of Object.entries(result.fieldErrors)) {
          setError(name as keyof ResetPasswordInput, {
            type: 'server',
            message: translateValidationError(tValidation, messageKey),
          });
        }
      }
      setTopError(result);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">{t('success')}</Alert>
        <Link href="/login">
          <Button variant="outline" className="w-full" type="button">
            {tLogin('submit')}
          </Button>
        </Link>
      </div>
    );
  }

  const topMessage = toMessage(topError);

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {topMessage ? <Alert variant="error">{topMessage}</Alert> : null}

      <input type="hidden" value={token} {...register('token')} />

      <FormField
        id="password"
        label={t('password')}
        error={translateValidationError(tValidation, errors.password?.message)}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          autoFocus
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
