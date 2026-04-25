import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CreateGroupInput,
  GroupDto,
  GroupMemberRole,
  GroupSummaryDto,
  UpdateGroupInput,
  createGroupSchema,
  updateGroupSchema,
} from '@finance/common';

import { AllowedRoles } from '../../common/decorators/allowed-roles.decorator';
import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/strategies/jwt.strategy';

import { GroupService } from './group.service';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser): Promise<GroupSummaryDto[]> {
    return this.groupService.listForUser(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput,
  ): Promise<GroupDto> {
    return this.groupService.create(user.id, body);
  }

  @Get(':groupId')
  @UseGuards(GroupScopeGuard)
  async getById(@Param('groupId', ParseUUIDPipe) groupId: string): Promise<GroupDto> {
    return this.groupService.getById(groupId);
  }

  @Patch(':groupId')
  @UseGuards(GroupScopeGuard)
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  async update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(updateGroupSchema)) body: UpdateGroupInput,
  ): Promise<GroupDto> {
    return this.groupService.update(groupId, body);
  }

  @Post(':groupId/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GroupScopeGuard)
  @AllowedRoles(GroupMemberRole.OWNER)
  async archive(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.groupService.archive(groupId, user.id);
  }
}
