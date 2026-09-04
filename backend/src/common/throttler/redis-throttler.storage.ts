import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

import { RedisService } from '../../modules/redis/redis.service';

const KEY_PREFIX = 'throttle';

/**
 * Atomic increment-and-classify, evaluated inside Redis.
 *
 * Doing this as separate INCR/EXPIRE/GET round trips lets two concurrent
 * requests both read a count below the limit and both pass, which is precisely
 * the burst a rate limiter exists to stop. A Lua script runs to completion
 * without interleaving, so the check and the increment cannot be split.
 *
 * KEYS[1] hit counter, KEYS[2] block marker
 * ARGV[1] ttl (ms), ARGV[2] limit, ARGV[3] blockDuration (ms)
 * returns { totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs }
 */
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockPttl = redis.call('PTTL', blockKey)
if blockPttl > 0 then
  local blockedHits = tonumber(redis.call('GET', hitsKey) or limit + 1)
  return { blockedHits, redis.call('PTTL', hitsKey), 1, blockPttl }
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttl)
end

local pttl = redis.call('PTTL', hitsKey)
-- A key with no expiry (PTTL -1) would rate-limit the caller forever.
if pttl < 0 then
  redis.call('PEXPIRE', hitsKey, ttl)
  pttl = ttl
end

if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return { hits, pttl, 1, blockDuration }
end

return { hits, pttl, 0, 0 }
`;

/**
 * Distributed `ThrottlerStorage` backed by the shared Redis instance.
 *
 * The library's default storage is a per-process `Map`. With N application
 * instances behind a load balancer that yields an effective limit of N x limit,
 * and every deploy resets all counters — so a limit of 5 login attempts per
 * 5 minutes is not actually 5. Redis is already a hard dependency here (holds
 * sessions and booking holds), so there is no new infrastructure cost.
 *
 * Fails **open** on a Redis outage: rate limiting is a protective measure, and
 * taking the whole API down because the limiter cannot be consulted trades a
 * small abuse window for a total outage. The failure is logged so it is visible.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private degraded = false;

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `${KEY_PREFIX}:${throttlerName}:${key}`;
    const blockKey = `${KEY_PREFIX}:${throttlerName}:${key}:blocked`;

    try {
      const result = (await this.redis
        .getClient()
        .eval(
          INCREMENT_SCRIPT,
          2,
          hitsKey,
          blockKey,
          String(ttl),
          String(limit),
          String(blockDuration || ttl),
        )) as [number, number, number, number];

      if (this.degraded) {
        this.degraded = false;
        this.logger.log('Redis rate-limit store recovered');
      }

      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] =
        result;

      // The guard reports these in `Retry-After` / `X-RateLimit-Reset`, which
      // are second-granularity per RFC 6585.
      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpireMs / 1000),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
      };
    } catch (error) {
      if (!this.degraded) {
        this.degraded = true;
        this.logger.error(
          'Redis rate-limit store unavailable; failing open until it recovers',
          { error: (error as Error).message },
        );
      }
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
