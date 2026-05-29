import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Deletes the booking-hold Redis key. Idempotent — DEL on a missing key is a no-op.
 */
@Injectable()
export class ReleaseHoldUtil {
  constructor(private readonly redis: RedisService) {}

  async release(bookingId: string): Promise<void> {
    await this.redis.del(`booking_hold:${bookingId}`);
  }
}
