import { z } from 'zod';

import { currencyCodeSchema, isoDateSchema } from '../currency/schemas';
import { SnapshotSource } from '../shared/enums';

const decimalAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((v) => /^-?\d+(\.\d{1,10})?$/.test(v), 'validation.amount.invalid');

const uuidSchema = z.string().uuid('validation.uuid.invalid');

export const snapshotEntrySchema = z.object({
  walletId: uuidSchema,
  amount: decimalAmountSchema,
});
export type SnapshotEntryInput = z.infer<typeof snapshotEntrySchema>;

export const createSnapshotBatchSchema = z.object({
  batchId: uuidSchema.optional(),
  snapshotDate: isoDateSchema,
  source: z
    .enum([SnapshotSource.MANUAL, SnapshotSource.IMPORT], {
      errorMap: () => ({ message: 'validation.snapshotSource.invalid' }),
    })
    .default(SnapshotSource.MANUAL),
  note: z.string().trim().max(500).optional(),
  entries: z
    .array(snapshotEntrySchema)
    .min(1, 'validation.snapshot.entriesRequired')
    .max(500, 'validation.snapshot.entriesTooMany'),
});
export type CreateSnapshotBatchInput = z.infer<typeof createSnapshotBatchSchema>;

export const listSnapshotBatchesQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListSnapshotBatchesQuery = z.infer<typeof listSnapshotBatchesQuerySchema>;

export const dashboardCurrentQuerySchema = z.object({
  displayCurrency: currencyCodeSchema.optional(),
});
export type DashboardCurrentQuery = z.infer<typeof dashboardCurrentQuerySchema>;

export const dashboardHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(365).default(30),
  displayCurrency: currencyCodeSchema.optional(),
});
export type DashboardHistoryQuery = z.infer<typeof dashboardHistoryQuerySchema>;
