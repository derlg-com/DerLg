import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../modules/redis/redis.service';

/**
 * Thin cache-aside wrapper around RedisService.
 * Use cases call `getOrSet` to transparently cache Prisma query results.
 */
@Injectable()
export class CachedService {
  private readonly logger = new Logger(CachedService.name);

  constructor(private readonly redis: RedisService) {}

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached !== null) {
      this.logger.debug(`cache HIT  ${key}`);
      return JSON.parse(cached) as T;
    }

    this.logger.debug(`cache MISS ${key}`);
    const value = await loader();
    await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    return value;
  }
}
