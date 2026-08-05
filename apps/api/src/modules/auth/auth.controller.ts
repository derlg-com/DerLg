import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';

import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthSession, AuthSessionWithRefresh } from './interfaces/auth.interface';

export const REFRESH_COOKIE_NAME = 'derlg_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Account created')
  // Registration is expensive (argon2) and abuse-prone, so it is tightly capped.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.authService.register(dto);
    return this.attachRefreshCookie(response, session);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed in')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.authService.login(dto);
    return this.attachRefreshCookie(response, session);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Session refreshed')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const presented = this.readRefreshCookie(request);
    if (!presented) {
      throw new UnauthorizedException('No session cookie was provided.');
    }

    try {
      const session = await this.authService.refresh(presented);
      return this.attachRefreshCookie(response, session);
    } catch (error) {
      // A dead token must not linger in the browser.
      this.clearRefreshCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed out')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.authService.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
    return null;
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE_NAME];
  }

  private attachRefreshCookie(response: Response, session: AuthSessionWithRefresh): AuthSession {
    const { refreshToken, refreshExpiresAt, ...publicSession } = session;

    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.cookieOptions(),
      expires: refreshExpiresAt,
    });

    // The refresh token never appears in a response body — cookie only.
    return publicSession;
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const domain = this.config.get<string>('COOKIE_DOMAIN');

    return {
      httpOnly: true,
      // Secure requires HTTPS, which localhost dev does not have.
      secure: isProduction,
      sameSite: 'strict',
      path: '/v1/auth',
      ...(domain ? { domain } : {}),
    };
  }
}
