import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthUseCase } from './google-auth.use-case';

describe('GoogleAuthUseCase', () => {
  let useCase: GoogleAuthUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleAuthUseCase,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_CLIENT_ID') return 'google-client-id';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    useCase = module.get(GoogleAuthUseCase);
  });

  it('should return a valid Google OAuth URL', () => {
    const result = useCase.execute();

    expect(result.url).toContain(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(result.url).toContain('client_id=google-client-id');
    expect(result.url).toContain('response_type=code');
    expect(result.url).toContain('scope=openid+email+profile');
    expect(result.url).toContain('access_type=offline');
    expect(result.url).toContain('prompt=consent');
  });

  it('should use empty client_id when not configured', async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleAuthUseCase,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get(GoogleAuthUseCase);
    const result = useCase.execute();

    expect(result.url).toContain('client_id=');
  });
});
