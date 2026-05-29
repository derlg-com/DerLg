import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

/**
 * Writes the booking-hold Redis key with TTL.
 * Key shape: `booking_hold:{bookingId}`. Default TTL is read from
 * `BOOKING_HOLD_TTL_SECONDS` (per CONSTITUTION.md § 9.1, default 900s).
 */
@Injectable()
export class SetHoldUtil {
  private readonly defaultTtl: number;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.defaultTtl = this.config.get<number>('BOOKING_HOLD_TTL_SECONDS', 900);
  }

  async set(bookingId: string, ttlSeconds?: number): Promise<void> {
    await this.redis.setex(
      `booking_hold:${bookingId}`,
      ttlSeconds ?? this.defaultTtl,
      '1',
    );
  }
}
