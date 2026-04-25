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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  ChangeMemberRoleInput,
  GroupMemberDto,
  GroupMemberRole,
  changeMemberRoleSchema,
} from '@finance/common';

import { AllowedRoles } from '../../common/decorators/allowed-roles.decorator';
import { GroupMembership } from '../../common/decorators/group-member.decorator';
import { GroupScopeGuard } from '../../common/guards/group-scope.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { GroupMember } from './group-member.entity';
import { MemberService } from './member.service';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupScopeGuard)
@Controller('groups/:groupId/members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get()
  async list(@Param('groupId', ParseUUIDPipe) groupId: string): Promise<GroupMemberDto[]> {
    return this.memberService.list(groupId);
  }

  @Patch(':userId')
  @AllowedRoles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  async changeRole(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(changeMemberRoleSchema)) body: ChangeMemberRoleInput,
    @GroupMembership() actor: GroupMember,
  ): Promise<GroupMemberDto> {
    return this.memberService.changeRole(groupId, userId, body.role, {
      id: actor.userId,
      role: actor.role,
    });
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @GroupMembership() actor: GroupMember,
  ): Promise<void> {
    await this.memberService.remove(groupId, userId, { id: actor.userId, role: actor.role });
  }
}
