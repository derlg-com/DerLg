import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { RefreshTokenPayload } from '../interfaces';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let jwtService: JwtService;
  let redis: RedisService;
  let prisma: PrismaService;
  let generateTokens: GenerateTokensUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RefreshTokenUseCase,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_REFRESH_SECRET' ? 'refresh-secret' : undefined,
            ),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
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
              accessToken: 'new-access',
              refreshToken: 'new-refresh',
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

    useCase = module.get(RefreshTokenUseCase);
    jwtService = module.get(JwtService);
    redis = module.get(RedisService);
    prisma = module.get(PrismaService);
    generateTokens = module.get(GenerateTokensUseCase);
  });

  it('should return new tokens when refresh token is valid', async () => {
    const payload: RefreshTokenPayload = { sub: 'user-1', tokenId: 'tok-1' };
    jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
    jest.spyOn(redis, 'get').mockResolvedValue('valid-refresh-token');
    jest
      .spyOn(prisma.user, 'findUnique')
      .mockResolvedValue({ id: 'user-1' } as never);

    const result = await useCase.execute('valid-refresh-token');

    expect(redis.del).toHaveBeenCalledWith('session:user-1:tok-1');
    expect(generateTokens.execute).toHaveBeenCalled();
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('should throw UnauthorizedException when token does not match Redis', async () => {
    const payload: RefreshTokenPayload = { sub: 'user-1', tokenId: 'tok-1' };
    jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
    jest.spyOn(redis, 'get').mockResolvedValue('different-token');

    await expect(useCase.execute('valid-refresh-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when user not found', async () => {
    const payload: RefreshTokenPayload = { sub: 'user-1', tokenId: 'tok-1' };
    jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
    jest.spyOn(redis, 'get').mockResolvedValue('valid-refresh-token');
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

    await expect(useCase.execute('valid-refresh-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when JWT verification fails', async () => {
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(useCase.execute('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
