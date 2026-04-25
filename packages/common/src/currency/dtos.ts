import type { FxRateSource } from '../shared/enums';

export interface CurrencyDto {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

export interface FxRateDto {
  source: FxRateSource;
  from: string;
  to: string;
  rateDate: string;
  rate: string;
  fetchedAt: string;
}

export interface ConvertResponseDto {
  from: string;
  to: string;
  amount: string;
  result: string;
  rate: string;
  rateDate: string;
  source: FxRateSource;
  cached: boolean;
}
