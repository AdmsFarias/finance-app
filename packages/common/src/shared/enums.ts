export const GroupMemberRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;
export type GroupMemberRole = (typeof GroupMemberRole)[keyof typeof GroupMemberRole];

export const WalletType = {
  CHECKING: 'CHECKING',
  SAVINGS: 'SAVINGS',
  CASH: 'CASH',
  CREDIT_CARD: 'CREDIT_CARD',
  INVESTMENT: 'INVESTMENT',
  OTHER: 'OTHER',
} as const;
export type WalletType = (typeof WalletType)[keyof typeof WalletType];

export const RecurrenceFreq = {
  MONTHLY: 'MONTHLY',
  WEEKLY: 'WEEKLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM',
} as const;
export type RecurrenceFreq = (typeof RecurrenceFreq)[keyof typeof RecurrenceFreq];

export const FxRateSource = {
  PROVIDER: 'PROVIDER',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
} as const;
export type FxRateSource = (typeof FxRateSource)[keyof typeof FxRateSource];

export const SnapshotSource = {
  MANUAL: 'MANUAL',
  IMPORT: 'IMPORT',
} as const;
export type SnapshotSource = (typeof SnapshotSource)[keyof typeof SnapshotSource];

export const SUPPORTED_LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';
