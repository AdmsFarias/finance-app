import { z } from 'zod';

import { WalletType } from '../shared/enums';

const walletTypeEnum = z.enum(
  [
    WalletType.CHECKING,
    WalletType.SAVINGS,
    WalletType.CASH,
    WalletType.CREDIT_CARD,
    WalletType.INVESTMENT,
    WalletType.OTHER,
  ],
  { errorMap: () => ({ message: 'validation.walletType.invalid' }) },
);

const decimalAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((v) => /^-?\d+(\.\d{1,10})?$/.test(v), 'validation.amount.invalid');

export const createWalletSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120),
  type: walletTypeEnum,
  currencyCode: z.string().trim().toUpperCase().length(3, 'validation.currency.invalid'),
  initialBalance: decimalAmountSchema.default('0'),
});
export type CreateWalletInput = z.infer<typeof createWalletSchema>;

export const updateWalletSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: walletTypeEnum.optional(),
  currencyCode: z.string().trim().toUpperCase().length(3).optional(),
  initialBalance: decimalAmountSchema.optional(),
});
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
