import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ResetPasswordUseCase } from './reset-password.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';

jest.mock('../utils/hash-password.util', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ResetPasswordUseCase,
        {
          provide: PrismaService,
          useValue: {
            user: {
              update: jest.fn().mockResolvedValue({ id: 'user-1' }),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get(ResetPasswordUseCase);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  it('should update password and delete token when valid', async () => {
    jest.spyOn(redis, 'get').mockResolvedValue('user-1');

    await useCase.execute({ token: 'valid-token', newPassword: 'newpass123' });

    expect(redis.get).toHaveBeenCalledWith('password_reset:valid-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'hashed-password' },
    });
    expect(redis.del).toHaveBeenCalledWith('password_reset:valid-token');
  });

  it('should throw BadRequestException when token is invalid', async () => {
    jest.spyOn(redis, 'get').mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'bad-token', newPassword: 'newpass123' }),
    ).rejects.toThrow(BadRequestException);

    try {
      await useCase.execute({ token: 'bad-token', newPassword: 'newpass123' });
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.AUTH_RESET_TOKEN_INVALID);
    }
  });
});
