import {
  DashboardCurrentDto,
  DashboardCurrentQuery,
  DashboardHistoryPointDto,
  DashboardHistoryQuery,
  dashboardCurrentQuerySchema,
  dashboardHistoryQuerySchema,
} from '@finance/common';
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { SnapshotService } from './snapshot.service';

@ApiTags('snapshots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupScopeGuard)
@Controller('groups/:groupId/snapshots/stats')
export class SnapshotStatsController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Get('current')
  async current(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query(new ZodValidationPipe(dashboardCurrentQuerySchema)) query: DashboardCurrentQuery,
  ): Promise<DashboardCurrentDto | null> {
    return this.snapshotService.getCurrentTotal(groupId, query);
  }

  @Get('history')
  async history(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query(new ZodValidationPipe(dashboardHistoryQuerySchema)) query: DashboardHistoryQuery,
  ): Promise<DashboardHistoryPointDto[]> {
    return this.snapshotService.getHistory(groupId, query);
  }
}
