import { z } from 'zod';

import { isoDateSchema } from '../currency/schemas';
import { yearMonthSchema } from '../fixed-expense/schemas';

const optionalIsoDate = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  isoDateSchema.optional(),
);

export const snapshotsReportQuerySchema = z.object({
  from: optionalIsoDate,
  to: optionalIsoDate,
});
export type SnapshotsReportQuery = z.infer<typeof snapshotsReportQuerySchema>;

export const fixedExpensesReportQuerySchema = z.object({
  yearMonth: yearMonthSchema,
});
export type FixedExpensesReportQuery = z.infer<typeof fixedExpensesReportQuerySchema>;
