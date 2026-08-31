import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditEventType, Prisma, TripCategory } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CacheInvalidationService } from '../../../common/cache';
import { CreateTripDto } from '../dto/create-trip.dto';
import { UpdateTripDto } from '../dto/update-trip.dto';
import {
  CreateItineraryItemDto,
  ReorderItineraryDto,
  SetTripGuidesDto,
  UpdateItineraryItemDto,
} from '../dto/trip-itinerary.dto';
import { TripTranslationDto } from '../dto/trip-translation.dto';

/**
 * Trip package administration.
 *
 * A Trip is a four-table aggregate — the trip row, its per-language
 * `TripTranslation`s, its `TripItineraryItem`s, and those items' own
 * translations — plus an implicit many-to-many to Guide. Every mutation that
 * spans more than one of those tables runs in a transaction, and every mutation
 * invalidates the public catalogue cache, or the change stays invisible on the
 * site until the TTL lapses.
 */
@Injectable()
export class AdminTripsService {
  private readonly logger = new Logger(AdminTripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async listTrips(filters: {
    search?: string;
    category?: TripCategory;
    isPublished?: boolean;
    page?: number;
    limit?: number;
  }) {
    const currentPage = Math.max(1, filters.page ?? 1);
    const take = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (currentPage - 1) * take;

    const where: Prisma.TripWhereInput = {};
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }
    if (filters.search && filters.search.trim() !== '') {
      // Titles live on translation rows, not the trip, so the filter reaches
      // through the relation — the same shape admin-hotels uses for hotel names.
      where.translations = {
        some: {
          title: { contains: filters.search.trim(), mode: 'insensitive' },
        },
      };
    }

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          category: true,
          durationDays: true,
          basePriceUsd: true,
          maxCapacity: true,
          coverImage: true,
          images: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
          translations: {
            where: { language: 'en' },
            select: { title: true, subtitle: true },
          },
          _count: {
            select: { itineraryItems: true, guides: true, reviews: true },
          },
        },
      }),
      this.prisma.trip.count({ where }),
    ]);

    return {
      data: trips.map((trip) => ({
        id: trip.id,
        // Null when the English translation is missing — which is also the
        // condition that blocks publishing, so the UI can flag it.
        title: trip.translations[0]?.title ?? null,
        subtitle: trip.translations[0]?.subtitle ?? null,
        category: trip.category,
        durationDays: trip.durationDays,
        basePriceUsd: Number(trip.basePriceUsd),
        maxCapacity: trip.maxCapacity,
        coverImage: trip.coverImage,
        images: trip.images,
        isPublished: trip.isPublished,
        itineraryCount: trip._count.itineraryItems,
        guideCount: trip._count.guides,
        reviewCount: trip._count.reviews,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
      })),
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getTripById(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        durationDays: true,
        basePriceUsd: true,
        maxCapacity: true,
        coverImage: true,
        images: true,
        extras: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        translations: {
          select: {
            id: true,
            language: true,
            title: true,
            subtitle: true,
            description: true,
            includedItems: true,
            excludedItems: true,
            cancellationPolicy: true,
            meetingPoint: true,
          },
        },
        itineraryItems: {
          orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            dayNumber: true,
            sortOrder: true,
            placeId: true,
            hotelId: true,
            translations: {
              select: {
                id: true,
                language: true,
                title: true,
                description: true,
              },
            },
          },
        },
        guides: {
          // Guide has a `userId` scalar but no `user` relation defined in the
          // schema, so the guide's name is resolved in a second query below
          // rather than through an include.
          select: { id: true, userId: true, isActive: true, province: true },
        },
        _count: { select: { reviews: true, bookingItems: true } },
      },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    const guideUserIds = trip.guides.map((g) => g.userId);
    const guideUsers = guideUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: guideUserIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const guideUserMap = new Map(guideUsers.map((u) => [u.id, u]));

    return {
      ...trip,
      basePriceUsd: Number(trip.basePriceUsd),
      guides: trip.guides.map((g) => ({
        id: g.id,
        userId: g.userId,
        isActive: g.isActive,
        province: g.province,
        fullName: guideUserMap.get(g.userId)?.fullName ?? null,
        email: guideUserMap.get(g.userId)?.email ?? null,
      })),
      reviewCount: trip._count.reviews,
      bookingItemCount: trip._count.bookingItems,
    };
  }

  // -------------------------------------------------------------------------
  // Create / update / publish
  // -------------------------------------------------------------------------

  async createTrip(dto: CreateTripDto) {
    this.assertUniqueLanguages(dto.translations);

    // Publishing at creation time still has to satisfy the English-title rule.
    if (dto.isPublished) {
      this.assertPublishable(dto.translations);
    }

    const tripId = randomUUID();

    // One transaction: a trip whose translations failed to write would have no
    // title in any language and would be invisible yet occupy an id.
    const trip = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          id: tripId,
          category: dto.category,
          durationDays: dto.durationDays,
          basePriceUsd: dto.basePriceUsd,
          maxCapacity: dto.maxCapacity ?? 10,
          coverImage: dto.coverImage ?? null,
          images: dto.images ?? [],
          isPublished: dto.isPublished ?? false,
        },
        select: { id: true },
      });

      await tx.tripTranslation.createMany({
        data: dto.translations.map((t) => ({
          id: randomUUID(),
          tripId: created.id,
          language: t.language,
          title: t.title,
          subtitle: t.subtitle ?? null,
          description: t.description ?? null,
          includedItems: t.includedItems ?? [],
          excludedItems: t.excludedItems ?? [],
          cancellationPolicy: t.cancellationPolicy ?? null,
          meetingPoint: t.meetingPoint ?? null,
        })),
      });

      return created;
    });

    await this.cacheInvalidation.invalidateTripCaches(trip.id);
    return this.getTripById(trip.id);
  }

  async updateTrip(id: string, dto: UpdateTripDto) {
    const existing = await this.prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        durationDays: true,
        translations: { select: { language: true, title: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    if (dto.translations) {
      this.assertUniqueLanguages(dto.translations);
    }

    // Shrinking the duration must not orphan itinerary items on removed days.
    if (dto.durationDays !== undefined) {
      const beyond = await this.prisma.tripItineraryItem.count({
        where: { tripId: id, dayNumber: { gt: dto.durationDays } },
      });
      if (beyond > 0) {
        throw new BadRequestException(
          `Cannot shorten this trip to ${dto.durationDays} days: ${beyond} itinerary item(s) fall on later days. Remove or move them first.`,
        );
      }
    }

    if (dto.isPublished === true) {
      this.assertPublishable(
        this.mergeTranslationsForPublishCheck(
          existing.translations,
          dto.translations,
        ),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id },
        data: {
          category: dto.category,
          durationDays: dto.durationDays,
          basePriceUsd: dto.basePriceUsd,
          maxCapacity: dto.maxCapacity,
          coverImage: dto.coverImage,
          images: dto.images,
          isPublished: dto.isPublished,
        },
      });

      for (const t of dto.translations ?? []) {
        // Upsert on the composite unique so an absent language is created and a
        // present one is edited, while languages not in the payload are kept.
        await tx.tripTranslation.upsert({
          where: { tripId_language: { tripId: id, language: t.language } },
          create: {
            id: randomUUID(),
            tripId: id,
            language: t.language,
            title: t.title,
            subtitle: t.subtitle ?? null,
            description: t.description ?? null,
            includedItems: t.includedItems ?? [],
            excludedItems: t.excludedItems ?? [],
            cancellationPolicy: t.cancellationPolicy ?? null,
            meetingPoint: t.meetingPoint ?? null,
          },
          update: {
            title: t.title,
            subtitle: t.subtitle,
            description: t.description,
            includedItems: t.includedItems,
            excludedItems: t.excludedItems,
            cancellationPolicy: t.cancellationPolicy,
            meetingPoint: t.meetingPoint,
          },
        });
      }
    });

    await this.cacheInvalidation.invalidateTripCaches(id);
    return this.getTripById(id);
  }

  async setPublished(id: string, isPublished: boolean) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        translations: { select: { language: true, title: true } },
      },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    if (isPublished) {
      this.assertPublishable(trip.translations);
    }

    await this.prisma.trip.update({ where: { id }, data: { isPublished } });
    await this.cacheInvalidation.invalidateTripCaches(id);
    return this.getTripById(id);
  }

  // -------------------------------------------------------------------------
  // Itinerary
  // -------------------------------------------------------------------------

  async listItinerary(tripId: string) {
    await this.assertTripExists(tripId);
    return this.prisma.tripItineraryItem.findMany({
      where: { tripId },
      orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        dayNumber: true,
        sortOrder: true,
        placeId: true,
        hotelId: true,
        translations: {
          select: { id: true, language: true, title: true, description: true },
        },
      },
    });
  }

  async createItineraryItem(tripId: string, dto: CreateItineraryItemDto) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, durationDays: true },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertDayWithinDuration(dto.dayNumber, trip.durationDays);
    this.assertUniqueLanguages(dto.translations);
    await this.assertLinkedEntitiesExist(dto.placeId, dto.hotelId);

    const itemId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.tripItineraryItem.create({
        data: {
          id: itemId,
          tripId,
          dayNumber: dto.dayNumber,
          sortOrder: dto.sortOrder ?? 0,
          placeId: dto.placeId ?? null,
          hotelId: dto.hotelId ?? null,
        },
      });
      await tx.tripItineraryItemTranslation.createMany({
        data: dto.translations.map((t) => ({
          id: randomUUID(),
          itineraryItemId: itemId,
          language: t.language,
          title: t.title,
          description: t.description ?? null,
        })),
      });
    });

    await this.cacheInvalidation.invalidateTripCaches(tripId);
    return this.listItinerary(tripId);
  }

  async updateItineraryItem(
    tripId: string,
    itemId: string,
    dto: UpdateItineraryItemDto,
  ) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, durationDays: true },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    // Scoped by tripId as well as id: an item id belonging to another trip must
    // 404 rather than being silently editable through the wrong parent.
    const item = await this.prisma.tripItineraryItem.findFirst({
      where: { id: itemId, tripId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException(
        `Itinerary item ${itemId} not found on trip ${tripId}`,
      );
    }

    if (dto.dayNumber !== undefined) {
      this.assertDayWithinDuration(dto.dayNumber, trip.durationDays);
    }
    if (dto.translations) {
      this.assertUniqueLanguages(dto.translations);
    }
    await this.assertLinkedEntitiesExist(
      dto.placeId ?? undefined,
      dto.hotelId ?? undefined,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.tripItineraryItem.update({
        where: { id: itemId },
        data: {
          dayNumber: dto.dayNumber,
          sortOrder: dto.sortOrder,
          // null clears the link, undefined leaves it as-is.
          placeId: dto.placeId,
          hotelId: dto.hotelId,
        },
      });

      for (const t of dto.translations ?? []) {
        await tx.tripItineraryItemTranslation.upsert({
          where: {
            itineraryItemId_language: {
              itineraryItemId: itemId,
              language: t.language,
            },
          },
          create: {
            id: randomUUID(),
            itineraryItemId: itemId,
            language: t.language,
            title: t.title,
            description: t.description ?? null,
          },
          update: { title: t.title, description: t.description },
        });
      }
    });

    await this.cacheInvalidation.invalidateTripCaches(tripId);
    return this.listItinerary(tripId);
  }

  async deleteItineraryItem(tripId: string, itemId: string) {
    const item = await this.prisma.tripItineraryItem.findFirst({
      where: { id: itemId, tripId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException(
        `Itinerary item ${itemId} not found on trip ${tripId}`,
      );
    }

    // Item translations cascade via the schema's onDelete: Cascade.
    await this.prisma.tripItineraryItem.delete({ where: { id: itemId } });
    await this.cacheInvalidation.invalidateTripCaches(tripId);
    return this.listItinerary(tripId);
  }

  async reorderItinerary(tripId: string, dto: ReorderItineraryDto) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, durationDays: true },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    const ids = dto.items.map((i) => i.itemId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Reorder payload contains duplicate itemIds',
      );
    }

    // Verify all ids belong to THIS trip before writing anything, so a payload
    // referencing a sibling trip's item cannot partially apply.
    const owned = await this.prisma.tripItineraryItem.findMany({
      where: { id: { in: ids }, tripId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      const ownedSet = new Set(owned.map((o) => o.id));
      const foreign = ids.filter((id) => !ownedSet.has(id));
      throw new NotFoundException(
        `Itinerary item(s) not found on trip ${tripId}: ${foreign.join(', ')}`,
      );
    }

    for (const entry of dto.items) {
      this.assertDayWithinDuration(entry.dayNumber, trip.durationDays);
    }

    // One transaction so the itinerary is never observable mid-reorder.
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.tripItineraryItem.update({
          where: { id: entry.itemId },
          data: { dayNumber: entry.dayNumber, sortOrder: entry.sortOrder },
        }),
      ),
    );

    await this.cacheInvalidation.invalidateTripCaches(tripId);
    return this.listItinerary(tripId);
  }

  // -------------------------------------------------------------------------
  // Guides
  // -------------------------------------------------------------------------

  async setTripGuides(tripId: string, dto: SetTripGuidesDto) {
    await this.assertTripExists(tripId);

    if (dto.guideIds.length > 0) {
      const guides = await this.prisma.guide.findMany({
        where: { id: { in: dto.guideIds } },
        select: { id: true, isActive: true },
      });

      const found = new Set(guides.map((g) => g.id));
      const missing = dto.guideIds.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Unknown guide id(s): ${missing.join(', ')}`,
        );
      }

      const inactive = guides.filter((g) => !g.isActive).map((g) => g.id);
      if (inactive.length > 0) {
        throw new BadRequestException(
          `Cannot assign inactive guide(s): ${inactive.join(', ')}`,
        );
      }
    }

    // `set` replaces the whole relation, so one call both adds and removes.
    await this.prisma.trip.update({
      where: { id: tripId },
      data: { guides: { set: dto.guideIds.map((id) => ({ id })) } },
    });

    await this.cacheInvalidation.invalidateTripCaches(tripId);
    return this.getTripById(tripId);
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  /**
   * Hard-deletes a trip, but only when nothing references it.
   *
   * `Trip` has no `deletedAt`, and `BookingItem.tripId` / `Booking`'s template
   * relation both point at it. Deleting a booked trip would orphan booking and
   * accounting history, so a referenced trip is refused with 409 and the caller
   * is told to unpublish instead — which achieves the same visible outcome.
   */
  async deleteTrip(id: string) {
    await this.assertTripExists(id);

    const [bookingItems, bookingsAsTemplate] = await Promise.all([
      this.prisma.bookingItem.count({ where: { tripId: id } }),
      // The Booking side of the BookingTripTemplate relation. Its FK is
      // ON DELETE SET NULL, so Postgres would happily null it out — losing the
      // record of which package was booked. That silent history loss is exactly
      // what this guard exists to prevent, so it is checked explicitly.
      this.prisma.booking.count({ where: { tripTemplateId: id } }),
    ]);
    const references = bookingItems + bookingsAsTemplate;

    if (references > 0) {
      throw new ConflictException(
        `Trip ${id} is referenced by ${references} booking record(s) ` +
          `(${bookingItems} booking item(s), ${bookingsAsTemplate} booking template(s)) ` +
          `and cannot be deleted without losing that history. Unpublish it instead.`,
      );
    }

    // Translations and itinerary (with their own translations) cascade.
    await this.prisma.trip.delete({ where: { id } });
    await this.cacheInvalidation.invalidateTripCaches(id);

    return { id, deleted: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async assertTripExists(id: string): Promise<void> {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }
  }

  private assertDayWithinDuration(day: number, durationDays: number): void {
    if (day > durationDays) {
      throw new BadRequestException(
        `dayNumber ${day} exceeds the trip duration of ${durationDays} day(s)`,
      );
    }
  }

  /**
   * Confirms an itinerary item's optional place/hotel links resolve.
   *
   * Both FKs are `onDelete: SetNull`, so a bad id would surface as an opaque
   * Prisma foreign-key error (a 500) rather than telling the admin which id was
   * wrong. Checked up front instead.
   */
  private async assertLinkedEntitiesExist(
    placeId?: string,
    hotelId?: string,
  ): Promise<void> {
    if (placeId) {
      const place = await this.prisma.place.findUnique({
        where: { id: placeId },
        select: { id: true },
      });
      if (!place) {
        throw new BadRequestException(`Unknown placeId: ${placeId}`);
      }
    }

    if (hotelId) {
      const hotel = await this.prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { id: true },
      });
      if (!hotel) {
        throw new BadRequestException(`Unknown hotelId: ${hotelId}`);
      }
    }
  }

  /** A duplicated language would break the composite unique mid-transaction. */
  private assertUniqueLanguages(translations: { language: string }[]): void {
    const languages = translations.map((t) => t.language);
    if (new Set(languages).size !== languages.length) {
      throw new BadRequestException(
        'Duplicate language in translations; each language may appear at most once',
      );
    }
  }

  /**
   * English is the fallback locale for the public site, so a trip without a
   * non-blank English title would render as an untitled card.
   */
  private assertPublishable(
    translations: { language: string; title?: string | null }[],
  ): void {
    const en = translations.find((t) => t.language === 'en');
    if (!en || !en.title || en.title.trim() === '') {
      throw new BadRequestException(
        'Cannot publish a trip without a non-empty English (en) title',
      );
    }
  }

  /** Incoming translations win over stored ones for the publish check. */
  private mergeTranslationsForPublishCheck(
    stored: { language: string; title: string }[],
    incoming?: TripTranslationDto[],
  ): { language: string; title?: string | null }[] {
    const merged = new Map<
      string,
      { language: string; title?: string | null }
    >();
    for (const t of stored) merged.set(t.language, t);
    for (const t of incoming ?? []) merged.set(t.language, t);
    return [...merged.values()];
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log creation failed: ${(error as Error).message}`,
      );
    }
  }
}
