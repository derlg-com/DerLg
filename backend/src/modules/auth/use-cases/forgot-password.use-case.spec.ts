import { Test } from '@nestjs/testing';
import { ForgotPasswordUseCase } from './forgot-password.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SendResetEmailUseCase } from './send-reset-email.use-case';
import { ConfigService } from '@nestjs/config';

describe('ForgotPasswordUseCase', () => {
  let useCase: ForgotPasswordUseCase;
  let prisma: PrismaService;
  let redis: RedisService;
  let sendResetEmail: SendResetEmailUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ForgotPasswordUseCase,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            setex: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'FRONTEND_URL' ? 'http://localhost:3000' : undefined,
            ),
          },
        },
        {
          provide: SendResetEmailUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get(ForgotPasswordUseCase);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    sendResetEmail = module.get(SendResetEmailUseCase);
  });

  it('should silently return when email not found', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

    await useCase.execute('unknown@example.com');

    expect(redis.setex).not.toHaveBeenCalled();
    expect(sendResetEmail.execute).not.toHaveBeenCalled();
  });

  it('should store token in Redis and send email for known user', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as never);

    await useCase.execute('test@example.com');

    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringMatching(/^password_reset:/),
      3600,
      'user-1',
    );
    expect(sendResetEmail.execute).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining('http://localhost:3000/reset-password?token='),
    );
  });
});
