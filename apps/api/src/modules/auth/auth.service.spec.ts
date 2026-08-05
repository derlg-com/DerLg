import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

/**
 * Unit tests for the auth use-cases with Prisma mocked. The security-critical
 * behaviour asserted here is: no duplicate accounts, identical failure for
 * unknown-email and wrong-password, refresh rotation, and family revocation on
 * reuse.
 */
describe('AuthService', () => {
  const now = new Date('2026-08-01T00:00:00.000Z');

  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    refreshToken: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };
  let passwords: PasswordService;
  let jwt: { signAsync: jest.Mock };
  let config: { getOrThrow: jest.Mock; get: jest.Mock };
  let service: AuthService;

  const storedUser = {
    id: 'user-1',
    email: 'traveller@example.com',
    fullName: 'Sok Dara',
    role: 'TRAVELER' as const,
    locale: 'en',
    createdAt: now,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);

    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'token-row-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    passwords = new PasswordService();
    jest.spyOn(passwords, 'hash').mockResolvedValue('$argon2id$fake');
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.access.token') };
    config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'JWT_ACCESS_TTL' ? '15m' : key === 'REFRESH_TOKEN_TTL_DAYS' ? 30 : 'x',
      ),
      get: jest.fn(),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      passwords,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('creates the account, lowercases the email and returns a session', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(storedUser);

      const session = await service.register({
        email: '  Traveller@Example.COM ',
        password: 'Sup3rSecret',
        fullName: '  Sok Dara ',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'traveller@example.com',
            fullName: 'Sok Dara',
            passwordHash: '$argon2id$fake',
          }),
        }),
      );
      expect(session.accessToken).toBe('signed.access.token');
      expect(session.expiresIn).toBe(900);
      expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(session.refreshExpiresAt).toEqual(new Date('2026-08-31T00:00:00.000Z'));
      // The plaintext password must never survive into the session payload.
      expect(JSON.stringify(session)).not.toContain('Sup3rSecret');
    });

    it('never stores the password in plaintext', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(storedUser);

      await service.register({
        email: 'a@b.com',
        password: 'Sup3rSecret',
        fullName: 'A B',
      });

      const created = prisma.user.create.mock.calls[0][0] as {
        data: { passwordHash: string };
      };
      expect(created.data.passwordHash).not.toBe('Sup3rSecret');
    });

    it('rejects a duplicate email with AUTH_EMAIL_TAKEN', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'a@b.com', password: 'Sup3rSecret', fullName: 'A B' }),
      ).rejects.toMatchObject({
        code: ErrorCode.AUTH_EMAIL_TAKEN,
        status: HttpStatus.CONFLICT,
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a session when the password verifies', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...storedUser, passwordHash: '$argon2id$stored' });
      jest.spyOn(passwords, 'verify').mockResolvedValue(true);

      const session = await service.login({ email: 'traveller@example.com', password: 'ok' });

      expect(session.user).toEqual(storedUser);
      expect(session).not.toHaveProperty('user.passwordHash');
    });

    it('rejects a wrong password with AUTH_INVALID_CREDENTIALS', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...storedUser, passwordHash: '$argon2id$stored' });
      jest.spyOn(passwords, 'verify').mockResolvedValue(false);

      await expect(
        service.login({ email: 'traveller@example.com', password: 'nope' }),
      ).rejects.toMatchObject({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('gives an unknown email the same error and still runs a hash comparison', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const verify = jest.spyOn(passwords, 'verify').mockResolvedValue(false);

      const error = await service
        .login({ email: 'nobody@example.com', password: 'whatever' })
        .catch((caught: AppException) => caught);

      expect((error as AppException).code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      // Timing-attack mitigation: the dummy hash is still verified.
      expect(verify).toHaveBeenCalledTimes(1);
      expect(verify.mock.calls[0][0]).toMatch(/^\$argon2id\$/);
    });
  });

  describe('refresh', () => {
    const validStored = {
      id: 'token-1',
      familyId: 'family-1',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      revokedAt: null,
      user: storedUser,
    };

    it('revokes the presented token and issues a new one in the same family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validStored);

      const session = await service.refresh('presented-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revokedAt: now },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ familyId: 'family-1', userId: 'user-1' }),
        }),
      );
      expect(session.refreshToken).not.toBe('presented-token');
    });

    it('looks the token up by digest, never by plaintext', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validStored);

      await service.refresh('presented-token');

      const where = prisma.refreshToken.findUnique.mock.calls[0][0] as {
        where: { tokenHash: string };
      };
      expect(where.where.tokenHash).toBe(passwords.hashRefreshToken('presented-token'));
      expect(where.where.tokenHash).not.toBe('presented-token');
    });

    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('ghost')).rejects.toMatchObject({
        code: ErrorCode.AUTH_REFRESH_INVALID,
      });
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validStored,
        expiresAt: new Date('2026-07-01T00:00:00.000Z'),
      });

      await expect(service.refresh('stale')).rejects.toMatchObject({
        code: ErrorCode.AUTH_REFRESH_INVALID,
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('treats reuse of a revoked token as theft and revokes the whole family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validStored,
        revokedAt: new Date('2026-07-31T00:00:00.000Z'),
      });

      await expect(service.refresh('replayed')).rejects.toMatchObject({
        code: ErrorCode.AUTH_REFRESH_REUSED,
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: now },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes every live token in the family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        familyId: 'family-1',
        userId: 'user-1',
      });

      await service.logout('presented-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: now },
      });
    });

    it('is a no-op without a cookie or for an unknown token', async () => {
      await service.logout(undefined);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();

      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await service.logout('ghost');
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
