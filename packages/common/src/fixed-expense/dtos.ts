import type { RecurrenceFreq } from '../shared/enums';

export interface FixedExpenseDto {
  id: string;
  groupId: string;
  name: string;
  amount: string;
  currencyCode: string;
  dayOfMonth: number;
  recurrence: RecurrenceFreq;
  note: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FixedExpenseCheckDto {
  id: string;
  fixedExpenseId: string;
  yearMonth: string;
  paidAt: string;
  paidAmount: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

export interface FixedExpenseChecklistItemDto {
  expense: FixedExpenseDto;
  check: FixedExpenseCheckDto | null;
}
