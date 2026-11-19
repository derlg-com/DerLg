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
  private async deletePatterns(patterns: string[]): Promise<number> {
    let total = 0;
    for (const pattern of patterns) {
      try {
        total += await this.redis.delByPattern(pattern);
      } catch (error) {
        this.logger.warn(
          `Cache invalidation failed for pattern ${pattern}: ${(error as Error).message}`,
        );
      }
    }
    return total;
  }

  /**
   * Clears global search cache.
   */
  async invalidateSearchCaches(): Promise<void> {
    const total = await this.deletePatterns(['cat:search:*']);
    this.logger.debug(`Invalidated ${total} search cache key(s)`);
  }

  /**
   * Clears every cached read that could contain the given trip.
   *
   * Covers list pages, the detail and related views in all languages, the share
   * URL, place `nearby-trips` results, and search caches.
   */
  async invalidateTripCaches(tripId?: string): Promise<void> {
    const patterns = [
      'cat:trip:list:*',
      tripId ? `cat:trip:detail:${tripId}:*` : 'cat:trip:detail:*',
      tripId ? `cat:trip:related:${tripId}:*` : 'cat:trip:related:*',
      tripId ? `cat:trip:share:${tripId}` : 'cat:trip:share:*',
      'cat:place:nearby-trips:*',
      'cat:search:*',
    ];

    if (tripId) {
      patterns.push('cat:trip:related:*');
    }

    const total = await this.deletePatterns(patterns);
    this.logger.debug(
      `Invalidated ${total} trip cache key(s)${tripId ? ` for trip ${tripId}` : ''}`,
    );
  }

  /**
   * Clears every cached read that could contain the given hotel.
   *
   * Covers hotel lists in all languages, hotel detail views, room lists, and search caches.
   */
  async invalidateHotelCaches(hotelId?: string): Promise<void> {
    const patterns = [
      'cat:hotel:list:*',
      hotelId ? `cat:hotel:detail:${hotelId}:*` : 'cat:hotel:detail:*',
      hotelId ? `cat:hotel:rooms:${hotelId}:*` : 'cat:hotel:rooms:*',
      'cat:search:*',
    ];

    const total = await this.deletePatterns(patterns);
    this.logger.debug(
      `Invalidated ${total} hotel cache key(s)${hotelId ? ` for hotel ${hotelId}` : ''}`,
    );
  }

  /**
   * Clears every cached read for guides.
   *
   * Covers guide lists, detail views, availability queries, and search caches.
   */
  async invalidateGuideCaches(guideId?: string): Promise<void> {
    const patterns = [
      'cat:guide:list:*',
      guideId ? `cat:guide:detail:${guideId}:*` : 'cat:guide:detail:*',
      guideId ? `cat:guide:availability:${guideId}:*` : 'cat:guide:availability:*',
      'cat:search:*',
    ];

    const total = await this.deletePatterns(patterns);
    this.logger.debug(
      `Invalidated ${total} guide cache key(s)${guideId ? ` for guide ${guideId}` : ''}`,
    );
  }

  /**
   * Clears every cached read for vehicles.
   *
   * Covers vehicle lists, detail views, and availability queries.
   */
  async invalidateVehicleCaches(vehicleId?: string): Promise<void> {
    const patterns = [
      'cat:vehicle:list:*',
      vehicleId ? `cat:vehicle:detail:${vehicleId}:*` : 'cat:vehicle:detail:*',
      vehicleId ? `cat:vehicle:availability:${vehicleId}:*` : 'cat:vehicle:availability:*',
    ];

    const total = await this.deletePatterns(patterns);
    this.logger.debug(
      `Invalidated ${total} vehicle cache key(s)${vehicleId ? ` for vehicle ${vehicleId}` : ''}`,
    );
  }
}
