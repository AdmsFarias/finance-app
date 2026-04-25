import { z } from 'zod';

import { SUPPORTED_LOCALES } from '../shared/enums';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'validation.email.invalid')
  .max(254, 'validation.email.tooLong')
  .email('validation.email.invalid');

export const passwordSchema = z
  .string()
  .min(10, 'validation.password.tooShort')
  .max(256, 'validation.password.tooLong');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'validation.required').max(120),
  locale: z
    .enum(SUPPORTED_LOCALES, {
      errorMap: () => ({ message: 'validation.locale.invalid' }),
    })
    .optional(),
  timezone: z.string().min(1).max(64).optional(),
  baseCurrency: z.string().length(3).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation.required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(512),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required'),
    newPassword: passwordSchema,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'validation.password.sameAsCurrent',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  locale: z
    .enum(SUPPORTED_LOCALES, {
      errorMap: () => ({ message: 'validation.locale.invalid' }),
    })
    .optional(),
  timezone: z.string().min(1).max(64).optional(),
  baseCurrency: z.string().length(3).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
