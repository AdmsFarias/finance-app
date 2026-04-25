import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  AuthResponseDto,
  AuthUserDto,
  DEFAULT_LOCALE,
  ErrorCode,
  GroupMemberRole,
  GroupSummaryDto,
  MeResponseDto,
  SupportedLocale,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@finance/common';

import { FinanceGroup } from '../group/finance-group.entity';
import { GroupMember } from '../group/group-member.entity';
import { AppUser } from '../user/user.entity';

import { AuthPasswordReset } from './auth-password-reset.entity';
import { AuthRefreshToken } from './auth-refresh-token.entity';
import type { AuthenticatedRequestUser } from './strategies/jwt.strategy';
import { PasswordService } from './services/password.service';
import { IssuedTokens, RotationContext, TokenService } from './services/token.service';

export interface AuthSession {
  payload: AuthResponseDto;
  rawRefresh: string;
  refreshExpiresAt: Date;
}

function mapUser(user: AppUser): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale as SupportedLocale,
    timezone: user.timezone,
    baseCurrency: user.baseCurrency,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly resetTtlSec: number;

  constructor(
    config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
    @InjectRepository(GroupMember) private readonly members: Repository<GroupMember>,
    @InjectRepository(AuthPasswordReset)
    private readonly resets: Repository<AuthPasswordReset>,
    @InjectRepository(AuthRefreshToken)
    private readonly refreshRepo: Repository<AuthRefreshToken>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {
    this.resetTtlSec = Number(config.get<string>('RESET_TOKEN_TTL_SEC') ?? 3600);
  }

  async register(input: RegisterInput, ctx: RotationContext): Promise<AuthSession> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_USED,
        message: 'Email is already registered',
      });
    }

    const passwordHash = await this.passwords.hash(input.password);
    const locale = input.locale ?? DEFAULT_LOCALE;
    const baseCurrency = input.baseCurrency ?? 'BRL';
    const timezone = input.timezone ?? 'America/Sao_Paulo';

    const { user, group } = await this.dataSource.transaction(async (trx) => {
      const userEntity = trx.getRepository(AppUser).create({
        email,
        passwordHash,
        displayName: input.displayName.trim(),
        locale,
        baseCurrency,
        timezone,
      });
      const savedUser = await trx.getRepository(AppUser).save(userEntity);

      const groupEntity = trx.getRepository(FinanceGroup).create({
        name: 'Pessoal',
        baseCurrency,
        createdBy: savedUser.id,
      });
      const savedGroup = await trx.getRepository(FinanceGroup).save(groupEntity);

      const memberEntity = trx.getRepository(GroupMember).create({
        groupId: savedGroup.id,
        userId: savedUser.id,
        role: GroupMemberRole.OWNER,
      });
      await trx.getRepository(GroupMember).save(memberEntity);

      return { user: savedUser, group: savedGroup };
    });

    const issued = await this.tokens.issue({ id: user.id, email: user.email }, ctx);
    return this.toSession(user, [this.mapGroup(group, GroupMemberRole.OWNER)], issued);
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedRequestUser | null> {
    const user = await this.users.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.deletedAt) return null;
    const valid = await this.passwords.verify(user.passwordHash, password);
    if (!valid) return null;
    return { id: user.id, email: user.email };
  }

  async login(input: LoginInput, ctx: RotationContext): Promise<AuthSession> {
    const authed = await this.validateCredentials(input.email, input.password);
    if (!authed) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }
    const user = await this.users.findOneOrFail({ where: { id: authed.id } });
    const issued = await this.tokens.issue({ id: user.id, email: user.email }, ctx);
    const groups = await this.listGroupsForUser(user.id);
    return this.toSession(user, groups, issued);
  }

  async refreshByCookie(rawRefresh: string, ctx: RotationContext): Promise<AuthSession> {
    const record = await this.refreshRepo.findOne({ where: { tokenHash: hashToken(rawRefresh) } });
    if (!record) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token not recognized',
      });
    }
    const user = await this.users.findOne({ where: { id: record.userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'User not found or inactive',
      });
    }
    const issued = await this.tokens.rotate(
      rawRefresh,
      { id: user.id, email: user.email },
      ctx,
    );
    const groups = await this.listGroupsForUser(user.id);
    return this.toSession(user, groups, issued);
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (!rawRefresh) return;
    await this.tokens.revokeByRawToken(rawRefresh);
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'User not found' });
    }
    const groups = await this.listGroupsForUser(user.id);
    return { user: mapUser(user), groups };
  }

  async forgotPassword(email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email: normalized } });
    if (!user || user.deletedAt) {
      this.logger.log('forgotPassword: silenced to avoid email enumeration');
      return;
    }

    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.resetTtlSec * 1000);

    const reset = this.resets.create({
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt,
    });
    await this.resets.save(reset);

    this.logger.warn(
      `forgotPassword: reset token generated for user=${user.id}. TODO: send via email. token=${raw}`,
    );
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await this.resets.findOne({ where: { tokenHash: hashToken(input.token) } });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Reset token invalid or expired',
      });
    }

    const passwordHash = await this.passwords.hash(input.password);

    await this.dataSource.transaction(async (trx) => {
      await trx.getRepository(AppUser).update({ id: record.userId }, { passwordHash });
      await trx
        .getRepository(AuthPasswordReset)
        .update({ id: record.id }, { usedAt: new Date() });
    });

    await this.tokens.revokeAllFamiliesOfUser(record.userId);
  }

  private toSession(
    user: AppUser,
    groups: GroupSummaryDto[],
    issued: IssuedTokens,
  ): AuthSession {
    const payload: AuthResponseDto = {
      accessToken: issued.accessToken,
      expiresIn: issued.accessExpiresIn,
      user: mapUser(user),
      groups,
    };
    return {
      payload,
      rawRefresh: issued.refreshToken,
      refreshExpiresAt: issued.refreshExpiresAt,
    };
  }

  private async listGroupsForUser(userId: string): Promise<GroupSummaryDto[]> {
    const rows = await this.members.find({
      where: { userId },
      relations: { group: true },
    });
    return rows
      .filter((m) => !m.group.archivedAt)
      .map((m) => this.mapGroup(m.group, m.role));
  }

  private mapGroup(group: FinanceGroup, role: GroupMemberRole): GroupSummaryDto {
    return {
      id: group.id,
      name: group.name,
      baseCurrency: group.baseCurrency,
      role,
    };
  }
}
