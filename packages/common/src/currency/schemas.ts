import { z } from 'zod';

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'validation.currency.invalid');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date.invalid')
  .refine((v) => {
    const [y, m, d] = v.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, 'validation.date.invalid');

export const convertQuerySchema = z.object({
  from: currencyCodeSchema,
  to: currencyCodeSchema,
  amount: z.coerce.number().positive('validation.amount.positive'),
  date: isoDateSchema.optional(),
});
export type ConvertQueryInput = z.infer<typeof convertQuerySchema>;
