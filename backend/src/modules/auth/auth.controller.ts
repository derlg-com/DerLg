import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response, Request } from 'express';
import {
  RegisterUseCase,
  LoginUseCase,
  LogoutUseCase,
  LogoutAllDevicesUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
  RefreshTokenUseCase,
  GoogleAuthUseCase,
  GoogleCallbackUseCase,
  GetMeUseCase,
} from './use-cases';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/throttler/rate-limit';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleAuthDto,
  GoogleCallbackDto,
} from './dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const REFRESH_COOKIE = 'derlg_refresh';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllDevicesUseCase: LogoutAllDevicesUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly googleAuthUseCase: GoogleAuthUseCase,
    private readonly googleCallbackUseCase: GoogleCallbackUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Current user, including the admin grant when one exists.
   *
   * The admin panel calls this immediately after login to decide which
   * navigation to render, so it must resolve `admin_users` in the same request.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: JwtPayload) {
    return this.getMeUseCase.execute(user.sub);
  }

  @Public()
  @RateLimit('AUTH')
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.registerUseCase.execute(dto);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Rate-limited to 5 attempts per 5 minutes per IP. Without this, an attacker
   * can test passwords as fast as the network allows.
   */
  @Public()
  @RateLimit('AUTH')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.loginUseCase.execute(dto);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Deliberately looser than login: the SPA refreshes proactively on a timer and
   * replays its queued requests after a 401, so a legitimate client can hit this
   * several times in quick succession. Rotation is still bounded per IP.
   */
  @Public()
  @RateLimit('WRITE')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string | undefined>)?.[
      REFRESH_COOKIE
    ];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const result = await this.refreshTokenUseCase.execute(refreshToken);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as Record<string, string | undefined>)?.[
      REFRESH_COOKIE
    ];
    if (refreshToken) {
      await this.logoutUseCase.execute(refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.logoutAllDevicesUseCase.execute(user.sub);
    res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
    return { message: 'Logged out from all devices' };
  }

  /**
   * Account-recovery endpoints are throttled harder than login: each call sends
   * an email, so an unbounded endpoint is both a user-enumeration oracle and a
   * way to have our domain used to mail-bomb a third party.
   */
  @Public()
  @RateLimit('SENSITIVE')
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.forgotPasswordUseCase.execute(dto.email);
    return { message: 'Check your email for reset instructions' };
  }

  @Public()
  @RateLimit('SENSITIVE')
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute(dto);
    return { message: 'Password updated successfully' };
  }

  @Public()
  @RateLimit('AUTH')
  @Get('google')
  @HttpCode(HttpStatus.OK)
  googleAuthGet(
    @Query('redirect_uri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
    return this.googleAuthUseCase.execute(redirectUri, state);
  }

  @Public()
  @RateLimit('AUTH')
  @Post('google')
  @HttpCode(HttpStatus.OK)
  googleAuthPost(@Body() dto?: GoogleAuthDto) {
    return this.googleAuthUseCase.execute(dto?.redirectUri, dto?.state);
  }

  @Public()
  @RateLimit('AUTH')
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Query('redirect_uri') redirectUri: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    const result = await this.googleCallbackUseCase.execute(code, redirectUri);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    const acceptHeader = req.headers['accept'] ?? '';
    const isHtmlNavigation =
      typeof acceptHeader === 'string' && acceptHeader.includes('text/html');

    if (isHtmlNavigation) {
      const frontendUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'http://localhost:3000',
      );
      const configuredOrigins = (
        this.configService.get<string>('CORS_ORIGINS') ?? ''
      )
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);

      const allowedOrigins = new Set([
        frontendUrl.replace(/\/$/, ''),
        ...configuredOrigins,
      ]);

      let targetOrigin = frontendUrl.replace(/\/$/, '');
      let returnPath = '/';

      if (state) {
        try {
          const parsed = JSON.parse(
            Buffer.from(state, 'base64url').toString('utf8'),
          );
          if (
            parsed.origin &&
            typeof parsed.origin === 'string' &&
            allowedOrigins.has(parsed.origin.replace(/\/$/, ''))
          ) {
            targetOrigin = parsed.origin.replace(/\/$/, '');
          }
          if (
            parsed.next &&
            typeof parsed.next === 'string' &&
            parsed.next.startsWith('/') &&
            !parsed.next.startsWith('//') &&
            !parsed.next.includes('\\')
          ) {
            returnPath = parsed.next;
          }
        } catch {
          // Fallback to default
        }
      }

      return res.redirect(
        `${targetOrigin}/auth/callback?token=${result.accessToken}&next=${encodeURIComponent(returnPath)}`,
      );
    }

    return res.status(HttpStatus.OK).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @Public()
  @RateLimit('AUTH')
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  async googleCallbackPost(
    @Body() dto: GoogleCallbackDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.googleCallbackUseCase.execute(
      dto.code,
      dto.redirectUri,
    );
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}
