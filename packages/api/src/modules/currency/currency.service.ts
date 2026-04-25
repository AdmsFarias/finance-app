import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CurrencyDto } from '@finance/common';

import { Currency } from './currency.entity';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Currency)
    private readonly currencies: Repository<Currency>,
  ) {}

  async listActive(): Promise<CurrencyDto[]> {
    const rows = await this.currencies.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
    return rows.map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      decimalPlaces: c.decimalPlaces,
      isActive: c.isActive,
    }));
  }

  async getByCode(code: string): Promise<Currency | null> {
    return this.currencies.findOne({ where: { code: code.toUpperCase() } });
  }
}
