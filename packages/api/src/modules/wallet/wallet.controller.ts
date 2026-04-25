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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CreateWalletInput,
  GroupMemberRole,
  UpdateWalletInput,
  WalletDto,
  createWalletSchema,
  updateWalletSchema,
} from '@finance/common';

import { AllowedRoles } from '../../common/decorators/allowed-roles.decorator';
import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { WalletService } from './wallet.service';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupScopeGuard)
@Controller('groups/:groupId/wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async list(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<WalletDto[]> {
    return this.walletService.list(groupId, includeArchived === 'true');
  }

  @Post()
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN, GroupMemberRole.MEMBER)
  async create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(createWalletSchema)) body: CreateWalletInput,
  ): Promise<WalletDto> {
    return this.walletService.create(groupId, body);
  }

  @Get(':walletId')
  async getById(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('walletId', ParseUUIDPipe) walletId: string,
  ): Promise<WalletDto> {
    return this.walletService.getById(groupId, walletId);
  }

  @Patch(':walletId')
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN, GroupMemberRole.MEMBER)
  async update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Body(new ZodValidationPipe(updateWalletSchema)) body: UpdateWalletInput,
  ): Promise<WalletDto> {
    return this.walletService.update(groupId, walletId, body);
  }

  @Delete(':walletId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  async archive(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('walletId', ParseUUIDPipe) walletId: string,
  ): Promise<void> {
    await this.walletService.archive(groupId, walletId);
  }

  @Post(':walletId/restore')
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  async restore(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('walletId', ParseUUIDPipe) walletId: string,
  ): Promise<WalletDto> {
    return this.walletService.restore(groupId, walletId);
  }
}
