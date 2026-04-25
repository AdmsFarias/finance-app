import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import {
  AuthResponseDto,
  ErrorCode,
  MeResponseDto,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@finance/common';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedRequestUser } from './strategies/jwt.strategy';

const REFRESH_COOKIE_NAME = 'fin_rt';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieDomain: string | undefined;
  private readonly isProd: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.cookieDomain = config.get<string>('COOKIE_DOMAIN') || undefined;
    this.isProd = config.get<string>('NODE_ENV') === 'production';
  }

  private setRefreshCookie(res: Response, rawToken: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'strict' : 'lax',
      domain: this.cookieDomain,
      path: '/api/v1/auth',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'strict' : 'lax',
      domain: this.cookieDomain,
      path: '/api/v1/auth',
    });
  }

  private extractCtx(req: Request): { ip: string | null; userAgent: string | null } {
    return {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.register(body, this.extractCtx(req));
    this.setRefreshCookie(res, session.rawRefresh, session.refreshExpiresAt);
    return session.payload;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.login(body, this.extractCtx(req));
    this.setRefreshCookie(res, session.rawRefresh, session.refreshExpiresAt);
    return session.payload;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
    if (!raw) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh cookie missing',
      });
    }
    const session = await this.authService.refreshByCookie(raw, this.extractCtx(req));
    this.setRefreshCookie(res, session.rawRefresh, session.refreshExpiresAt);
    return session.payload;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(raw);
    this.clearRefreshCookie(res);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedRequestUser): Promise<MeResponseDto> {
    return this.authService.me(user.id);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async forgot(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput): Promise<void> {
    await this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async reset(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput): Promise<void> {
    await this.authService.resetPassword(body);
  }
}
