import type { GroupMemberRole } from '../shared/enums';

export interface GroupDto {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface GroupMemberDto {
  userId: string;
  groupId: string;
  role: GroupMemberRole;
  displayName: string;
  email: string;
  joinedAt: string;
}

export interface GroupInviteDto {
  id: string;
  groupId: string;
  email: string;
  role: GroupMemberRole;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}
