import { z } from 'zod';

import { GroupMemberRole } from '../shared/enums';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120),
  baseCurrency: z.string().length(3),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  baseCurrency: z.string().length(3).optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('validation.email.invalid'),
  role: z
    .enum([GroupMemberRole.ADMIN, GroupMemberRole.MEMBER, GroupMemberRole.VIEWER], {
      errorMap: () => ({ message: 'validation.memberRole.invalid' }),
    })
    .default(GroupMemberRole.MEMBER),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const changeMemberRoleSchema = z.object({
  role: z.enum(
    [
      GroupMemberRole.OWNER,
      GroupMemberRole.ADMIN,
      GroupMemberRole.MEMBER,
      GroupMemberRole.VIEWER,
    ],
    { errorMap: () => ({ message: 'validation.memberRole.invalid' }) },
  ),
});
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(512),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
