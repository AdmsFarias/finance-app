import type { FxRateSource, SnapshotSource, WalletType } from '../shared/enums';

export interface BalanceSnapshotDto {
  id: string;
  batchId: string;
  walletId: string;
  walletName: string;
  walletType: WalletType;
  currencyCode: string;
  amount: string;
  amountBase: string;
  fxRate: string;
  fxRateDate: string;
  fxSource: FxRateSource;
}

export interface SnapshotBatchSummaryDto {
  id: string;
  groupId: string;
  snapshotDate: string;
  source: SnapshotSource;
  note: string | null;
  baseCurrency: string;
  totalBase: string;
  entryCount: number;
  createdBy: string;
  createdAt: string;
}

export interface SnapshotBatchDetailDto extends SnapshotBatchSummaryDto {
  entries: BalanceSnapshotDto[];
}

export interface CurrencyBreakdownDto {
  currencyCode: string;
  amount: string;
}

export type DashboardFallbackReason = 'FX_PROVIDER_UNAVAILABLE' | 'CURRENCY_UNSUPPORTED';

export interface DashboardFallbackDto {
  requested: string;
  reason: DashboardFallbackReason;
}

export interface DashboardCurrentDto {
  batchId: string;
  snapshotDate: string;
  totalBase: string;
  baseCurrency: string;
  entryCount: number;
  createdAt: string;
  displayCurrency: string;
  consolidatedAmount: string;
  breakdown: CurrencyBreakdownDto[];
  fallback?: DashboardFallbackDto;
}

export interface DashboardHistoryPointDto {
  snapshotDate: string;
  totalBase: string;
  baseCurrency: string;
  displayCurrency: string;
  displayAmount: string;
  fallback?: DashboardFallbackDto;
}
