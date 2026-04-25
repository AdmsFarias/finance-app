import { SetMetadata } from '@nestjs/common';

import type { GroupMemberRole } from '@finance/common';

export const ALLOWED_ROLES_KEY = 'allowedRoles';

export const AllowedRoles = (...roles: GroupMemberRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOWED_ROLES_KEY, roles);
