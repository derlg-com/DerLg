import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import { randomUUID } from 'crypto';
import type { AuthResponse } from '../interfaces';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleCallbackUseCase {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly generateTokens: GenerateTokensUseCase,
  ) {}

  async execute(code: string): Promise<AuthResponse> {
    const tokenResponse = await this.exchangeCodeForTokens(code);
    const userInfo = await this.fetchUserInfo(tokenResponse.access_token);

    const user = await this.findOrCreateUser(userInfo);

    return this.generateTokens.execute(user);
  }

  private async exchangeCodeForTokens(
    code: string,
  ): Promise<GoogleTokenResponse> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/auth/google/callback`;

    const params = new URLSearchParams({
      code,
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new BadRequestException({
        code: ErrorCode.AUTH_OAUTH_FAILED,
        message: 'Failed to exchange Google authorization code',
      });
    }

    return res.json() as Promise<GoogleTokenResponse>;
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
    );

    if (!res.ok) {
      throw new BadRequestException({
        code: ErrorCode.AUTH_OAUTH_FAILED,
        message: 'Failed to fetch Google user info',
      });
    }

    return res.json() as Promise<GoogleUserInfo>;
  }

  private async findOrCreateUser(userInfo: GoogleUserInfo) {
    const existing = await this.prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        email: userInfo.email,
        fullName: userInfo.name ?? null,
        avatarUrl: userInfo.picture ?? null,
        supabaseUid: randomUUID(),
        passwordHash: null,
      },
    });
  }
}
