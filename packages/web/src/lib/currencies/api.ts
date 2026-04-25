import { cache } from 'react';

import { apiServerFetch } from '@/lib/api/server';

import type { CurrencyDto } from '@finance/common';

export const fetchCurrencies = cache(async (): Promise<CurrencyDto[]> => {
  return apiServerFetch<CurrencyDto[]>('/currencies');
});
