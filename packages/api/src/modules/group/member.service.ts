import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ErrorCode, GroupMemberDto, GroupMemberRole } from '@finance/common';

import { AppUser } from '../user/user.entity';

import { GroupMember } from './group-member.entity';
import { GroupService } from './group.service';

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(GroupMember) private readonly members: Repository<GroupMember>,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
    private readonly groupService: GroupService,
  ) {}

  async list(groupId: string): Promise<GroupMemberDto[]> {
    const rows = await this.members.find({
      where: { groupId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    return rows.map((m) => ({
      userId: m.userId,
      groupId: m.groupId,
      role: m.role,
      displayName: m.user.displayName,
      email: m.user.email,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async changeRole(
    groupId: string,
    targetUserId: string,
    newRole: GroupMemberRole,
    actor: { id: string; role: GroupMemberRole },
  ): Promise<GroupMemberDto> {
    if (actor.role !== GroupMemberRole.OWNER && newRole === GroupMemberRole.OWNER) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'Only OWNERs can promote members to OWNER',
      });
    }

    const target = await this.members.findOne({
      where: { groupId, userId: targetUserId },
      relations: { user: true },
    });
    if (!target) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Member not found' });
    }

    if (target.role === newRole) return this.toDto(target);

    if (
      target.role === GroupMemberRole.OWNER &&
      newRole !== GroupMemberRole.OWNER
    ) {
      const ownerCount = await this.groupService.countOwners(groupId);
      if (ownerCount <= 1) {
        throw new ConflictException({
          code: 'LAST_OWNER',
          message: 'Cannot demote the last OWNER of the group',
        });
      }
    }

    if (
      actor.role === GroupMemberRole.ADMIN &&
      target.role === GroupMemberRole.OWNER
    ) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'ADMINs cannot change an OWNER role',
      });
    }

    target.role = newRole;
    const saved = await this.members.save(target);
    saved.user = target.user;
    return this.toDto(saved);
  }

  async remove(
    groupId: string,
    targetUserId: string,
    actor: { id: string; role: GroupMemberRole },
  ): Promise<void> {
    const target = await this.members.findOne({ where: { groupId, userId: targetUserId } });
    if (!target) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Member not found' });
    }

    const isSelfLeave = actor.id === targetUserId;

    if (!isSelfLeave && actor.role !== GroupMemberRole.OWNER && actor.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'Only OWNER or ADMIN can remove members',
      });
    }

    if (
      actor.role === GroupMemberRole.ADMIN &&
      target.role === GroupMemberRole.OWNER
    ) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'ADMINs cannot remove an OWNER',
      });
    }

    if (target.role === GroupMemberRole.OWNER) {
      const ownerCount = await this.groupService.countOwners(groupId);
      if (ownerCount <= 1) {
        throw new ConflictException({
          code: 'LAST_OWNER',
          message: 'Cannot remove the last OWNER of the group',
        });
      }
    }

    await this.members.delete({ groupId, userId: targetUserId });
  }

  private toDto(member: GroupMember): GroupMemberDto {
    return {
      userId: member.userId,
      groupId: member.groupId,
      role: member.role,
      displayName: member.user.displayName,
      email: member.user.email,
      joinedAt: member.joinedAt.toISOString(),
    };
  }
}
