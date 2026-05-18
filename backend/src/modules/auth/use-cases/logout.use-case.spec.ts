import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LogoutUseCase } from './logout.use-case';
import { RedisService } from '../../redis/redis.service';
import type { RefreshTokenPayload } from '../interfaces';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let jwtService: JwtService;
  let redis: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LogoutUseCase,
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
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get(LogoutUseCase);
    jwtService = module.get(JwtService);
    redis = module.get(RedisService);
  });

  it('should delete the refresh token from Redis when valid', async () => {
    const payload: RefreshTokenPayload = { sub: 'user-1', tokenId: 'tok-1' };
    jest.spyOn(jwtService, 'verify').mockReturnValue(payload);

    await useCase.execute('valid-token');

    expect(redis.del).toHaveBeenCalledWith('session:user-1:tok-1');
  });

  it('should not throw when token is invalid', async () => {
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(useCase.execute('bad-token')).resolves.not.toThrow();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
