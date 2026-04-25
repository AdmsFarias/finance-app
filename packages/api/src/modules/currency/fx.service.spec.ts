import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

import { ErrorCode, FxRateSource } from '@finance/common';

import { CurrencyService } from './currency.service';
import { Currency } from './currency.entity';
import { FxRate } from './fx-rate.entity';
import { FxService } from './fx.service';

type MockRepo<T extends ObjectLiteral> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

function makeFxRate(partial: Partial<FxRate>): FxRate {
  return {
    id: partial.id ?? 'row-1',
    source: partial.source ?? FxRateSource.PROVIDER,
    from: partial.from ?? 'BRL',
    to: partial.to ?? 'USD',
    rateDate: partial.rateDate ?? '2026-04-17',
    rate: partial.rate ?? '0.2000000000',
    fetchedAt: partial.fetchedAt ?? new Date(),
  } as FxRate;
}

function makeCurrency(code: string, isActive = true): Currency {
  return { code, name: code, symbol: code, decimalPlaces: 2, isActive } as Currency;
}

describe('FxService', () => {
  let fxRates: MockRepo<FxRate>;
  let currencies: MockRepo<Currency>;
  let currencyService: CurrencyService;
  let service: FxService;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    fxRates = {
      findOne: jest.fn(),
      create: jest.fn((input) => ({ ...input } as FxRate)),
      save: jest.fn(async (entity) => entity as FxRate),
    };
    currencies = {
      findOne: jest.fn(),
    };
    currencyService = new CurrencyService(currencies as unknown as Repository<Currency>);
    service = new FxService(
      fxRates as unknown as Repository<FxRate>,
      currencyService,
    );
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('same currency', () => {
    it('returns rate=1 without consulting cache or persisting', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('BRL'));
      const result = await service.convert({ from: 'BRL', to: 'BRL', amount: 200 });

      expect(result.rate).toBe('1');
      expect(result.result).toBe('200');
      expect(result.cached).toBe(true);
      expect(fxRates.findOne).not.toHaveBeenCalled();
      expect(fxRates.save).not.toHaveBeenCalled();
    });
  });

  describe('direct cache', () => {
    it('serves cached without calling the provider', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('BRL'));
      fxRates.findOne!.mockResolvedValueOnce(
        makeFxRate({ from: 'BRL', to: 'USD', rate: '0.2000000000', rateDate: '2026-04-17' }),
      );
      global.fetch = jest.fn();

      const result = await service.convert({ from: 'BRL', to: 'USD', amount: 100 });

      expect(result.cached).toBe(true);
      expect(result.rate).toBe('0.2000000000');
      expect(result.result).toBe('20.000000');
      expect(result.rateDate).toBe('2026-04-17');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('omitted date fetches the most recent (ORDER BY rate_date DESC)', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('BRL'));
      fxRates.findOne!.mockResolvedValueOnce(
        makeFxRate({ rate: '0.20', rateDate: '2026-04-17' }),
      );

      await service.convert({ from: 'BRL', to: 'USD', amount: 1 });

      expect(fxRates.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { rateDate: 'DESC' },
        }),
      );
    });
  });

  describe('mathematical inverse', () => {
    it('derives rate = 1/inverseRate when only the reverse pair exists', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('USD'));
      // direct lookup (BRL→USD) misses
      fxRates.findOne!.mockResolvedValueOnce(null);
      // inverse lookup (USD→BRL) hits
      fxRates.findOne!.mockResolvedValueOnce(
        makeFxRate({ from: 'USD', to: 'BRL', rate: '5.0000000000', rateDate: '2026-04-17' }),
      );
      global.fetch = jest.fn();

      const result = await service.convert({ from: 'BRL', to: 'USD', amount: 100 });

      expect(result.cached).toBe(true);
      expect(Number(result.rate)).toBeCloseTo(0.2, 10);
      expect(result.result).toBe('20.000000');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('provider', () => {
    it('fetches, persists and returns cached=false when there is no cache', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('EUR'));
      fxRates.findOne!.mockResolvedValue(null); // direct + inverse miss
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'EUR',
          date: '2025-01-10',
          rates: { USD: 1.0304 },
        }),
      } as Response);

      const result = await service.convert({
        from: 'EUR',
        to: 'USD',
        amount: 10,
        date: '2025-01-10',
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(fxRates.save).toHaveBeenCalledTimes(1);
      expect(result.cached).toBe(false);
      expect(result.rate).toBe('1.0304000000');
      expect(result.rateDate).toBe('2025-01-10');
      expect(result.result).toBe('10.304000');
    });

    it('503 FX_PROVIDER_UNAVAILABLE when provider responds non-200 and there is no cache', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('JPY'));
      fxRates.findOne!.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({}),
      } as Response);

      await expect(
        service.convert({ from: 'JPY', to: 'GBP', amount: 1 }),
      ).rejects.toMatchObject({
        response: { code: 'FX_PROVIDER_UNAVAILABLE' },
      });
    });

    it('503 FX_PROVIDER_UNAVAILABLE when fetch throws (network/timeout) and there is no cache', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('JPY'));
      fxRates.findOne!.mockResolvedValue(null);
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.convert({ from: 'JPY', to: 'GBP', amount: 1 }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('with cache, provider being down does not affect the response', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('BRL'));
      fxRates.findOne!.mockResolvedValueOnce(
        makeFxRate({ from: 'BRL', to: 'USD', rate: '0.20', rateDate: '2026-04-17' }),
      );
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.convert({ from: 'BRL', to: 'USD', amount: 100 });

      expect(result.cached).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('unknown currency', () => {
    it('rejects with VALIDATION_FAILED when `to` does not exist', async () => {
      currencies.findOne!.mockImplementation(async ({ where }: { where: { code: string } }) => {
        return where.code === 'BRL' ? makeCurrency('BRL') : null;
      });

      await expect(
        service.convert({ from: 'BRL', to: 'XYZ', amount: 10 }),
      ).rejects.toMatchObject({
        response: {
          code: ErrorCode.VALIDATION_FAILED,
          fieldErrors: { to: 'validation.currency.unsupported' },
        },
      });
    });

    it('rejects with VALIDATION_FAILED when `from` is inactive', async () => {
      currencies.findOne!.mockImplementation(async ({ where }: { where: { code: string } }) => {
        if (where.code === 'BRL') return makeCurrency('BRL', false);
        return makeCurrency('USD');
      });

      await expect(
        service.convert({ from: 'BRL', to: 'USD', amount: 10 }),
      ).rejects.toMatchObject({
        response: {
          code: ErrorCode.VALIDATION_FAILED,
          fieldErrors: { from: 'validation.currency.unsupported' },
        },
      });
    });

    it('BadRequestException when Frankfurter does not support the pair', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('BRL'));
      fxRates.findOne!.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ amount: 1, base: 'BRL', date: '2026-04-17', rates: {} }),
      } as Response);

      await expect(
        service.convert({ from: 'BRL', to: 'ARS', amount: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('idempotent persistence', () => {
    it('when save fails due to race, refetch returns the existing row', async () => {
      currencies.findOne!.mockResolvedValue(makeCurrency('EUR'));
      fxRates.findOne!.mockResolvedValueOnce(null); // direct miss
      fxRates.findOne!.mockResolvedValueOnce(null); // inverse miss
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ amount: 1, base: 'EUR', date: '2025-01-10', rates: { USD: 1.03 } }),
      } as Response);
      fxRates.save!.mockRejectedValue(new Error('unique constraint'));
      fxRates.findOne!.mockResolvedValueOnce(
        makeFxRate({ from: 'EUR', to: 'USD', rate: '1.0300000000', rateDate: '2025-01-10' }),
      );

      const result = await service.convert({
        from: 'EUR',
        to: 'USD',
        amount: 5,
        date: '2025-01-10',
      });

      expect(result.cached).toBe(false);
      expect(result.rate).toBe('1.0300000000');
    });
  });
});
