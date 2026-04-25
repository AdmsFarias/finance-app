'use client';

import { type ChangePasswordInput, changePasswordSchema } from '@finance/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ActionState, signOutAction } from '@/lib/auth/actions';
import { translateValidationError } from '@/lib/forms/translate-validation';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { changePasswordAction } from '@/lib/users/actions';

export function PasswordForm() {
  const t = useTranslations('app.settings.profile.password');
  const tValidation = useTranslations('validation');
  const toMessage = useActionErrorMessage();

  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<ActionState | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  function onSubmit(data: ChangePasswordInput) {
    setTopError(null);
    startTransition(async () => {
      const result = await changePasswordAction(data);
      if (result.ok) {
        // API revokes all sessions — force re-login by clearing local cookies
        reset();
        await signOutAction();
        return;
      }
      if (result.fieldErrors) {
        for (const [name, messageKey] of Object.entries(result.fieldErrors)) {
          setError(name as keyof ChangePasswordInput, {
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

      <Alert variant="info">{t('revokeWarning')}</Alert>

      <FormField
        id="currentPassword"
        label={t('currentPassword')}
        error={translateValidationError(tValidation, errors.currentPassword?.message)}
      >
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.currentPassword}
          {...register('currentPassword')}
        />
      </FormField>

      <FormField
        id="newPassword"
        label={t('newPassword')}
        error={translateValidationError(tValidation, errors.newPassword?.message)}
      >
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...register('newPassword')}
        />
      </FormField>

      <Button type="submit" loading={pending}>
        {t('submit')}
      </Button>
    </form>
  );
}
