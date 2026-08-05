import { Injectable } from '@nestjs/common';
import { ItemType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  GUIDE_SELECT,
  GuideRecord,
  HOTEL_SELECT,
  HotelRecord,
  PLACE_SUMMARY_SELECT,
  PlaceSummary,
  TRANSPORT_SELECT,
  TransportRecord,
} from './interfaces/catalog.interface';

export interface ResolvedRefs {
  places: Map<string, PlaceSummary>;
  hotels: Map<string, HotelRecord>;
  transports: Map<string, TransportRecord>;
  guides: Map<string, GuideRecord>;
}

export interface RefKey {
  type: ItemType;
  refId: string | null;
}

/**
 * Resolves the polymorphic `refId` columns (`PackageDayItem`, `BookingItem`,
 * draft snapshots) into real catalogue rows.
 *
 * This is the single place that answers "does this id actually exist?", which
 * makes it the anti-hallucination guard for the AI tool layer as well as the
 * display resolver for the catalogue API. Nothing bookable is ever persisted
 * without passing through here first.
 */
@Injectable()
export class CatalogRefResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** Batch-loads every referenced row in four queries, avoiding N+1. */
  async resolve(refs: RefKey[]): Promise<ResolvedRefs> {
    const idsByType = new Map<ItemType, Set<string>>();
    for (const ref of refs) {
      if (!ref.refId || ref.type === ItemType.CUSTOM) {
        continue;
      }
      const bucket = idsByType.get(ref.type) ?? new Set<string>();
      bucket.add(ref.refId);
      idsByType.set(ref.type, bucket);
    }

    const placeIds = [...(idsByType.get(ItemType.PLACE) ?? [])];
    const hotelIds = [...(idsByType.get(ItemType.HOTEL) ?? [])];
    const transportIds = [...(idsByType.get(ItemType.TRANSPORT) ?? [])];
    const guideIds = [...(idsByType.get(ItemType.GUIDE) ?? [])];

    const [places, hotels, transports, guides] = await Promise.all([
      placeIds.length
        ? this.prisma.place.findMany({ where: { id: { in: placeIds } }, select: PLACE_SUMMARY_SELECT })
        : Promise.resolve([]),
      hotelIds.length
        ? this.prisma.hotel.findMany({ where: { id: { in: hotelIds } }, select: HOTEL_SELECT })
        : Promise.resolve([]),
      transportIds.length
        ? this.prisma.transport.findMany({
            where: { id: { in: transportIds } },
            select: TRANSPORT_SELECT,
          })
        : Promise.resolve([]),
      guideIds.length
        ? this.prisma.guide.findMany({ where: { id: { in: guideIds } }, select: GUIDE_SELECT })
        : Promise.resolve([]),
    ]);

    return {
      places: new Map(places.map((row) => [row.id, row])),
      hotels: new Map(hotels.map((row) => [row.id, row])),
      transports: new Map(transports.map((row) => [row.id, row])),
      guides: new Map(guides.map((row) => [row.id, row])),
    };
  }

  /** Returns the refs that do not exist in the database. */
  async findMissing(refs: RefKey[]): Promise<RefKey[]> {
    const resolved = await this.resolve(refs);

    return refs.filter((ref) => {
      if (!ref.refId || ref.type === ItemType.CUSTOM) {
        return false;
      }
      switch (ref.type) {
        case ItemType.PLACE:
          return !resolved.places.has(ref.refId);
        case ItemType.HOTEL:
          return !resolved.hotels.has(ref.refId);
        case ItemType.TRANSPORT:
          return !resolved.transports.has(ref.refId);
        case ItemType.GUIDE:
          return !resolved.guides.has(ref.refId);
        default:
          return false;
      }
    });
  }

  /** Base unit price of a referenced resource, in cents. */
  unitPriceCents(type: ItemType, refId: string | null, resolved: ResolvedRefs): number {
    if (!refId) {
      return 0;
    }
    switch (type) {
      case ItemType.PLACE:
        return resolved.places.get(refId)?.entranceFeeCents ?? 0;
      case ItemType.HOTEL:
        return resolved.hotels.get(refId)?.pricePerNightCents ?? 0;
      case ItemType.TRANSPORT:
        return resolved.transports.get(refId)?.pricePerSeatCents ?? 0;
      case ItemType.GUIDE:
        return resolved.guides.get(refId)?.pricePerDayCents ?? 0;
      default:
        return 0;
    }
  }

  /** Per-day capacity of a referenced resource, used by the availability engine. */
  capacityFor(type: ItemType, refId: string | null, resolved: ResolvedRefs): number | null {
    if (!refId) {
      return null;
    }
    switch (type) {
      case ItemType.PLACE:
        return resolved.places.get(refId)?.dailyCapacity ?? null;
      case ItemType.HOTEL:
        return resolved.hotels.get(refId)?.roomsPerNight ?? null;
      case ItemType.TRANSPORT:
        return resolved.transports.get(refId)?.seatsPerDeparture ?? null;
      case ItemType.GUIDE:
        return resolved.guides.get(refId)?.dailyCapacity ?? null;
      default:
        return null;
    }
  }
}
