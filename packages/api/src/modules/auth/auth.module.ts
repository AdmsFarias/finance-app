import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppUser } from '../user/user.entity';
import { FinanceGroup } from '../group/finance-group.entity';
import { GroupMember } from '../group/group-member.entity';

import { AuthPasswordReset } from './auth-password-reset.entity';
import { AuthRefreshToken } from './auth-refresh-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      AppUser,
      AuthRefreshToken,
      AuthPasswordReset,
      FinanceGroup,
      GroupMember,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy, LocalStrategy],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
