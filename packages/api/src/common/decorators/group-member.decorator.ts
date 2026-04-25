import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { GroupMember } from '../../modules/group/group-member.entity';
import type { ScopedRequest } from '../guards/group-scope.guard';

export const GroupMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GroupMember => {
    const req = ctx.switchToHttp().getRequest<ScopedRequest>();
    if (!req.groupMember) {
      throw new Error('GroupMembership used without GroupScopeGuard in the route');
    }
    return req.groupMember;
  },
);
