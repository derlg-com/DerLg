import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AccessTokenPayload,
  AuthSessionWithRefresh,
  PublicUser,
} from './interfaces/auth.interface';
import { PasswordService } from './password.service';
import { parseTtlSeconds } from './utils/ttl';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  locale: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionWithRefresh> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.AUTH_EMAIL_TAKEN,
        'An account with that email already exists.',
        HttpStatus.CONFLICT,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        passwordHash: await this.passwords.hash(dto.password),
      },
      select: PUBLIC_USER_SELECT,
    });

    this.logger.log('Registered new user', { userId: user.id });
    return this.issueSession(user, null);
  }

  async login(dto: LoginDto): Promise<AuthSessionWithRefresh> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...PUBLIC_USER_SELECT, passwordHash: true },
    });

    // Always run a verification so response timing does not reveal whether the
    // address exists. The dummy hash below is a valid argon2id digest.
    const passwordHash = user?.passwordHash ?? DUMMY_ARGON2_HASH;
    const passwordMatches = await this.passwords.verify(passwordHash, dto.password);

    if (!user || !passwordMatches) {
      throw new AppException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Email or password is incorrect.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    this.logger.log('User signed in', { userId: user.id });
    return this.issueSession(publicUser, null);
  }

  /**
   * Rotates a refresh token. The presented token is revoked and replaced within
   * the same family; presenting an already-revoked token is treated as theft and
   * kills every token in that family (OWASP refresh-token rotation).
   */
  async refresh(presentedToken: string): Promise<AuthSessionWithRefresh> {
    const tokenHash = this.passwords.hashRefreshToken(presentedToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: PUBLIC_USER_SELECT },
      },
    });

    if (!stored) {
      throw new AppException(
        ErrorCode.AUTH_REFRESH_INVALID,
        'Your session has expired. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn('Refresh token reuse detected; revoked the whole family', {
        userId: stored.user.id,
        familyId: stored.familyId,
      });
      throw new AppException(
        ErrorCode.AUTH_REFRESH_REUSED,
        'Your session was ended for security reasons. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new AppException(
        ErrorCode.AUTH_REFRESH_INVALID,
        'Your session has expired. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(stored.user, stored.familyId);
  }

  /** Revokes the presented token's whole family, signing the device out. */
  async logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) {
      return;
    }

    const tokenHash = this.passwords.hashRefreshToken(presentedToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true, userId: true },
    });

    if (!stored) {
      // Logging out with an unknown token is a no-op, not an error.
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log('User signed out', { userId: stored.userId });
  }

  getProfile(userId: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER_SELECT });
  }

  refreshCookieMaxAgeMs(): number {
    return this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  private async issueSession(
    user: PublicUser,
    familyId: string | null,
  ): Promise<AuthSessionWithRefresh> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    const accessTtl = this.config.getOrThrow<string>('JWT_ACCESS_TTL');
    // Expiry comes from JwtModule's signOptions (same env var), so the TTL is
    // configured in exactly one place.
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = this.passwords.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshCookieMaxAgeMs());

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.passwords.hashRefreshToken(refreshToken),
        // A fresh login opens a new family; a rotation stays inside the old one
        // so that reuse detection can revoke the entire chain at once.
        familyId: familyId ?? randomUUID(),
        expiresAt: refreshExpiresAt,
      },
      select: { id: true },
    });

    return {
      user,
      accessToken,
      expiresIn: parseTtlSeconds(accessTtl),
      refreshToken,
      refreshExpiresAt,
    };
  }
}

/** A real argon2id hash of a random string, used for constant-time login failure. */
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Io3fVyPMkYSTQ26vRJ0ZUvpMcCCFDnGb5oCkDVJ0Zmc';

export type UserRecord = User;
