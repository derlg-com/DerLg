import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SendResetEmailUseCase } from './send-reset-email.use-case';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('SendResetEmailUseCase', () => {
  let useCase: SendResetEmailUseCase;

  beforeEach(async () => {
    mockSend.mockClear();
    jest.clearAllMocks();
  });

  it('should send email when RESEND_API_KEY is configured', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SendResetEmailUseCase,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RESEND_API_KEY') return 'test-api-key';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    useCase = module.get(SendResetEmailUseCase);
    mockSend.mockResolvedValue({ id: 'email-1' });

    await useCase.execute(
      'test@example.com',
      'http://localhost:3000/reset-password?token=abc',
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'DerLg <noreply@derlg.com>',
        to: 'test@example.com',
        subject: 'Reset your DerLg password',
      }),
    );
  });

  it('should silently return when RESEND_API_KEY is missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SendResetEmailUseCase,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RESEND_API_KEY') return '';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    useCase = module.get(SendResetEmailUseCase);

    await useCase.execute(
      'test@example.com',
      'http://localhost:3000/reset-password?token=abc',
    );

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should throw when Resend API returns an error', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SendResetEmailUseCase,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RESEND_API_KEY') return 'test-api-key';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    useCase = module.get(SendResetEmailUseCase);
    mockSend.mockRejectedValue(new Error('API error'));

    await expect(
      useCase.execute(
        'test@example.com',
        'http://localhost:3000/reset-password?token=abc',
      ),
    ).rejects.toThrow('API error');
  });
});
