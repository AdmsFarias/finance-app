import { createHash } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';

import { ErrorCode, GroupMemberRole } from '@finance/common';

import { AppUser } from '../user/user.entity';
import { GroupInvite } from './group-invite.entity';
import { GroupMember } from './group-member.entity';
import { InviteService } from './invite.service';

type MockRepo<T extends ObjectLiteral> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

const GROUP_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR_ID = '00000000-0000-0000-0000-0000000000aa';
const USER_ID = '00000000-0000-0000-0000-0000000000bb';

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function makeConfig(): ConfigService {
  return {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
}

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: USER_ID,
    email: 'guest@example.com',
    deletedAt: null,
    ...overrides,
  } as AppUser;
}

function makeInvite(overrides: Partial<GroupInvite> = {}): GroupInvite {
  return {
    id: 'inv-1',
    groupId: GROUP_ID,
    email: 'guest@example.com',
    role: GroupMemberRole.MEMBER,
    tokenHash: 'hash-x',
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    invitedBy: ACTOR_ID,
    createdAt: new Date(),
    ...overrides,
  } as GroupInvite;
}

describe('InviteService', () => {
  let invites: MockRepo<GroupInvite>;
  let members: MockRepo<GroupMember>;
  let users: MockRepo<AppUser>;
  let trxMemberSave: jest.Mock;
  let trxInviteUpdate: jest.Mock;
  let dataSource: DataSource;
  let service: InviteService;

  beforeEach(() => {
    invites = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((input: Partial<GroupInvite>) => ({ ...input } as GroupInvite)),
      save: jest.fn(async (entity: GroupInvite) => ({
        ...entity,
        id: entity.id ?? 'inv-new',
        createdAt: entity.createdAt ?? new Date(),
      })),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    members = {
      findOne: jest.fn(),
    };
    users = {
      findOne: jest.fn(),
    };
    trxMemberSave = jest.fn(async (m) => m);
    trxInviteUpdate = jest.fn(async () => ({ affected: 1 }));
    dataSource = {
      transaction: jest.fn(async (cb: (em: any) => Promise<unknown>) => {
        return cb({
          getRepository: (entity: unknown) => {
            if (entity === GroupMember) {
              return { create: jest.fn((m) => m), save: trxMemberSave };
            }
            if (entity === GroupInvite) {
              return { update: trxInviteUpdate };
            }
            throw new Error('unexpected entity');
          },
        });
      }),
    } as unknown as DataSource;

    service = new InviteService(
      makeConfig(),
      dataSource,
      invites as unknown as Repository<GroupInvite>,
      members as unknown as Repository<GroupMember>,
      users as unknown as Repository<AppUser>,
    );
  });

  describe('create', () => {
    it('happy path: generates base64url rawToken and stores sha256 hash (raw ≠ hash)', async () => {
      users.findOne!.mockResolvedValue(null);
      invites.findOne!.mockResolvedValue(null);

      const result = await service.create(
        GROUP_ID,
        ACTOR_ID,
        { email: 'New@Example.com', role: GroupMemberRole.MEMBER },
        GroupMemberRole.OWNER,
      );

      expect(result.rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.rawToken.length).toBeGreaterThan(20);
      const created = invites.create!.mock.results[0].value as GroupInvite;
      expect(created.tokenHash).toBe(sha256(result.rawToken));
      expect(created.tokenHash).not.toBe(result.rawToken);
      expect(created.email).toBe('new@example.com');
      expect(created.groupId).toBe(GROUP_ID);
      expect(created.invitedBy).toBe(ACTOR_ID);
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(result.invite.email).toBe('new@example.com');
    });

    it('ADMIN trying to invite ADMIN → ForbiddenException ROLE_NOT_ALLOWED', async () => {
      await expect(
        service.create(
          GROUP_ID,
          ACTOR_ID,
          { email: 'x@y.com', role: GroupMemberRole.ADMIN },
          GroupMemberRole.ADMIN,
        ),
      ).rejects.toMatchObject({
        response: { code: 'ROLE_NOT_ALLOWED' },
      });
      expect(invites.save).not.toHaveBeenCalled();
    });

    it('email is already a group member → ConflictException', async () => {
      users.findOne!.mockResolvedValue(makeUser({ id: 'u-existing' }));
      members.findOne!.mockResolvedValue({ groupId: GROUP_ID, userId: 'u-existing' } as GroupMember);

      await expect(
        service.create(
          GROUP_ID,
          ACTOR_ID,
          { email: 'guest@example.com', role: GroupMemberRole.MEMBER },
          GroupMemberRole.OWNER,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('valid pending invite → ConflictException', async () => {
      users.findOne!.mockResolvedValue(null);
      invites.findOne!.mockResolvedValue(
        makeInvite({ expiresAt: new Date(Date.now() + 60_000) }),
      );

      await expect(
        service.create(
          GROUP_ID,
          ACTOR_ID,
          { email: 'guest@example.com', role: GroupMemberRole.MEMBER },
          GroupMemberRole.OWNER,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.CONFLICT },
      });
      expect(invites.save).not.toHaveBeenCalled();
    });

    it('expired pending invite → allows creating a new one', async () => {
      users.findOne!.mockResolvedValue(null);
      invites.findOne!.mockResolvedValue(
        makeInvite({ expiresAt: new Date(Date.now() - 1000) }),
      );

      const result = await service.create(
        GROUP_ID,
        ACTOR_ID,
        { email: 'guest@example.com', role: GroupMemberRole.MEMBER },
        GroupMemberRole.OWNER,
      );

      expect(result.rawToken).toBeTruthy();
      expect(invites.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('revoke', () => {
    it('non-existent invite → NotFoundException', async () => {
      invites.findOne!.mockResolvedValue(null);
      await expect(service.revoke(GROUP_ID, 'inv-missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('already-accepted invite → ConflictException INVITE_ALREADY_USED', async () => {
      invites.findOne!.mockResolvedValue(makeInvite({ acceptedAt: new Date() }));
      await expect(service.revoke(GROUP_ID, 'inv-1')).rejects.toMatchObject({
        response: { code: 'INVITE_ALREADY_USED' },
      });
      expect(invites.delete).not.toHaveBeenCalled();
    });

    it('happy path: deletes a pending invite', async () => {
      invites.findOne!.mockResolvedValue(makeInvite());
      await service.revoke(GROUP_ID, 'inv-1');
      expect(invites.delete).toHaveBeenCalledWith({ id: 'inv-1' });
    });
  });

  describe('accept', () => {
    it('unknown token → BadRequestException TOKEN_INVALID', async () => {
      invites.findOne!.mockResolvedValue(null);
      await expect(service.accept('ghost-token', USER_ID)).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_INVALID },
      });
    });

    it('already-accepted invite → ConflictException INVITE_ALREADY_USED', async () => {
      invites.findOne!.mockResolvedValue(makeInvite({ acceptedAt: new Date() }));
      await expect(service.accept('raw', USER_ID)).rejects.toMatchObject({
        response: { code: 'INVITE_ALREADY_USED' },
      });
    });

    it('expired invite → BadRequestException INVITE_EXPIRED', async () => {
      invites.findOne!.mockResolvedValue(
        makeInvite({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.accept('raw', USER_ID)).rejects.toMatchObject({
        response: { code: 'INVITE_EXPIRED' },
      });
    });

    it('user does not exist → NotFoundException', async () => {
      invites.findOne!.mockResolvedValue(makeInvite());
      users.findOne!.mockResolvedValue(null);
      await expect(service.accept('raw', USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('soft-deleted user → NotFoundException', async () => {
      invites.findOne!.mockResolvedValue(makeInvite());
      users.findOne!.mockResolvedValue(makeUser({ deletedAt: new Date() }));
      await expect(service.accept('raw', USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('invite email ≠ logged-in user email → ForbiddenException EMAIL_MISMATCH', async () => {
      invites.findOne!.mockResolvedValue(makeInvite({ email: 'invited@example.com' }));
      users.findOne!.mockResolvedValue(makeUser({ email: 'other@example.com' }));
      await expect(service.accept('raw', USER_ID)).rejects.toMatchObject({
        response: { code: 'EMAIL_MISMATCH' },
      });
    });

    it('user is already a member → ConflictException', async () => {
      invites.findOne!.mockResolvedValue(makeInvite());
      users.findOne!.mockResolvedValue(makeUser());
      members.findOne!.mockResolvedValue({ groupId: GROUP_ID, userId: USER_ID } as GroupMember);
      await expect(service.accept('raw', USER_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('happy path: creates membership and marks invite as accepted (same transaction)', async () => {
      invites.findOne!.mockResolvedValue(
        makeInvite({ id: 'inv-42', role: GroupMemberRole.ADMIN }),
      );
      users.findOne!.mockResolvedValue(makeUser());
      members.findOne!.mockResolvedValue(null);

      const result = await service.accept('raw', USER_ID);

      expect(result).toEqual({ groupId: GROUP_ID });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(trxMemberSave).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: GROUP_ID,
          userId: USER_ID,
          role: GroupMemberRole.ADMIN,
        }),
      );
      expect(trxInviteUpdate).toHaveBeenCalledWith(
        { id: 'inv-42' },
        expect.objectContaining({ acceptedAt: expect.any(Date) }),
      );
    });
  });

});
