import {
  BalanceSnapshotDto,
  CreateSnapshotBatchInput,
  CurrencyBreakdownDto,
  DashboardCurrentDto,
  DashboardCurrentQuery,
  DashboardFallbackDto,
  DashboardHistoryPointDto,
  DashboardHistoryQuery,
  ErrorCode,
  FxRateSource,
  ListSnapshotBatchesQuery,
  SnapshotBatchDetailDto,
  SnapshotBatchSummaryDto,
  WalletType,
} from '@finance/common';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { FxService } from '../currency/fx.service';
import { FinanceGroup } from '../group/finance-group.entity';
import { Wallet } from '../wallet/wallet.entity';

import { BalanceSnapshot } from './balance-snapshot.entity';
import { SnapshotBatch } from './snapshot-batch.entity';

interface ResolvedEntry {
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

function toIsoDate(v: string | Date): string {
  if (typeof v === 'string') return v;
  const y = v.getUTCFullYear();
  const m = String(v.getUTCMonth() + 1).padStart(2, '0');
  const d = String(v.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapBalanceSnapshot(s: BalanceSnapshot): BalanceSnapshotDto {
  return {
    id: s.id,
    batchId: s.batchId,
    walletId: s.walletId,
    walletName: s.walletName,
    walletType: s.walletType,
    currencyCode: s.currencyCode.trim(),
    amount: s.amount,
    amountBase: s.amountBase,
    fxRate: s.fxRate,
    fxRateDate: toIsoDate(s.fxRateDate),
    fxSource: s.fxSource,
  };
}

function mapBatchSummary(b: SnapshotBatch): SnapshotBatchSummaryDto {
  return {
    id: b.id,
    groupId: b.groupId,
    snapshotDate: toIsoDate(b.snapshotDate),
    source: b.source,
    note: b.note,
    baseCurrency: b.baseCurrency.trim(),
    totalBase: b.totalBase,
    entryCount: b.entryCount,
    createdBy: b.createdBy,
    createdAt: b.createdAt.toISOString(),
  };
}

@Injectable()
export class SnapshotService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SnapshotBatch) private readonly batches: Repository<SnapshotBatch>,
    @InjectRepository(BalanceSnapshot) private readonly snapshots: Repository<BalanceSnapshot>,
    @InjectRepository(FinanceGroup) private readonly groups: Repository<FinanceGroup>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    private readonly fxService: FxService,
  ) {}

  async createBatch(
    groupId: string,
    userId: string,
    input: CreateSnapshotBatchInput,
  ): Promise<SnapshotBatchDetailDto> {
    if (input.batchId) {
      const existing = await this.batches.findOne({ where: { id: input.batchId } });
      if (existing) {
        if (existing.groupId !== groupId) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'Batch id already exists in another group',
          });
        }
        return this.getById(groupId, existing.id);
      }
    }

    const group = await this.groups.findOne({ where: { id: groupId, archivedAt: IsNull() } });
    if (!group) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Group not found or archived',
      });
    }

    const wallets = await this.wallets.find({ where: { groupId } });
    const walletsById = new Map(wallets.map((w) => [w.id, w]));

    const seenWallets = new Set<string>();
    const fieldErrors: Record<string, string> = {};
    for (let i = 0; i < input.entries.length; i++) {
      const entry = input.entries[i];
      if (seenWallets.has(entry.walletId)) {
        fieldErrors[`entries.${i}.walletId`] = 'validation.snapshot.duplicateWallet';
        continue;
      }
      seenWallets.add(entry.walletId);

      const w = walletsById.get(entry.walletId);
      if (!w) {
        fieldErrors[`entries.${i}.walletId`] = 'validation.snapshot.unknownWallet';
        continue;
      }
      if (w.archivedAt) {
        fieldErrors[`entries.${i}.walletId`] = 'validation.snapshot.walletArchived';
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Invalid snapshot entries',
        fieldErrors,
      });
    }

    const baseCurrency = group.baseCurrency.trim();
    const resolved: ResolvedEntry[] = [];
    let totalBase = 0;

    for (const entry of input.entries) {
      const w = walletsById.get(entry.walletId)!;
      const walletCurrency = w.currencyCode.trim();
      const amountNum = Number(entry.amount);

      let rate: string;
      let rateDate: string;
      let rateSource: FxRateSource;
      let amountBaseNum: number;

      if (walletCurrency === baseCurrency) {
        rate = '1.0000000000';
        rateDate = input.snapshotDate;
        rateSource = FxRateSource.PROVIDER;
        amountBaseNum = amountNum;
      } else {
        const conv = await this.fxService.convert({
          from: walletCurrency,
          to: baseCurrency,
          amount: amountNum,
          date: input.snapshotDate,
        });
        rate = conv.rate;
        rateDate = conv.rateDate;
        rateSource = conv.source;
        amountBaseNum = amountNum * Number(conv.rate);
      }

      const amountBase = amountBaseNum.toFixed(2);
      totalBase += Number(amountBase);

      resolved.push({
        walletId: w.id,
        walletName: w.name,
        walletType: w.type,
        currencyCode: walletCurrency,
        amount: entry.amount,
        amountBase,
        fxRate: rate,
        fxRateDate: rateDate,
        fxSource: rateSource,
      });
    }

    const note = input.note && input.note.length > 0 ? input.note : null;

    const saved = await this.dataSource.transaction(async (trx) => {
      const batchRepo = trx.getRepository(SnapshotBatch);
      const snapRepo = trx.getRepository(BalanceSnapshot);

      const batch = batchRepo.create({
        ...(input.batchId ? { id: input.batchId } : {}),
        groupId,
        snapshotDate: input.snapshotDate,
        source: input.source,
        note,
        baseCurrency,
        totalBase: totalBase.toFixed(2),
        entryCount: resolved.length,
        createdBy: userId,
      });
      const savedBatch = await batchRepo.save(batch);

      const rows = resolved.map((r) =>
        snapRepo.create({
          batchId: savedBatch.id,
          walletId: r.walletId,
          walletName: r.walletName,
          walletType: r.walletType,
          currencyCode: r.currencyCode,
          amount: r.amount,
          amountBase: r.amountBase,
          fxRate: r.fxRate,
          fxRateDate: r.fxRateDate,
          fxSource: r.fxSource,
        }),
      );
      const savedRows = await snapRepo.save(rows);
      return { batch: savedBatch, entries: savedRows };
    });

    return {
      ...mapBatchSummary(saved.batch),
      entries: saved.entries.map(mapBalanceSnapshot),
    };
  }

  async list(
    groupId: string,
    query: ListSnapshotBatchesQuery,
  ): Promise<SnapshotBatchSummaryDto[]> {
    const qb = this.batches
      .createQueryBuilder('b')
      .where('b.group_id = :groupId', { groupId });
    if (query.from) qb.andWhere('b.snapshot_date >= :from', { from: query.from });
    if (query.to) qb.andWhere('b.snapshot_date <= :to', { to: query.to });
    qb.orderBy('b.snapshot_date', 'DESC')
      .addOrderBy('b.created_at', 'DESC')
      .limit(query.limit)
      .offset(query.offset);
    const rows = await qb.getMany();
    return rows.map(mapBatchSummary);
  }

  async getById(groupId: string, batchId: string): Promise<SnapshotBatchDetailDto> {
    const batch = await this.batches.findOne({ where: { id: batchId, groupId } });
    if (!batch) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Snapshot batch not found',
      });
    }
    const entries = await this.snapshots.find({
      where: { batchId },
      order: { walletName: 'ASC' },
    });
    return {
      ...mapBatchSummary(batch),
      entries: entries.map(mapBalanceSnapshot),
    };
  }

  async delete(groupId: string, batchId: string): Promise<void> {
    const batch = await this.batches.findOne({ where: { id: batchId, groupId } });
    if (!batch) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Snapshot batch not found',
      });
    }
    await this.batches.remove(batch);
  }

  async getCurrentTotal(
    groupId: string,
    query: DashboardCurrentQuery = {},
  ): Promise<DashboardCurrentDto | null> {
    const batch = await this.batches
      .createQueryBuilder('b')
      .where('b.group_id = :groupId', { groupId })
      .orderBy('b.snapshot_date', 'DESC')
      .addOrderBy('b.created_at', 'DESC')
      .limit(1)
      .getOne();
    if (!batch) return null;

    const baseCurrency = batch.baseCurrency.trim();
    const snapshotDate = toIsoDate(batch.snapshotDate);

    const entries = await this.snapshots.find({ where: { batchId: batch.id } });
    const breakdown = aggregateBreakdown(entries);

    const requested = query.displayCurrency?.trim();
    const useDisplay = requested && requested !== baseCurrency;

    let displayCurrency = baseCurrency;
    let consolidatedAmount = batch.totalBase;
    let fallback: DashboardFallbackDto | undefined;

    if (useDisplay) {
      const conv = await this.tryConvert(baseCurrency, requested!, batch.totalBase, snapshotDate);
      if (conv.ok) {
        displayCurrency = requested!;
        consolidatedAmount = Number(conv.result).toFixed(2);
      } else {
        fallback = { requested: requested!, reason: conv.reason };
      }
    }

    return {
      batchId: batch.id,
      snapshotDate,
      totalBase: batch.totalBase,
      baseCurrency,
      entryCount: batch.entryCount,
      createdAt: batch.createdAt.toISOString(),
      displayCurrency,
      consolidatedAmount,
      breakdown,
      ...(fallback ? { fallback } : {}),
    };
  }

  async getHistory(
    groupId: string,
    query: DashboardHistoryQuery,
  ): Promise<DashboardHistoryPointDto[]> {
    const rows = await this.batches
      .createQueryBuilder('b')
      .distinctOn(['b.snapshot_date'])
      .where('b.group_id = :groupId', { groupId })
      .orderBy('b.snapshot_date', 'DESC')
      .addOrderBy('b.created_at', 'DESC')
      .limit(query.limit)
      .getMany();

    const requested = query.displayCurrency?.trim();
    const allBaseEqualsDisplay =
      !requested || rows.every((b) => b.baseCurrency.trim() === requested);

    if (allBaseEqualsDisplay) {
      return rows
        .map((b) => {
          const baseCurrency = b.baseCurrency.trim();
          return {
            snapshotDate: toIsoDate(b.snapshotDate),
            totalBase: b.totalBase,
            baseCurrency,
            displayCurrency: baseCurrency,
            displayAmount: b.totalBase,
          };
        })
        .reverse();
    }

    const converted = await Promise.all(
      rows.map(async (b) => {
        const baseCurrency = b.baseCurrency.trim();
        const snapshotDate = toIsoDate(b.snapshotDate);
        if (baseCurrency === requested) {
          return {
            snapshotDate,
            totalBase: b.totalBase,
            baseCurrency,
            displayCurrency: baseCurrency,
            displayAmount: b.totalBase,
          };
        }
        const conv = await this.tryConvert(baseCurrency, requested!, b.totalBase, snapshotDate);
        if (conv.ok) {
          return {
            snapshotDate,
            totalBase: b.totalBase,
            baseCurrency,
            displayCurrency: requested!,
            displayAmount: Number(conv.result).toFixed(2),
          };
        }
        return {
          snapshotDate,
          totalBase: b.totalBase,
          baseCurrency,
          displayCurrency: baseCurrency,
          displayAmount: b.totalBase,
          fallback: { requested: requested!, reason: conv.reason },
        };
      }),
    );

    return converted.reverse();
  }

  private async tryConvert(
    from: string,
    to: string,
    amount: string,
    date: string,
  ): Promise<
    | { ok: true; result: string }
    | { ok: false; reason: 'FX_PROVIDER_UNAVAILABLE' | 'CURRENCY_UNSUPPORTED' }
  > {
    try {
      const conv = await this.fxService.convert({
        from,
        to,
        amount: Number(amount),
        date,
      });
      return { ok: true, result: conv.result };
    } catch (err) {
      if (err instanceof HttpException) {
        const body = err.getResponse() as { code?: string };
        if (body?.code === 'FX_PROVIDER_UNAVAILABLE') {
          return { ok: false, reason: 'FX_PROVIDER_UNAVAILABLE' };
        }
      }
      return { ok: false, reason: 'CURRENCY_UNSUPPORTED' };
    }
  }
}

function aggregateBreakdown(entries: BalanceSnapshot[]): CurrencyBreakdownDto[] {
  const sums = new Map<string, number>();
  for (const e of entries) {
    const code = e.currencyCode.trim();
    sums.set(code, (sums.get(code) ?? 0) + Number(e.amount));
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, amount]) => ({ currencyCode, amount: amount.toFixed(2) }));
}
