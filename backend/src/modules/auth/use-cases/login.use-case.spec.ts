import { Test } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { LoginUseCase } from './login.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { LoginDto } from '../dto';
import type { AuthResponse } from '../interfaces';

jest.mock('../utils/compare-password.util', () => ({
  comparePassword: jest.fn(),
}));

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let prisma: PrismaService;
  let generateTokens: GenerateTokensUseCase;

  beforeEach(async () => {
    const { comparePassword } = jest.requireMock(
      '../utils/compare-password.util',
    );
    comparePassword.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: GenerateTokensUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              user: {
                id: 'user-1',
                email: 'test@example.com',
                name: 'Test',
                role: 'user',
              },
            }),
          },
        },
      ],
    }).compile();

    useCase = module.get(LoginUseCase);
    prisma = module.get(PrismaService);
    generateTokens = module.get(GenerateTokensUseCase);
  });

  it('should throw UnauthorizedException when email not found', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };
    await expect(useCase.execute(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when password does not match', async () => {
    const { comparePassword } = jest.requireMock(
      '../utils/compare-password.util',
    );
    comparePassword.mockResolvedValue(false);

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      status: 'active',
    } as never);

    const dto: LoginDto = { email: 'test@example.com', password: 'wrongpass' };
    await expect(useCase.execute(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException when account is suspended', async () => {
    const { comparePassword } = jest.requireMock(
      '../utils/compare-password.util',
    );
    comparePassword.mockResolvedValue(true);

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      status: 'suspended',
    } as never);

    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };
    await expect(useCase.execute(dto)).rejects.toThrow(ForbiddenException);

    try {
      await useCase.execute(dto);
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.AUTH_ACCOUNT_SUSPENDED);
    }
  });

  it('should return tokens on successful login', async () => {
    const { comparePassword } = jest.requireMock(
      '../utils/compare-password.util',
    );
    comparePassword.mockResolvedValue(true);

    const user = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      status: 'active',
      role: 'user',
    };
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(user as never);

    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };
    const result = await useCase.execute(dto);

    expect(generateTokens.execute).toHaveBeenCalledWith(user);
    expect(result.accessToken).toBe('access-token');
  });

  it('should throw UnauthorizedException for OAuth-only user (no passwordHash)', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: null,
      status: 'active',
    } as never);

    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };
    await expect(useCase.execute(dto)).rejects.toThrow(UnauthorizedException);
  });
});
