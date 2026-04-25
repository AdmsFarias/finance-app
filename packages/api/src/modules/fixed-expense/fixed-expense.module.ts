import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { CurrencyModule } from '../currency/currency.module';

import { FixedExpenseCheck } from './fixed-expense-check.entity';
import { FixedExpenseController } from './fixed-expense.controller';
import { FixedExpense } from './fixed-expense.entity';
import { FixedExpenseService } from './fixed-expense.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FixedExpense, FixedExpenseCheck]),
    AuthModule,
    CommonModule,
    CurrencyModule,
  ],
  controllers: [FixedExpenseController],
  providers: [FixedExpenseService],
  exports: [FixedExpenseService],
})
export class FixedExpenseModule {}
