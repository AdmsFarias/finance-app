import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';

import { ErrorCode } from '@finance/common';

import { AuthRefreshToken } from '../auth-refresh-token.entity';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface IssuedTokens {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  familyId: string;
}

export interface RotationContext {
  ip?: string | null;
  userAgent?: string | null;
}

function parseDurationToSeconds(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) return Number(input);
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return value;
  }
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  private readonly accessSecret: string;
  private readonly accessExpiresSec: number;
  private readonly refreshSecret: string;
  private readonly refreshExpiresSec: number;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(AuthRefreshToken)
    private readonly refreshRepo: Repository<AuthRefreshToken>,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessExpiresSec = parseDurationToSeconds(
      config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
    );
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshExpiresSec = parseDurationToSeconds(
      config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
    );
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private signAccess(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresSec,
    });
  }

  async issue(user: { id: string; email: string }, ctx: RotationContext = {}): Promise<IssuedTokens> {
    const familyId = randomUUID();
    return this.createRefreshRecord(user, familyId, ctx);
  }

  async rotate(
    rawRefreshToken: string,
    user: { id: string; email: string },
    ctx: RotationContext = {},
  ): Promise<IssuedTokens> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.refreshRepo.findOne({ where: { tokenHash } });

    if (!record) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token not recognized',
      });
    }

    if (record.userId !== user.id) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token user mismatch',
      });
    }

    const now = new Date();

    if (record.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user=${record.userId} family=${record.familyId}`,
      );
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token reuse detected',
      });
    }

    if (record.expiresAt <= now) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Refresh token expired',
      });
    }

    record.revokedAt = now;
    await this.refreshRepo.save(record);

    return this.createRefreshRecord(user, record.familyId, ctx);
  }

  async revokeByRawToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.refreshRepo.findOne({ where: { tokenHash } });
    if (!record || record.revokedAt) return;
    await this.revokeFamily(record.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.refreshRepo.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllFamiliesOfUser(userId: string): Promise<void> {
    await this.refreshRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async purgeExpired(): Promise<void> {
    await this.refreshRepo.delete({ expiresAt: LessThan(new Date()) });
  }

  private async createRefreshRecord(
    user: { id: string; email: string },
    familyId: string,
    ctx: RotationContext,
  ): Promise<IssuedTokens> {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + this.refreshExpiresSec * 1000);

    const record = this.refreshRepo.create({
      userId: user.id,
      familyId,
      tokenHash,
      expiresAt,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    await this.refreshRepo.save(record);

    return {
      accessToken: this.signAccess({ sub: user.id, email: user.email }),
      accessExpiresIn: this.accessExpiresSec,
      refreshToken: raw,
      refreshExpiresAt: expiresAt,
      familyId,
    };
  }

  verifyAccess(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, { secret: this.accessSecret });
  }
}
