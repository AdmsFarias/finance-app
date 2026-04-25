import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { ConvertQueryInput, ConvertResponseDto, convertQuerySchema } from '@finance/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { FxService } from './fx.service';

@ApiTags('fx')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Get('convert')
  async convert(
    @Query(new ZodValidationPipe(convertQuerySchema)) query: ConvertQueryInput,
  ): Promise<ConvertResponseDto> {
    return this.fxService.convert(query);
  }
}
