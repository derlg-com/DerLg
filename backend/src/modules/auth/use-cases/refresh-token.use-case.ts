import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { RefreshTokenPayload } from '../interfaces';
import { GenerateTokensUseCase } from './generate-tokens.use-case';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly generateTokens: GenerateTokensUseCase,
  ) {}

  async execute(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );

      const key = `session:${payload.sub}:${payload.tokenId}`;
      const stored = await this.redis.get(key);

      if (!stored || stored !== refreshToken) {
        throw new UnauthorizedException({
          code: ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
          message: 'Invalid or expired refresh token',
        });
      }

      await this.redis.del(key);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
          message: 'Invalid or expired refresh token',
        });
      }

      const result = await this.generateTokens.execute(user);

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
        message: 'Invalid or expired refresh token',
      });
    }
  }
}
