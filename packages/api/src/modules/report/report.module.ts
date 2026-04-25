import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { FixedExpenseModule } from '../fixed-expense/fixed-expense.module';
import { SnapshotModule } from '../snapshot/snapshot.module';

import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [AuthModule, CommonModule, SnapshotModule, FixedExpenseModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
