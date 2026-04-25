import { z } from 'zod';

import { currencyCodeSchema } from '../currency/schemas';
import { RecurrenceFreq } from '../shared/enums';

const decimalAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((v) => /^-?\d+(\.\d{1,10})?$/.test(v), 'validation.amount.invalid');

export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'validation.yearMonth.invalid');
export type YearMonth = z.infer<typeof yearMonthSchema>;

export const createFixedExpenseSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120),
  amount: decimalAmountSchema,
  currencyCode: currencyCodeSchema,
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  recurrence: z
    .enum([RecurrenceFreq.MONTHLY], {
      errorMap: () => ({ message: 'validation.recurrence.invalid' }),
    })
    .default(RecurrenceFreq.MONTHLY),
  note: z.string().trim().max(500).optional(),
});
export type CreateFixedExpenseInput = z.infer<typeof createFixedExpenseSchema>;

export const updateFixedExpenseSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  amount: decimalAmountSchema.optional(),
  currencyCode: currencyCodeSchema.optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  recurrence: z
    .enum([RecurrenceFreq.MONTHLY], {
      errorMap: () => ({ message: 'validation.recurrence.invalid' }),
    })
    .optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
export type UpdateFixedExpenseInput = z.infer<typeof updateFixedExpenseSchema>;

export const toggleFixedExpenseCheckSchema = z.object({
  yearMonth: yearMonthSchema,
  paidAmount: decimalAmountSchema.optional(),
  note: z.string().trim().max(500).optional(),
});
export type ToggleFixedExpenseCheckInput = z.infer<typeof toggleFixedExpenseCheckSchema>;

export const listFixedExpenseChecklistQuerySchema = z.object({
  yearMonth: yearMonthSchema,
});
export type ListFixedExpenseChecklistQuery = z.infer<
  typeof listFixedExpenseChecklistQuerySchema
>;
