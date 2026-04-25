import {
  CreateSnapshotBatchInput,
  GroupMemberRole,
  ListSnapshotBatchesQuery,
  SnapshotBatchDetailDto,
  SnapshotBatchSummaryDto,
  createSnapshotBatchSchema,
  listSnapshotBatchesQuerySchema,
} from '@finance/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AllowedRoles } from '../../common/decorators/allowed-roles.decorator';
import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { SnapshotService } from './snapshot.service';

import type { AuthenticatedRequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('snapshots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupScopeGuard)
@Controller('groups/:groupId/snapshots/batches')
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Get()
  async list(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query(new ZodValidationPipe(listSnapshotBatchesQuerySchema)) query: ListSnapshotBatchesQuery,
  ): Promise<SnapshotBatchSummaryDto[]> {
    return this.snapshotService.list(groupId, query);
  }

  @Post()
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN, GroupMemberRole.MEMBER)
  async create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(createSnapshotBatchSchema)) body: CreateSnapshotBatchInput,
  ): Promise<SnapshotBatchDetailDto> {
    return this.snapshotService.createBatch(groupId, user.id, body);
  }

  @Get(':batchId')
  async getById(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ): Promise<SnapshotBatchDetailDto> {
    return this.snapshotService.getById(groupId, batchId);
  }

  @Delete(':batchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  async delete(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ): Promise<void> {
    await this.snapshotService.delete(groupId, batchId);
  }
}
