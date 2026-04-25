import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ErrorCode, GroupMemberRole } from '@finance/common';

import { GroupMember } from '../../modules/group/group-member.entity';
import type { AuthenticatedRequestUser } from '../../modules/auth/strategies/jwt.strategy';

import { ALLOWED_ROLES_KEY } from '../decorators/allowed-roles.decorator';

export interface ScopedRequest {
  user: AuthenticatedRequestUser;
  groupMember?: GroupMember;
  params: Record<string, string>;
  body?: { groupId?: string };
}

@Injectable()
export class GroupScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(GroupMember) private readonly members: Repository<GroupMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ScopedRequest>();
    const groupId = req.params?.groupId ?? req.body?.groupId;
    if (!groupId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'groupId not provided in request',
      });
    }

    const membership = await this.members.findOne({
      where: { groupId, userId: req.user.id },
    });
    if (!membership) {
      throw new ForbiddenException({ code: 'NOT_MEMBER', message: 'Not a member of this group' });
    }

    const allowed = this.reflector.getAllAndOverride<GroupMemberRole[] | undefined>(
      ALLOWED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed && allowed.length && !allowed.includes(membership.role)) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'Your role does not allow this action',
      });
    }

    req.groupMember = membership;
    return true;
  }
}
