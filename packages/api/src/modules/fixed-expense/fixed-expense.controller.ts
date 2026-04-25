import {
  CreateFixedExpenseInput,
  FixedExpenseCheckDto,
  FixedExpenseChecklistItemDto,
  FixedExpenseDto,
  GroupMemberRole,
  ListFixedExpenseChecklistQuery,
  ToggleFixedExpenseCheckInput,
  UpdateFixedExpenseInput,
  createFixedExpenseSchema,
  listFixedExpenseChecklistQuerySchema,
  toggleFixedExpenseCheckSchema,
  updateFixedExpenseSchema,
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
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AllowedRoles } from '../../common/decorators/allowed-roles.decorator';
import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { FixedExpenseService } from './fixed-expense.service';

import type { AuthenticatedRequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('fixed-expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupScopeGuard)
@Controller('groups/:groupId/fixed-expenses')
export class FixedExpenseController {
  constructor(private readonly service: FixedExpenseService) {}

  @Get()
  async list(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<FixedExpenseDto[]> {
    return this.service.list(groupId, includeArchived === 'true');
  }

  @Post()
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN, GroupMemberRole.MEMBER)
  async create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(createFixedExpenseSchema)) body: CreateFixedExpenseInput,
  ): Promise<FixedExpenseDto> {
    return this.service.create(groupId, body);
  }

  @Get('checklist')
  async checklist(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query(new ZodValidationPipe(listFixedExpenseChecklistQuerySchema))
    query: ListFixedExpenseChecklistQuery,
  ): Promise<FixedExpenseChecklistItemDto[]> {
    return this.service.getChecklist(groupId, query.yearMonth);
  }

  @Get(':expenseId')
  async getById(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ): Promise<FixedExpenseDto> {
    return this.service.getById(groupId, expenseId);
  }

  @Patch(':expenseId')
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN, GroupMemberRole.MEMBER)
  async update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body(new ZodValidationPipe(updateFixedExpenseSchema)) body: UpdateFixedExpenseInput,
  ): Promise<FixedExpenseDto> {
    return this.service.update(groupId, expenseId, body);
  }

  @Delete(':expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  async archive(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ): Promise<void> {
    await this.service.archive(groupId, expenseId);
  }

  @Post(':expenseId/restore')
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  async restore(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ): Promise<FixedExpenseDto> {
    return this.service.restore(groupId, expenseId);
  }

  @Post(':expenseId/checks')
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN, GroupMemberRole.MEMBER)
  async toggleCheck(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(toggleFixedExpenseCheckSchema))
    body: ToggleFixedExpenseCheckInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FixedExpenseCheckDto | undefined> {
    const result = await this.service.toggleCheck(groupId, expenseId, user.id, body);
    if (result.state === 'unchecked') {
      res.status(HttpStatus.NO_CONTENT);
      return undefined;
    }
    res.status(HttpStatus.CREATED);
    return result.check;
  }
}
