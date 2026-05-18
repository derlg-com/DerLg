import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class LogoutAllDevicesUseCase {
  constructor(private readonly redis: RedisService) {}

  async execute(userId: string): Promise<void> {
    const keys = await this.redis.keys(`session:${userId}:*`);
    if (keys.length > 0) {
      for (const key of keys) {
        await this.redis.del(key);
      }
    }
  }
}
