import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../modules/redis/redis.service';

/**
 * Catalogue cache invalidation.
 *
 * `CachedService` only reads through `getOrSet`, so before this existed nothing
 * could clear a cached list or detail page. An admin publishing a trip would not
 * appear on the public site until the TTL lapsed, which made the admin CRUD look
 * broken even when the write had succeeded.
 *
 * Patterns mirror `cache-keys.ts`. They are deliberately broad: a trip appears in
 * paginated list keys whose query hash cannot be reconstructed from the trip id
 * alone, so the whole `cat:trip:*` family goes rather than trying to compute
 * which pages contained it.
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Clears every cached read that could contain the given trip.
   *
   * Covers list pages, the detail and related views in all languages, the share
   * URL, and place `nearby-trips` results — a published trip changes what a
   * nearby place should surface, so those go too.
   *
   * Never throws: a stale cache is a lesser problem than a failed publish, so a
   * Redis outage is logged and swallowed rather than rolled back into the caller.
   */
  async invalidateTripCaches(tripId?: string): Promise<void> {
    const patterns = [
      // Every paginated/filtered list in every language.
      'cat:trip:list:*',
      // Detail and related are per-trip when we know the id, otherwise all.
      tripId ? `cat:trip:detail:${tripId}:*` : 'cat:trip:detail:*',
      tripId ? `cat:trip:related:${tripId}:*` : 'cat:trip:related:*',
      tripId ? `cat:trip:share:${tripId}` : 'cat:trip:share:*',
      // A trip's itinerary links places, so nearby-trips results can change.
      'cat:place:nearby-trips:*',
    ];

    // `related` keys are computed from OTHER trips' ids, so a single trip change
    // can invalidate a sibling's related list. Clear the whole family on any edit.
    if (tripId) {
      patterns.push('cat:trip:related:*');
    }

    let total = 0;
    for (const pattern of patterns) {
      try {
        total += await this.redis.delByPattern(pattern);
      } catch (error) {
        this.logger.warn(
          `Trip cache invalidation failed for pattern ${pattern}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.debug(
      `Invalidated ${total} trip cache key(s)${tripId ? ` for trip ${tripId}` : ''}`,
    );
  }
}
