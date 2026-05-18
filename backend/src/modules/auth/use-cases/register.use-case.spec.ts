import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { RegisterUseCase } from './register.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { RegisterDto } from '../dto';
import type { AuthResponse } from '../interfaces';

jest.mock('../utils/hash-password.util', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let prisma: PrismaService;
  let generateTokens: GenerateTokensUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
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

    useCase = module.get(RegisterUseCase);
    prisma = module.get(PrismaService);
    generateTokens = module.get(GenerateTokensUseCase);
  });

  it('should throw ConflictException when email already exists', async () => {
    jest
      .spyOn(prisma.user, 'findUnique')
      .mockResolvedValue({ id: 'existing' } as never);

    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
    };
    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);

    try {
      await useCase.execute(dto);
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.AUTH_EMAIL_EXISTS);
    }
  });

  it('should create user and return tokens on success', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    const createdUser = {
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test',
      role: 'user',
    };
    jest.spyOn(prisma.user, 'create').mockResolvedValue(createdUser as never);

    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test',
    };
    const result = await useCase.execute(dto);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        fullName: 'Test',
        supabaseUid: expect.any(String),
      }),
    });
    expect(generateTokens.execute).toHaveBeenCalledWith(createdUser);
    expect(result.accessToken).toBe('access-token');
  });
});
