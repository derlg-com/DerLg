import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCallbackUseCase } from './google-callback.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateTokensUseCase } from './generate-tokens.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';

describe('GoogleCallbackUseCase', () => {
  let useCase: GoogleCallbackUseCase;
  let prisma: PrismaService;
  let generateTokens: GenerateTokensUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleCallbackUseCase,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_CLIENT_ID') return 'google-client-id';
              if (key === 'GOOGLE_CLIENT_SECRET') return 'google-client-secret';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
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

    useCase = module.get(GoogleCallbackUseCase);
    prisma = module.get(PrismaService);
    generateTokens = module.get(GenerateTokensUseCase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create new user and return tokens when email not found', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'google-access-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'google-123',
            email: 'new@example.com',
            name: 'New User',
            picture: 'https://example.com/pic.jpg',
          }),
          { status: 200 },
        ),
      );

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    const createdUser = {
      id: 'user-1',
      email: 'new@example.com',
      fullName: 'New User',
      avatarUrl: 'https://example.com/pic.jpg',
      role: 'user',
    };
    jest.spyOn(prisma.user, 'create').mockResolvedValue(createdUser as never);

    const result = await useCase.execute('auth-code');

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@example.com',
        fullName: 'New User',
        avatarUrl: 'https://example.com/pic.jpg',
        passwordHash: null,
        supabaseUid: expect.any(String),
      }),
    });
    expect(generateTokens.execute).toHaveBeenCalledWith(createdUser);
    expect(result.accessToken).toBe('access-token');

    fetchSpy.mockRestore();
  });

  it('should link existing user and return tokens', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'google-access-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'google-123',
            email: 'existing@example.com',
            name: 'Existing User',
          }),
          { status: 200 },
        ),
      );

    const existingUser = {
      id: 'user-2',
      email: 'existing@example.com',
      fullName: 'Existing User',
      role: 'user',
    };
    jest
      .spyOn(prisma.user, 'findUnique')
      .mockResolvedValue(existingUser as never);

    const result = await useCase.execute('auth-code');

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(generateTokens.execute).toHaveBeenCalledWith(existingUser);
    expect(result.accessToken).toBe('access-token');

    fetchSpy.mockRestore();
  });

  it('should throw BadRequestException when Google token exchange fails', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
      }),
    );

    await expect(useCase.execute('bad-code')).rejects.toThrow(
      BadRequestException,
    );

    try {
      await useCase.execute('bad-code');
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.AUTH_OAUTH_FAILED);
    }

    fetchSpy.mockRestore();
  });

  it('should throw BadRequestException when fetching user info fails', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'google-access-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
        }),
      );

    await expect(useCase.execute('auth-code')).rejects.toThrow(
      BadRequestException,
    );

    fetchSpy.mockRestore();
  });
});
