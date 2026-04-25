import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AuthUserDto,
  ChangePasswordInput,
  ErrorCode,
  SupportedLocale,
  UpdateProfileInput,
} from '@finance/common';

import { PasswordService } from '../auth/services/password.service';
import { TokenService } from '../auth/services/token.service';

import { AppUser } from './user.entity';

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

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'User not found' });
    }
    return mapUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUserDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'User not found' });
    }
    if (input.displayName !== undefined) user.displayName = input.displayName.trim();
    if (input.locale !== undefined) user.locale = input.locale;
    if (input.timezone !== undefined) user.timezone = input.timezone;
    if (input.baseCurrency !== undefined) user.baseCurrency = input.baseCurrency;
    const saved = await this.users.save(user);
    return mapUser(saved);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'User not found' });
    }
    const ok = await this.passwords.verify(user.passwordHash, input.currentPassword);
    if (!ok) {
      throw new BadRequestException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Current password is incorrect',
      });
    }
    const sameAsCurrent = await this.passwords.verify(user.passwordHash, input.newPassword);
    if (sameAsCurrent) {
      throw new ConflictException({
        code: 'PASSWORD_SAME_AS_CURRENT',
        message: 'New password must differ from current',
      });
    }
    user.passwordHash = await this.passwords.hash(input.newPassword);
    await this.users.save(user);

    // Revoke all active sessions for safety (force re-login)
    await this.tokens.revokeAllFamiliesOfUser(userId);
  }
}
