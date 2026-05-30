import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

interface CachedIdemEntry<T> {
  bookingId: string;
  response: T;
}

/**
 * Idempotency-Key helper for booking creation per CONSTITUTION.md § 2.5.
 * Key shape: `idem:booking:{userId}:{key}`. TTL = 24h.
 *
 * - `lookup`: returns the cached entry on retry, or null on first call.
 * - `store`: persists the response after a successful commit so retries
 *   return byte-identical bodies and don't create duplicate rows.
 */
@Injectable()
export class IdempotencyUtil {
  private static readonly TTL_SECONDS = 86_400;

  constructor(private readonly redis: RedisService) {}

  private key(userId: string, idemKey: string): string {
    return `idem:booking:${userId}:${idemKey}`;
  }

  async lookup<T>(
    userId: string,
    idemKey: string,
  ): Promise<CachedIdemEntry<T> | null> {
    const raw = await this.redis.get(this.key(userId, idemKey));
    return raw ? (JSON.parse(raw) as CachedIdemEntry<T>) : null;
  }

  async store<T>(
    userId: string,
    idemKey: string,
    bookingId: string,
    response: T,
  ): Promise<void> {
    const payload: CachedIdemEntry<T> = { bookingId, response };
    await this.redis.setex(
      this.key(userId, idemKey),
      IdempotencyUtil.TTL_SECONDS,
      JSON.stringify(payload),
    );
  }
}
