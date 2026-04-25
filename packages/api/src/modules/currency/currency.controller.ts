import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { CurrencyDto } from '@finance/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CurrencyService } from './currency.service';

@ApiTags('currencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  async list(): Promise<CurrencyDto[]> {
    return this.currencyService.listActive();
  }
}
