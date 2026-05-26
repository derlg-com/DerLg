import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import { RedisService } from '../../redis/redis.service';
import type { User } from '@prisma/client';

describe('GenerateTokensUseCase', () => {
  let useCase: GenerateTokensUseCase;
  let jwtService: JwtService;
  let redis: RedisService;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'user',
    passwordHash: 'hash',
    phone: null,
    avatarUrl: null,
    supabaseUid: 'sup-1',
    preferredLanguage: 'en',
    status: 'active',
    loyaltyPoints: 0,
    isStudentVerified: false,
    referralCode: null,
    referredBy: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GenerateTokensUseCase,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockImplementation((payload, options) => {
              if (options?.expiresIn === '15m') return 'access-token';
              if (options?.expiresIn === '7d') return 'refresh-token';
              return 'token';
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_ACCESS_SECRET'
                ? 'access-secret'
                : key === 'JWT_REFRESH_SECRET'
                  ? 'refresh-secret'
                  : undefined,
            ),
          },
        },
        {
          provide: RedisService,
          useValue: {
            setex: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get(GenerateTokensUseCase);
    jwtService = module.get(JwtService);
    redis = module.get(RedisService);
  });

  it('should generate access token with 15m expiry', async () => {
    await useCase.execute(mockUser);

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        email: 'test@example.com',
        role: 'user',
      }),
      expect.objectContaining({ expiresIn: '15m' }),
    );
  });

  it('should generate refresh token with 7d expiry', async () => {
    await useCase.execute(mockUser);

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', tokenId: expect.any(String) }),
      expect.objectContaining({ expiresIn: '7d' }),
    );
  });

  it('should store refresh token in Redis with 7-day TTL', async () => {
    await useCase.execute(mockUser);

    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringMatching(/^session:user-1:/),
      604800,
      'refresh-token',
    );
  });

  it('should return correct response shape', async () => {
    const result = await useCase.execute(mockUser);

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
    });
  });
});
