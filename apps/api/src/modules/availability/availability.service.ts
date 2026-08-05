import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ItemType, Prisma } from '@prisma/client';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { CatalogRefResolver, ResolvedRefs } from '../catalog/catalog-ref.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import {
  AvailabilityAlternative,
  AvailabilityItemResult,
  AvailabilityReport,
  INVENTORY_HOLDING_STATUSES,
  PriceableItem,
  addDays,
  toDateOnly,
  unitsFor,
} from './interfaces/availability.interface';
import { PackagePricingBasis, PricingService } from './pricing.service';
import { PriceQuote } from './interfaces/availability.interface';

export interface AvailabilityAndPrice {
  availability: AvailabilityReport;
  price: PriceQuote;
}

const MAX_ALTERNATIVES = 3;

/**
 * Capacity arithmetic for the whole product.
 *
 * Inventory is counted from `BookingItem` rows whose parent booking still holds
 * stock (HOLD, PENDING_PAYMENT, CONFIRMED, COMPLETED). Expired and cancelled
 * bookings release their seats automatically because they fall out of that list —
 * there is no separate "release" job to get wrong.
 */
@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: CatalogRefResolver,
    private readonly pricing: PricingService,
  ) {}

  /** Reads a package's pricing basis, or null when the journey is from scratch. */
  async pricingBasisFor(packageId?: string | null): Promise<PackagePricingBasis | null> {
    if (!packageId) {
      return null;
    }
    return this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        pricingMode: true,
        basePriceCents: true,
        minGroupSize: true,
        maxGroupSize: true,
      },
    });
  }

  /** Non-mutating check: what is available, what is not, and what it would cost. */
  async check(dto: CheckAvailabilityDto): Promise<AvailabilityAndPrice> {
    const items: PriceableItem[] = dto.items.map((item) => ({
      dayNumber: item.dayNumber,
      type: item.type as ItemType,
      refId: item.refId ?? null,
      title: item.title,
      bookable: item.bookable ?? item.type !== 'CUSTOM',
      extraPriceCents: item.extraPriceCents,
      quantity: item.quantity,
    }));

    const resolved = await this.refs.resolve(items.map((i) => ({ type: i.type, refId: i.refId })));
    const basis = await this.pricingBasisFor(dto.packageId);

    const availability = await this.evaluate({
      startDate: dto.startDate,
      guests: dto.guests,
      items,
      itemKeys: dto.items.map((item) => item.itemKey),
      resolved,
      excludeBookingId: dto.excludeBookingId,
    });

    const price = this.pricing.quote({ guests: dto.guests, items, basis }, resolved);

    return { availability, price };
  }

  /**
   * Fresh re-check immediately before taking money or a hold. Throws when
   * anything has gone unavailable since the user last looked, with the per-item
   * detail the UI needs to explain what changed.
   */
  async confirm(dto: CheckAvailabilityDto): Promise<AvailabilityAndPrice> {
    const result = await this.check(dto);

    if (!result.availability.available) {
      const unavailable = result.availability.items.filter((item) => !item.available);
      this.logger.warn('Availability confirmation failed', {
        startDate: dto.startDate,
        guests: dto.guests,
        unavailable: unavailable.map((item) => ({ type: item.type, refId: item.refId })),
      });

      throw new AppException(
        ErrorCode.AVAILABILITY_UNAVAILABLE,
        'Some parts of this trip are no longer available for those dates.',
        HttpStatus.CONFLICT,
        { items: unavailable },
      );
    }

    return result;
  }

  /** Core evaluation shared by check() and confirm(). */
  private async evaluate(input: {
    startDate: string;
    guests: number;
    items: PriceableItem[];
    itemKeys?: Array<string | undefined>;
    resolved: ResolvedRefs;
    excludeBookingId?: string;
  }): Promise<AvailabilityReport> {
    const { startDate, guests, items, itemKeys, resolved, excludeBookingId } = input;

    const start = new Date(`${startDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'The start date is not a valid calendar date.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const maxDayNumber = items.reduce((max, item) => Math.max(max, item.dayNumber), 1);
    const bookable = items.filter((item) => item.bookable && item.type !== ItemType.CUSTOM && item.refId);

    const usage = await this.loadUsage(bookable, start, excludeBookingId);
    const results: AvailabilityItemResult[] = [];

    for (const [index, item] of items.entries()) {
      const date = toDateOnly(addDays(start, item.dayNumber - 1));
      const requested = item.quantity ?? unitsFor(item.type, guests);
      const itemKey = itemKeys?.[index];

      // Free time consumes nothing and is always "available".
      if (!item.bookable || item.type === ItemType.CUSTOM || !item.refId) {
        results.push({
          itemKey,
          dayNumber: item.dayNumber,
          date,
          type: item.type,
          refId: item.refId,
          label: item.title,
          requested: 0,
          capacity: null,
          alreadyBooked: 0,
          remaining: null,
          available: true,
          alternatives: [],
        });
        continue;
      }

      const exists = this.referenceExists(item.type, item.refId, resolved);
      if (!exists) {
        results.push({
          itemKey,
          dayNumber: item.dayNumber,
          date,
          type: item.type,
          refId: item.refId,
          label: item.title,
          requested,
          capacity: null,
          alreadyBooked: 0,
          remaining: null,
          available: false,
          reason: 'MISSING_REFERENCE',
          alternatives: await this.findAlternatives(item, date, guests, resolved, usage),
        });
        continue;
      }

      const capacity = this.refs.capacityFor(item.type, item.refId, resolved);
      const alreadyBooked = usage.get(this.usageKey(item.type, item.refId, date)) ?? 0;
      const remaining = capacity === null ? null : capacity - alreadyBooked;
      const available = remaining === null || remaining >= requested;

      results.push({
        itemKey,
        dayNumber: item.dayNumber,
        date,
        type: item.type,
        refId: item.refId,
        label: item.title,
        requested,
        capacity,
        alreadyBooked,
        remaining,
        available,
        ...(available
          ? {}
          : {
              reason: remaining !== null && remaining <= 0 ? 'SOLD_OUT' : 'CAPACITY_EXCEEDED',
            }),
        alternatives: available
          ? []
          : await this.findAlternatives(item, date, guests, resolved, usage),
      });
    }

    const unavailableCount = results.filter((result) => !result.available).length;

    return {
      startDate: toDateOnly(start),
      endDate: toDateOnly(addDays(start, maxDayNumber - 1)),
      guests,
      available: unavailableCount === 0,
      items: results,
      unavailableCount,
    };
  }

  private referenceExists(type: ItemType, refId: string, resolved: ResolvedRefs): boolean {
    switch (type) {
      case ItemType.PLACE:
        return resolved.places.has(refId);
      case ItemType.HOTEL:
        return resolved.hotels.has(refId);
      case ItemType.TRANSPORT:
        return resolved.transports.has(refId);
      case ItemType.GUIDE:
        return resolved.guides.has(refId);
      default:
        return false;
    }
  }

  private usageKey(type: ItemType, refId: string, date: string): string {
    return `${type}:${refId}:${date}`;
  }

  /**
   * One grouped query for every (resource, date) pair in the itinerary rather
   * than a query per line.
   */
  private async loadUsage(
    items: PriceableItem[],
    start: Date,
    excludeBookingId?: string,
  ): Promise<Map<string, number>> {
    const usage = new Map<string, number>();
    if (items.length === 0) {
      return usage;
    }

    const refIds = [...new Set(items.map((item) => item.refId!).filter(Boolean))];
    const dates = [
      ...new Set(items.map((item) => toDateOnly(addDays(start, item.dayNumber - 1)))),
    ].map((date) => new Date(`${date}T00:00:00.000Z`));

    const where: Prisma.BookingItemWhereInput = {
      refId: { in: refIds },
      date: { in: dates },
      bookable: true,
      booking: {
        status: { in: [...INVENTORY_HOLDING_STATUSES] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    };

    const grouped = await this.prisma.bookingItem.groupBy({
      by: ['type', 'refId', 'date'],
      where,
      _sum: { quantity: true },
    });

    for (const row of grouped) {
      if (!row.refId) {
        continue;
      }
      usage.set(
        this.usageKey(row.type, row.refId, toDateOnly(row.date)),
        row._sum.quantity ?? 0,
      );
    }

    return usage;
  }

  /**
   * Suggests same-city substitutes with room on the date. Places are not
   * substituted (a temple is not interchangeable), only sellable inventory.
   */
  private async findAlternatives(
    item: PriceableItem,
    date: string,
    guests: number,
    resolved: ResolvedRefs,
    usage: Map<string, number>,
  ): Promise<AvailabilityAlternative[]> {
    const requested = item.quantity ?? unitsFor(item.type, guests);

    if (item.type === ItemType.HOTEL) {
      const current = item.refId ? resolved.hotels.get(item.refId) : undefined;
      const candidates = await this.prisma.hotel.findMany({
        where: {
          ...(current ? { city: { slug: current.city.slug } } : {}),
          ...(item.refId ? { id: { not: item.refId } } : {}),
        },
        select: { id: true, slug: true, name: true, pricePerNightCents: true, roomsPerNight: true },
        orderBy: { pricePerNightCents: 'asc' },
        take: 10,
      });
      return this.filterAlternatives(
        candidates.map((row) => ({
          refId: row.id,
          slug: row.slug,
          label: row.name,
          priceCents: row.pricePerNightCents,
          capacity: row.roomsPerNight,
        })),
        ItemType.HOTEL,
        date,
        requested,
        usage,
      );
    }

    if (item.type === ItemType.TRANSPORT) {
      const current = item.refId ? resolved.transports.get(item.refId) : undefined;
      const candidates = await this.prisma.transport.findMany({
        where: {
          ...(current
            ? {
                originCity: { slug: current.originCity.slug },
                destinationCity: { slug: current.destinationCity.slug },
              }
            : {}),
          ...(item.refId ? { id: { not: item.refId } } : {}),
        },
        select: {
          id: true,
          slug: true,
          operator: true,
          departureTime: true,
          pricePerSeatCents: true,
          seatsPerDeparture: true,
        },
        orderBy: { departureTime: 'asc' },
        take: 10,
      });
      return this.filterAlternatives(
        candidates.map((row) => ({
          refId: row.id,
          slug: row.slug,
          label: `${row.operator} ${row.departureTime}`,
          priceCents: row.pricePerSeatCents,
          capacity: row.seatsPerDeparture,
        })),
        ItemType.TRANSPORT,
        date,
        requested,
        usage,
      );
    }

    if (item.type === ItemType.GUIDE) {
      const current = item.refId ? resolved.guides.get(item.refId) : undefined;
      const candidates = await this.prisma.guide.findMany({
        where: {
          ...(current ? { city: { slug: current.city.slug } } : {}),
          ...(item.refId ? { id: { not: item.refId } } : {}),
        },
        select: { id: true, slug: true, fullName: true, pricePerDayCents: true, dailyCapacity: true },
        orderBy: { rating: 'desc' },
        take: 10,
      });
      return this.filterAlternatives(
        candidates.map((row) => ({
          refId: row.id,
          slug: row.slug,
          label: row.fullName,
          priceCents: row.pricePerDayCents,
          capacity: row.dailyCapacity,
        })),
        ItemType.GUIDE,
        date,
        requested,
        usage,
      );
    }

    return [];
  }

  /** Keeps only candidates with enough remaining stock on the date. */
  private async filterAlternatives(
    candidates: Array<{
      refId: string;
      slug: string;
      label: string;
      priceCents: number;
      capacity: number;
    }>,
    type: ItemType,
    date: string,
    requested: number,
    usage: Map<string, number>,
  ): Promise<AvailabilityAlternative[]> {
    if (candidates.length === 0) {
      return [];
    }

    const grouped = await this.prisma.bookingItem.groupBy({
      by: ['refId'],
      where: {
        type,
        refId: { in: candidates.map((candidate) => candidate.refId) },
        date: new Date(`${date}T00:00:00.000Z`),
        bookable: true,
        booking: { status: { in: [...INVENTORY_HOLDING_STATUSES] } },
      },
      _sum: { quantity: true },
    });

    const booked = new Map(grouped.map((row) => [row.refId ?? '', row._sum.quantity ?? 0]));
    // Reuse anything already counted for this itinerary.
    for (const candidate of candidates) {
      const fromUsage = usage.get(this.usageKey(type, candidate.refId, date));
      if (fromUsage !== undefined) {
        booked.set(candidate.refId, fromUsage);
      }
    }

    return candidates
      .map((candidate) => ({
        refId: candidate.refId,
        slug: candidate.slug,
        label: candidate.label,
        priceCents: candidate.priceCents,
        remaining: candidate.capacity - (booked.get(candidate.refId) ?? 0),
      }))
      .filter((candidate) => candidate.remaining >= requested)
      .slice(0, MAX_ALTERNATIVES);
  }
}
