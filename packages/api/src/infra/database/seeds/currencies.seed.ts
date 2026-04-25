import type { DataSource } from 'typeorm';

import { Currency } from '../../../modules/currency/currency.entity';

const CURRENCIES: Array<Omit<Currency, 'isActive'> & { isActive?: boolean }> = [
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2 },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimalPlaces: 2 },
];

export async function seedCurrencies(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Currency);
  for (const c of CURRENCIES) {
    const exists = await repo.findOne({ where: { code: c.code } });
    if (!exists) {
      await repo.save(repo.create({ ...c, isActive: true }));
    }
  }
  console.log(`seed: currencies — ${CURRENCIES.length} verificadas`);
}
