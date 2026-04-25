import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConvertResponseDto, ErrorCode, FxRateSource } from '@finance/common';

import { CurrencyService } from './currency.service';
import { FxRate } from './fx-rate.entity';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

const FRANKFURTER_BASE_URL = process.env.FRANKFURTER_BASE_URL ?? 'https://api.frankfurter.app';
const FRANKFURTER_TIMEOUT_MS = Number(process.env.FRANKFURTER_TIMEOUT_MS ?? 5000);

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    @InjectRepository(FxRate)
    private readonly fxRates: Repository<FxRate>,
    private readonly currencyService: CurrencyService,
  ) {}

  async convert(params: {
    from: string;
    to: string;
    amount: number;
    date?: string;
  }): Promise<ConvertResponseDto> {
    const from = params.from.toUpperCase();
    const to = params.to.toUpperCase();

    await this.assertCurrencyKnown(from, 'from');
    await this.assertCurrencyKnown(to, 'to');

    if (from === to) {
      return {
        from,
        to,
        amount: params.amount.toString(),
        result: params.amount.toString(),
        rate: '1',
        rateDate: params.date ?? todayIso(),
        source: FxRateSource.PROVIDER,
        cached: true,
      };
    }

    const cached = await this.findCached(from, to, params.date);
    if (cached) {
      return buildResponse(cached, params.amount, true);
    }

    const fetched = await this.fetchFromFrankfurter(from, to, params.date);
    const saved = await this.persistRate(from, to, fetched);
    return buildResponse(saved, params.amount, false);
  }

  private async assertCurrencyKnown(code: string, field: 'from' | 'to'): Promise<void> {
    const found = await this.currencyService.getByCode(code);
    if (!found || !found.isActive) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Currency ${code} is not supported`,
        fieldErrors: { [field]: 'validation.currency.unsupported' },
      });
    }
  }

  private async findCached(
    from: string,
    to: string,
    rateDate: string | undefined,
  ): Promise<FxRate | null> {
    const direct = rateDate
      ? await this.fxRates.findOne({
          where: { from, to, rateDate, source: FxRateSource.PROVIDER },
        })
      : await this.fxRates.findOne({
          where: { from, to, source: FxRateSource.PROVIDER },
          order: { rateDate: 'DESC' },
        });
    if (direct) return direct;

    const inverse = rateDate
      ? await this.fxRates.findOne({
          where: { from: to, to: from, rateDate, source: FxRateSource.PROVIDER },
        })
      : await this.fxRates.findOne({
          where: { from: to, to: from, source: FxRateSource.PROVIDER },
          order: { rateDate: 'DESC' },
        });
    if (inverse) {
      const rate = 1 / Number(inverse.rate);
      const clone = this.fxRates.create({
        source: FxRateSource.PROVIDER,
        from,
        to,
        rateDate: inverse.rateDate,
        rate: rate.toFixed(10),
      });
      return clone;
    }

    return null;
  }

  private async fetchFromFrankfurter(
    from: string,
    to: string,
    date?: string,
  ): Promise<FrankfurterResponse> {
    const path = date ?? 'latest';
    const url = `${FRANKFURTER_BASE_URL}/${path}?from=${from}&to=${to}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FRANKFURTER_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`Frankfurter ${res.status} for ${from}→${to} date=${path}`);
        throw new ServiceUnavailableException({
          code: 'FX_PROVIDER_UNAVAILABLE',
          message: 'Exchange rate provider returned an error',
        });
      }
      const body = (await res.json()) as FrankfurterResponse;
      if (!body.rates || typeof body.rates[to] !== 'number') {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Pair ${from}/${to} is not supported by the provider`,
        });
      }
      return body;
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) {
        throw err;
      }
      this.logger.error(`Frankfurter fetch failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: 'FX_PROVIDER_UNAVAILABLE',
        message: 'Exchange rate provider unreachable',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async persistRate(
    from: string,
    to: string,
    body: FrankfurterResponse,
  ): Promise<FxRate> {
    const rate = body.rates[to];
    const entity = this.fxRates.create({
      source: FxRateSource.PROVIDER,
      from,
      to,
      rateDate: body.date,
      rate: rate.toFixed(10),
    });
    try {
      return await this.fxRates.save(entity);
    } catch (err) {
      const existing = await this.fxRates.findOne({
        where: { from, to, rateDate: body.date, source: FxRateSource.PROVIDER },
      });
      if (existing) return existing;
      throw err;
    }
  }
}

function buildResponse(rate: FxRate, amount: number, cached: boolean): ConvertResponseDto {
  const rateNum = Number(rate.rate);
  const result = amount * rateNum;
  return {
    from: rate.from.trim(),
    to: rate.to.trim(),
    amount: amount.toString(),
    result: result.toFixed(6),
    rate: rate.rate,
    rateDate: typeof rate.rateDate === 'string' ? rate.rateDate : toIso(rate.rateDate),
    source: rate.source,
    cached,
  };
}

function todayIso(): string {
  return toIso(new Date());
}

function toIso(date: Date | string): string {
  if (typeof date === 'string') return date;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
