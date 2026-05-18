import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../../redis/redis.service';
import { RefreshTokenPayload } from '../interfaces';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );

      const key = `session:${payload.sub}:${payload.tokenId}`;
      await this.redis.del(key);
    } catch {
      // Best effort: token might already be invalid
    }
  }
}
