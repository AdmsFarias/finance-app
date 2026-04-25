import {
  FixedExpensesReportQuery,
  SnapshotsReportQuery,
  fixedExpensesReportQuerySchema,
  snapshotsReportQuerySchema,
} from '@finance/common';
import { Controller, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';


import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CsvPayload, ReportService } from './report.service';

import type { Response } from 'express';

function sendCsv(res: Response, payload: CsvPayload): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
  res.send(payload.body);
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupScopeGuard)
@Controller('groups/:groupId/reports')
export class ReportController {
  constructor(private readonly service: ReportService) {}

  @Get('snapshots.csv')
  async snapshotsCsv(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query(new ZodValidationPipe(snapshotsReportQuerySchema)) query: SnapshotsReportQuery,
    @Res() res: Response,
  ): Promise<void> {
    sendCsv(res, await this.service.snapshotsCsv(groupId, query));
  }

  @Get('snapshots/:batchId/entries.csv')
  async snapshotEntriesCsv(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Res() res: Response,
  ): Promise<void> {
    sendCsv(res, await this.service.snapshotEntriesCsv(groupId, batchId));
  }

  @Get('fixed-expenses.csv')
  async fixedExpensesCsv(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query(new ZodValidationPipe(fixedExpensesReportQuerySchema))
    query: FixedExpensesReportQuery,
    @Res() res: Response,
  ): Promise<void> {
    sendCsv(res, await this.service.fixedExpensesCsv(groupId, query));
  }
}
