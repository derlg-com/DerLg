import { Test } from '@nestjs/testing';
import { LogoutAllDevicesUseCase } from './logout-all-devices.use-case';
import { RedisService } from '../../redis/redis.service';

describe('LogoutAllDevicesUseCase', () => {
  let useCase: LogoutAllDevicesUseCase;
  let redis: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LogoutAllDevicesUseCase,
        {
          provide: RedisService,
          useValue: {
            keys: jest.fn(),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get(LogoutAllDevicesUseCase);
    redis = module.get(RedisService);
  });

  it('should delete all session keys for a user', async () => {
    jest
      .spyOn(redis, 'keys')
      .mockResolvedValue(['session:user-1:tok-1', 'session:user-1:tok-2']);

    await useCase.execute('user-1');

    expect(redis.keys).toHaveBeenCalledWith('session:user-1:*');
    expect(redis.del).toHaveBeenCalledWith('session:user-1:tok-1');
    expect(redis.del).toHaveBeenCalledWith('session:user-1:tok-2');
  });

  it('should not error when no keys exist', async () => {
    jest.spyOn(redis, 'keys').mockResolvedValue([]);

    await expect(useCase.execute('user-1')).resolves.not.toThrow();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
