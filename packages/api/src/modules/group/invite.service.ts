import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { ErrorCode, GroupInviteDto, GroupMemberRole, InviteMemberInput } from '@finance/common';

import { AppUser } from '../user/user.entity';

import { GroupInvite } from './group-invite.entity';
import { GroupMember } from './group-member.entity';

interface CreatedInvite {
  invite: GroupInviteDto;
  rawToken: string;
}

function toDto(invite: GroupInvite): GroupInviteDto {
  return {
    id: invite.id,
    groupId: invite.groupId,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
  };
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class InviteService {
  private readonly inviteTtlSec: number;

  constructor(
    config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(GroupInvite) private readonly invites: Repository<GroupInvite>,
    @InjectRepository(GroupMember) private readonly members: Repository<GroupMember>,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
  ) {
    this.inviteTtlSec = Number(config.get<string>('INVITE_TTL_SEC') ?? 7 * 24 * 3600);
  }

  async listPending(groupId: string): Promise<GroupInviteDto[]> {
    const rows = await this.invites.find({
      where: { groupId, acceptedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toDto);
  }

  async create(
    groupId: string,
    invitedBy: string,
    input: InviteMemberInput,
    actorRole: GroupMemberRole,
  ): Promise<CreatedInvite> {
    if (actorRole === GroupMemberRole.ADMIN && input.role === GroupMemberRole.ADMIN) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'ADMINs cannot invite other ADMINs',
      });
    }

    const email = input.email.toLowerCase().trim();

    const existingUser = await this.users.findOne({ where: { email } });
    if (existingUser) {
      const existingMember = await this.members.findOne({
        where: { groupId, userId: existingUser.id },
      });
      if (existingMember) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'User is already a member of this group',
        });
      }
    }

    const pending = await this.invites.findOne({
      where: { groupId, email, acceptedAt: IsNull() },
    });
    if (pending && pending.expiresAt > new Date()) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'There is already a pending invite for this email',
      });
    }

    const raw = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + this.inviteTtlSec * 1000);

    const entity = this.invites.create({
      groupId,
      email,
      role: input.role,
      tokenHash,
      expiresAt,
      invitedBy,
    });
    const saved = await this.invites.save(entity);
    return { invite: toDto(saved), rawToken: raw };
  }

  async revoke(groupId: string, inviteId: string): Promise<void> {
    const invite = await this.invites.findOne({ where: { id: inviteId, groupId } });
    if (!invite) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Invite not found' });
    }
    if (invite.acceptedAt) {
      throw new ConflictException({
        code: 'INVITE_ALREADY_USED',
        message: 'Invite was already accepted',
      });
    }
    await this.invites.delete({ id: inviteId });
  }

  async accept(rawToken: string, userId: string): Promise<{ groupId: string }> {
    const invite = await this.invites.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (!invite) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invite token invalid',
      });
    }
    if (invite.acceptedAt) {
      throw new ConflictException({
        code: 'INVITE_ALREADY_USED',
        message: 'Invite was already accepted',
      });
    }
    if (invite.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'INVITE_EXPIRED',
        message: 'Invite has expired',
      });
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'User not found' });
    }
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException({
        code: 'EMAIL_MISMATCH',
        message: 'Invite email does not match signed-in user',
      });
    }

    const existing = await this.members.findOne({
      where: { groupId: invite.groupId, userId: user.id },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'User is already a member of this group',
      });
    }

    await this.dataSource.transaction(async (trx) => {
      const membership = trx.getRepository(GroupMember).create({
        groupId: invite.groupId,
        userId: user.id,
        role: invite.role,
      });
      await trx.getRepository(GroupMember).save(membership);
      await trx
        .getRepository(GroupInvite)
        .update({ id: invite.id }, { acceptedAt: new Date() });
    });

    return { groupId: invite.groupId };
  }
}
