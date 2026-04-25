import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ObjectLiteral, Repository } from 'typeorm';

import { ErrorCode } from '@finance/common';

import { AuthRefreshToken } from '../auth-refresh-token.entity';
import { TokenService } from './token.service';

type MockRepo<T extends ObjectLiteral> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

function makeConfig(): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_EXPIRES') return '15m';
      if (key === 'JWT_REFRESH_EXPIRES') return '7d';
      return undefined;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
      throw new Error(`missing ${key}`);
    }),
  } as unknown as ConfigService;
}

function makeRepo(): MockRepo<AuthRefreshToken> {
  return {
    findOne: jest.fn(),
    create: jest.fn((input: Partial<AuthRefreshToken>) => ({ ...input } as AuthRefreshToken)),
    save: jest.fn(async (entity: AuthRefreshToken) => entity),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 0 })),
  };
}

describe('TokenService', () => {
  let repo: MockRepo<AuthRefreshToken>;
  let jwt: JwtService;
  let service: TokenService;

  beforeEach(() => {
    repo = makeRepo();
    jwt = new JwtService({});
    service = new TokenService(
      makeConfig(),
      jwt,
      repo as unknown as Repository<AuthRefreshToken>,
    );
  });

  describe('issue', () => {
    it('creates a new refresh record (familyId UUID + sha256 tokenHash) and returns a valid access JWT', async () => {
      const user = { id: 'u-1', email: 'u@example.com' };
      const result = await service.issue(user, { ip: '1.1.1.1', userAgent: 'jest' });

      expect(result.familyId).toMatch(/^[0-9a-f-]{36}$/);
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(40);
      expect(result.accessExpiresIn).toBe(15 * 60);
      expect(result.refreshExpiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-1',
          familyId: result.familyId,
          ip: '1.1.1.1',
          userAgent: 'jest',
        }),
      );
      const created = repo.create!.mock.results[0].value as AuthRefreshToken;
      expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(created.tokenHash).not.toBe(result.refreshToken);

      const decoded = service.verifyAccess(result.accessToken);
      expect(decoded.sub).toBe('u-1');
      expect(decoded.email).toBe('u@example.com');
    });

    it('each issue generates a different familyId', async () => {
      const a = await service.issue({ id: 'u-1', email: 'a@b' });
      const b = await service.issue({ id: 'u-1', email: 'a@b' });
      expect(a.familyId).not.toBe(b.familyId);
      expect(a.refreshToken).not.toBe(b.refreshToken);
    });
  });

  describe('rotate', () => {
    it('happy path: revokes the current token, issues a new one from the same family', async () => {
      const user = { id: 'u-1', email: 'u@example.com' };
      const issued = await service.issue(user);
      const originalRecord = repo.create!.mock.results[0].value as AuthRefreshToken;
      const originalSaveCount = repo.save!.mock.calls.length;

      repo.findOne!.mockResolvedValueOnce({
        ...originalRecord,
        userId: user.id,
        familyId: issued.familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const rotated = await service.rotate(issued.refreshToken, user);

      expect(rotated.familyId).toBe(issued.familyId);
      expect(rotated.refreshToken).not.toBe(issued.refreshToken);

      const savedDuringRotate = repo.save!.mock.calls.slice(originalSaveCount);
      expect(savedDuringRotate.length).toBeGreaterThanOrEqual(2);
      expect(savedDuringRotate[0][0].revokedAt).toBeInstanceOf(Date);
    });

    it('unknown token → 401 TOKEN_INVALID', async () => {
      repo.findOne!.mockResolvedValue(null);

      await expect(
        service.rotate('totally-fake-token', { id: 'u-1', email: 'a@b' }),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_INVALID },
      });
    });

    it('userId mismatch → 401 TOKEN_INVALID', async () => {
      repo.findOne!.mockResolvedValue({
        userId: 'other-user',
        familyId: 'fam-x',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      } as AuthRefreshToken);

      await expect(
        service.rotate('any-raw', { id: 'u-1', email: 'a@b' }),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_INVALID },
      });
    });

    it('reuse of a revoked token → revokes the entire family and throws 401', async () => {
      const familyId = 'fam-reuse';
      repo.findOne!.mockResolvedValue({
        userId: 'u-1',
        familyId,
        revokedAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 60_000),
      } as AuthRefreshToken);

      await expect(
        service.rotate('reused-raw', { id: 'u-1', email: 'a@b' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ familyId }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('expired refresh → 401 TOKEN_EXPIRED', async () => {
      repo.findOne!.mockResolvedValue({
        userId: 'u-1',
        familyId: 'fam-exp',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      } as AuthRefreshToken);

      await expect(
        service.rotate('expired-raw', { id: 'u-1', email: 'a@b' }),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_EXPIRED },
      });
    });
  });

  describe('revokeByRawToken', () => {
    it('revokes the entire family when the token exists and is active', async () => {
      repo.findOne!.mockResolvedValue({
        userId: 'u-1',
        familyId: 'fam-1',
        revokedAt: null,
      } as AuthRefreshToken);

      await service.revokeByRawToken('any-raw');

      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'fam-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('no-op when the token does not exist', async () => {
      repo.findOne!.mockResolvedValue(null);
      await service.revokeByRawToken('ghost');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('no-op when the token is already revoked', async () => {
      repo.findOne!.mockResolvedValue({
        userId: 'u-1',
        familyId: 'fam-1',
        revokedAt: new Date(),
      } as AuthRefreshToken);
      await service.revokeByRawToken('already-revoked');
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyAccess', () => {
    it('throws when the JWT is signed with a different secret', async () => {
      const fake = new JwtService({}).sign(
        { sub: 'u-1', email: 'a@b' },
        { secret: 'wrong-secret', expiresIn: 60 },
      );
      expect(() => service.verifyAccess(fake)).toThrow();
    });
  });
});
