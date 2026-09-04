import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import { randomUUID } from 'crypto';
import type { AuthResponse } from '../interfaces';
import { AuthProvider, Prisma, type User } from '@prisma/client';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

@Injectable()
export class GoogleCallbackUseCase {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly generateTokens: GenerateTokensUseCase,
  ) {}

  async execute(
    code: string,
    redirectUriOverride?: string,
  ): Promise<AuthResponse> {
    const tokenResponse = await this.exchangeCodeForTokens(
      code,
      redirectUriOverride,
    );
    const userInfo = await this.fetchUserInfo(tokenResponse.access_token);

    const user = await this.findOrCreateOAuthUser(userInfo, tokenResponse);

    return this.generateTokens.execute(user);
  }

  private async exchangeCodeForTokens(
    code: string,
    redirectUriOverride?: string,
  ): Promise<GoogleTokenResponse> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      redirectUriOverride ??
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ??
      `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/auth/google/callback`;

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

  private async findOrCreateOAuthUser(
    userInfo: GoogleUserInfo,
    tokens: GoogleTokenResponse,
  ): Promise<User> {
    // 1. Look up existing OAuth identity for (google, sub)
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.google,
          providerAccountId: userInfo.sub,
        },
      },
      include: {
        user: true,
      },
    });

    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    if (existingOAuth) {
      // Refresh identity metadata and tokens
      await this.prisma.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          email: userInfo.email,
          displayName: userInfo.name ?? existingOAuth.displayName,
          avatarUrl: userInfo.picture ?? existingOAuth.avatarUrl,
          profileData: userInfo as unknown as Prisma.InputJsonValue,
          accessToken: tokens.access_token ?? existingOAuth.accessToken,
          refreshToken: tokens.refresh_token ?? existingOAuth.refreshToken,
          tokenExpiresAt: tokenExpiresAt ?? existingOAuth.tokenExpiresAt,
        },
      });

      // Fill in user details if not present
      if (!existingOAuth.user.avatarUrl && userInfo.picture) {
        return this.prisma.user.update({
          where: { id: existingOAuth.userId },
          data: { avatarUrl: userInfo.picture },
        });
      }

      return existingOAuth.user;
    }

    // 2. Not found by OAuth identity: check if an existing user matches the email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (existingUser) {
      // Link the Google OAuth account to the existing user
      await this.prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: AuthProvider.google,
          providerAccountId: userInfo.sub,
          email: userInfo.email,
          displayName: userInfo.name ?? null,
          avatarUrl: userInfo.picture ?? null,
          profileData: userInfo as unknown as Prisma.InputJsonValue,
          accessToken: tokens.access_token ?? null,
          refreshToken: tokens.refresh_token ?? null,
          tokenExpiresAt,
        },
      });

      if (!existingUser.avatarUrl && userInfo.picture) {
        return this.prisma.user.update({
          where: { id: existingUser.id },
          data: { avatarUrl: userInfo.picture },
        });
      }

      return existingUser;
    }

    // 3. Brand new user: create both User and OAuthAccount atomically
    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: userInfo.email,
          fullName: userInfo.name ?? null,
          avatarUrl: userInfo.picture ?? null,
          supabaseUid: randomUUID(),
          passwordHash: null,
        },
      });

      await tx.oAuthAccount.create({
        data: {
          userId: newUser.id,
          provider: AuthProvider.google,
          providerAccountId: userInfo.sub,
          email: userInfo.email,
          displayName: userInfo.name ?? null,
          avatarUrl: userInfo.picture ?? null,
          profileData: userInfo as unknown as Prisma.InputJsonValue,
          accessToken: tokens.access_token ?? null,
          refreshToken: tokens.refresh_token ?? null,
          tokenExpiresAt,
        },
      });

      return newUser;
    });
  }
}

