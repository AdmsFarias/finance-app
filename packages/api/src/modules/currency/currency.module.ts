import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';

import { Currency } from './currency.entity';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { FxController } from './fx.controller';
import { FxRate } from './fx-rate.entity';
import { FxService } from './fx.service';

@Module({
  imports: [TypeOrmModule.forFeature([Currency, FxRate]), AuthModule],
  controllers: [CurrencyController, FxController],
  providers: [CurrencyService, FxService],
  exports: [CurrencyService, FxService],
})
export class CurrencyModule {}
