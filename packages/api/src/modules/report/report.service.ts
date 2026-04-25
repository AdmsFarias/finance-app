import {
  FixedExpensesReportQuery,
  SnapshotsReportQuery,
} from '@finance/common';
import { Injectable } from '@nestjs/common';

import { buildCsv } from '../../common/csv/csv';
import { FixedExpenseService } from '../fixed-expense/fixed-expense.service';
import { SnapshotService } from '../snapshot/snapshot.service';

export interface CsvPayload {
  filename: string;
  body: string;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly snapshotService: SnapshotService,
    private readonly fixedExpenseService: FixedExpenseService,
  ) {}

  async snapshotsCsv(groupId: string, query: SnapshotsReportQuery): Promise<CsvPayload> {
    const batches = await this.snapshotService.list(groupId, {
      from: query.from,
      to: query.to,
      limit: 200,
      offset: 0,
    });
    const headers = [
      'snapshotDate',
      'source',
      'entryCount',
      'baseCurrency',
      'totalBase',
      'note',
      'createdAt',
      'batchId',
    ];
    const rows = batches.map((b) => [
      b.snapshotDate,
      b.source,
      b.entryCount,
      b.baseCurrency,
      b.totalBase,
      b.note ?? '',
      b.createdAt,
      b.id,
    ]);
    const suffix = query.from || query.to ? `_${query.from ?? ''}_${query.to ?? ''}` : '';
    return {
      filename: `snapshots${suffix}.csv`,
      body: buildCsv(headers, rows),
    };
  }

  async snapshotEntriesCsv(groupId: string, batchId: string): Promise<CsvPayload> {
    const batch = await this.snapshotService.getById(groupId, batchId);
    const headers = [
      'snapshotDate',
      'walletName',
      'walletType',
      'currencyCode',
      'amount',
      'fxRate',
      'fxRateDate',
      'fxSource',
      'baseCurrency',
      'amountBase',
    ];
    const rows = batch.entries.map((e) => [
      batch.snapshotDate,
      e.walletName,
      e.walletType,
      e.currencyCode,
      e.amount,
      e.fxRate,
      e.fxRateDate,
      e.fxSource,
      batch.baseCurrency,
      e.amountBase,
    ]);
    return {
      filename: `snapshot_${batch.snapshotDate}_${batchId.slice(0, 8)}.csv`,
      body: buildCsv(headers, rows),
    };
  }

  async fixedExpensesCsv(
    groupId: string,
    query: FixedExpensesReportQuery,
  ): Promise<CsvPayload> {
    const items = await this.fixedExpenseService.getChecklist(groupId, query.yearMonth);
    const headers = [
      'yearMonth',
      'name',
      'dayOfMonth',
      'amount',
      'currencyCode',
      'paid',
      'paidAt',
      'paidAmount',
      'note',
      'checkNote',
    ];
    const rows = items.map((i) => [
      query.yearMonth,
      i.expense.name,
      i.expense.dayOfMonth,
      i.expense.amount,
      i.expense.currencyCode,
      i.check ? 'true' : 'false',
      i.check?.paidAt ?? '',
      i.check?.paidAmount ?? '',
      i.expense.note ?? '',
      i.check?.note ?? '',
    ]);
    return {
      filename: `fixed_expenses_${query.yearMonth}.csv`,
      body: buildCsv(headers, rows),
    };
  }
}
