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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  AcceptInviteInput,
  GroupInviteDto,
  GroupMemberRole,
  InviteMemberInput,
  acceptInviteSchema,
  inviteMemberSchema,
} from '@finance/common';

import { AllowedRoles } from '../../common/decorators/allowed-roles.decorator';
import { GroupMembership } from '../../common/decorators/group-member.decorator';
import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/strategies/jwt.strategy';

import { GroupMember } from './group-member.entity';
import { InviteService } from './invite.service';

@ApiTags('invites')
@ApiBearerAuth()
@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @UseGuards(JwtAuthGuard, GroupScopeGuard)
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @Get('groups/:groupId/invites')
  async list(@Param('groupId', ParseUUIDPipe) groupId: string): Promise<GroupInviteDto[]> {
    return this.inviteService.listPending(groupId);
  }

  @UseGuards(JwtAuthGuard, GroupScopeGuard)
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @Post('groups/:groupId/invites')
  async create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
    @GroupMembership() actor: GroupMember,
  ): Promise<{ invite: GroupInviteDto; rawToken: string }> {
    return this.inviteService.create(groupId, actor.userId, body, actor.role);
  }

  @UseGuards(JwtAuthGuard, GroupScopeGuard)
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @Delete('groups/:groupId/invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<void> {
    await this.inviteService.revoke(groupId, inviteId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invites/accept')
  async accept(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteInput,
  ): Promise<{ groupId: string }> {
    return this.inviteService.accept(body.token, user.id);
  }
}
