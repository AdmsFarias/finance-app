import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { CurrencyModule } from '../currency/currency.module';
import { FinanceGroup } from '../group/finance-group.entity';
import { Wallet } from '../wallet/wallet.entity';

import { BalanceSnapshot } from './balance-snapshot.entity';
import { SnapshotBatch } from './snapshot-batch.entity';
import { SnapshotStatsController } from './snapshot-stats.controller';
import { SnapshotController } from './snapshot.controller';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SnapshotBatch, BalanceSnapshot, FinanceGroup, Wallet]),
    AuthModule,
    CommonModule,
    CurrencyModule,
  ],
  controllers: [SnapshotController, SnapshotStatsController],
  providers: [SnapshotService],
  exports: [SnapshotService],
})
export class SnapshotModule {}
