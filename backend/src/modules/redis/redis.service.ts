import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Typed wrapper around ioredis. Connects via REDIS_URL or individual
 * host/port config. Gracefully closes on application shutdown.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.client = redisUrl
      ? new Redis(redisUrl, { maxRetriesPerRequest: 3 })
      : new Redis({
          host: this.configService.get<string>('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
          password: this.configService.get<string>('REDIS_PASSWORD'),
          db: this.configService.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
        });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.client.setex(key, seconds, value);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /**
   * Deletes every key matching a glob pattern, returning how many were removed.
   *
   * Uses SCAN rather than KEYS: `KEYS` walks the entire keyspace in one blocking
   * call, which stalls every other client on a shared Redis. SCAN yields in
   * cursor-sized batches instead, so a catalogue invalidation cannot pause live
   * booking traffic.
   *
   * Deletes are batched per scan chunk — one round trip per chunk rather than one
   * per key.
   */
  async delByPattern(pattern: string, batchSize = 200): Promise<number> {
    let deleted = 0;
    let pending: string[] = [];

    const stream = this.client.scanStream({
      match: pattern,
      count: batchSize,
    });

    for await (const chunk of stream as AsyncIterable<string[]>) {
      pending.push(...chunk);
      if (pending.length >= batchSize) {
        deleted += await this.client.del(...pending);
        pending = [];
      }
    }

    if (pending.length > 0) {
      deleted += await this.client.del(...pending);
    }

    return deleted;
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
