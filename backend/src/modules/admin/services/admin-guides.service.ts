import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  AuditEventType,
  Prisma,
  Specialty,
  SupportedLanguage,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { GuideResponseDto } from '../dto/guide-response.dto';

/** Bookings that still hold a guide's time. Cancelled/expired ones release it. */
const BLOCKING_BOOKING_STATUSES: Prisma.EnumBookingStatusFilter = {
  notIn: ['cancelled', 'expired', 'payment_failed', 'no_show'],
};

@Injectable()
export class AdminGuidesService {
  private readonly logger = new Logger(AdminGuidesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllGuides(filters: {
    languages?: string;
    specialties?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { languages, specialties, search, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.GuideWhereInput = {};

    // Languages and specialties are now enum-backed. Anything outside the enum
    // cannot match a row, so unknown values are dropped rather than passed to
    // Prisma, which would throw on an invalid enum value.
    const languageList = this.parseEnumList(languages, SupportedLanguage);
    if (languageList.length > 0) {
      where.languages = { some: { language: { in: languageList } } };
    }

    const specialtyList = this.parseEnumList(specialties, Specialty);
    if (specialtyList.length > 0) {
      where.specialties = { some: { specialty: { in: specialtyList } } };
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      const matchingUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      where.OR = [
        { bio: { contains: term, mode: 'insensitive' } },
        { province: { contains: term, mode: 'insensitive' } },
        ...(matchingUserIds.length > 0
          ? [{ userId: { in: matchingUserIds } }]
          : []),
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.guide.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          languages: { select: { language: true } },
          specialties: { select: { specialty: true } },
          _count: { select: { bookingItems: true, reviews: true } },
        },
      }),
      this.prisma.guide.count({ where }),
    ]);

    const userIds = data.map((g) => g.userId);
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true, phone: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const mapped = data.map((guide) => {
      const user = userMap.get(guide.userId);
      return {
        id: guide.id,
        userId: guide.userId,
        user: user
          ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
            }
          : null,
        name: user?.fullName ?? null,
        bio: guide.bio,
        avatarUrl: guide.avatarUrl,
        images: guide.images,
        pricePerDayUsd: Number(guide.pricePerDayUsd),
        isVerified: guide.isVerified,
        province: guide.province,
        provinces: guide.provinces,
        isActive: guide.isActive,
        languages: guide.languages.map((l) => l.language),
        specialties: guide.specialties.map((s) => s.specialty),
        assignmentCount: guide._count.bookingItems,
        reviewCount: guide._count.reviews,
        createdAt: guide.createdAt,
        updatedAt: guide.updatedAt,
      };
    });

    return {
      data: mapped,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getGuideById(id: string): Promise<GuideResponseDto> {
    const guide = await this.prisma.guide.findUnique({
      where: { id },
      include: {
        languages: { select: { language: true } },
        specialties: { select: { specialty: true } },
        // Guide's relation to booking lines is `bookingItems`, and each line now
        // carries an interval rather than a single `date`.
        bookingItems: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            booking: {
              select: {
                id: true,
                reference: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
          where: { booking: { deletedAt: null } },
          orderBy: { startDate: 'desc' },
          take: 20,
        },
        reviews: { select: { id: true, rating: true } },
        _count: { select: { bookingItems: true, reviews: true } },
      },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with id ${id} not found`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: guide.userId },
      select: { id: true, email: true, fullName: true, phone: true },
    });

    const avgRating =
      guide.reviews.length > 0
        ? guide.reviews.reduce((sum, r) => sum + r.rating, 0) /
          guide.reviews.length
        : null;

    return {
      id: guide.id,
      userId: guide.userId,
      user: user
        ? {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
          }
        : null,
      bio: guide.bio,
      avatarUrl: guide.avatarUrl,
      images: guide.images,
      pricePerDayUsd: Number(guide.pricePerDayUsd),
      isVerified: guide.isVerified,
      province: guide.province,
      provinces: guide.provinces,
      isActive: guide.isActive,
      languages: guide.languages.map((l) => l.language),
      specialties: guide.specialties.map((s) => s.specialty),
      assignmentCount: guide._count.bookingItems,
      reviewCount: guide._count.reviews,
      averageRating: avgRating === null ? null : Number(avgRating.toFixed(2)),
      createdAt: guide.createdAt,
      updatedAt: guide.updatedAt,
    };
  }

  async createGuide(dto: {
    userId: string;
    bio?: string;
    languages?: SupportedLanguage[];
    specialties?: Specialty[];
    province: string;
    provinces?: string[];
    pricePerDayUsd: number;
    avatarUrl?: string;
    images?: string[];
    isVerified?: boolean;
    isActive?: boolean;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with id ${dto.userId} not found`);
    }

    const existingGuide = await this.prisma.guide.findUnique({
      where: { userId: dto.userId },
      select: { id: true },
    });

    if (existingGuide) {
      throw new ConflictException(
        `Guide profile already exists for user ${dto.userId}`,
      );
    }

    // One transaction: a guide without its languages/specialties is a broken
    // record that would show up in the catalogue with no filters matching it.
    const guide = await this.prisma.$transaction(async (tx) => {
      const created = await tx.guide.create({
        data: {
          userId: dto.userId,
          bio: dto.bio ?? null,
          avatarUrl: dto.avatarUrl ?? null,
          images: dto.images ?? [],
          pricePerDayUsd: dto.pricePerDayUsd,
          isVerified: dto.isVerified ?? false,
          province: dto.province,
          provinces: dto.provinces ?? [dto.province],
          isActive: dto.isActive ?? true,
        },
      });

      if (dto.languages?.length) {
        await tx.guideLanguage.createMany({
          data: dto.languages.map((language) => ({
            guideId: created.id,
            language,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.specialties?.length) {
        await tx.guideSpecialty.createMany({
          data: dto.specialties.map((specialty) => ({
            guideId: created.id,
            specialty,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return {
      id: guide.id,
      userId: guide.userId,
      bio: guide.bio,
      avatarUrl: guide.avatarUrl,
      images: guide.images,
      pricePerDayUsd: Number(guide.pricePerDayUsd),
      isVerified: guide.isVerified,
      province: guide.province,
      provinces: guide.provinces,
      isActive: guide.isActive,
      languages: dto.languages ?? [],
      specialties: dto.specialties ?? [],
      createdAt: guide.createdAt,
      updatedAt: guide.updatedAt,
    };
  }

  async updateGuide(
    id: string,
    dto: {
      bio?: string;
      languages?: SupportedLanguage[];
      specialties?: Specialty[];
      province?: string;
      provinces?: string[];
      pricePerDayUsd?: number;
      avatarUrl?: string;
      images?: string[];
      isVerified?: boolean;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.guide.findUnique({
      where: { id },
      include: {
        languages: { select: { language: true } },
        specialties: { select: { specialty: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Guide with id ${id} not found`);
    }

    const guide = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.guide.update({
        where: { id },
        data: {
          bio: dto.bio,
          avatarUrl: dto.avatarUrl,
          images: dto.images,
          pricePerDayUsd: dto.pricePerDayUsd,
          isVerified: dto.isVerified,
          province: dto.province,
          provinces: dto.provinces,
          isActive: dto.isActive,
        },
      });

      // Replace-in-place semantics: an explicit [] clears the set, while
      // omitting the key leaves it untouched.
      if (dto.languages !== undefined) {
        await tx.guideLanguage.deleteMany({ where: { guideId: id } });
        if (dto.languages.length > 0) {
          await tx.guideLanguage.createMany({
            data: dto.languages.map((language) => ({ guideId: id, language })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.specialties !== undefined) {
        await tx.guideSpecialty.deleteMany({ where: { guideId: id } });
        if (dto.specialties.length > 0) {
          await tx.guideSpecialty.createMany({
            data: dto.specialties.map((specialty) => ({
              guideId: id,
              specialty,
            })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    const finalLanguages =
      dto.languages ?? existing.languages.map((l) => l.language);
    const finalSpecialties =
      dto.specialties ?? existing.specialties.map((s) => s.specialty);

    return {
      id: guide.id,
      userId: guide.userId,
      bio: guide.bio,
      avatarUrl: guide.avatarUrl,
      images: guide.images,
      pricePerDayUsd: Number(guide.pricePerDayUsd),
      isVerified: guide.isVerified,
      province: guide.province,
      provinces: guide.provinces,
      isActive: guide.isActive,
      languages: finalLanguages,
      specialties: finalSpecialties,
      createdAt: guide.createdAt,
      updatedAt: guide.updatedAt,
    };
  }

  async getGuideAssignments(guideId: string) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with id ${guideId} not found`);
    }

    const assignments = await this.prisma.bookingItem.findMany({
      where: { guideId, booking: { deletedAt: null } },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        bookingId: true,
        startDate: true,
        endDate: true,
        quantity: true,
        unitPriceUsd: true,
        subtotalUsd: true,
        booking: {
          select: {
            reference: true,
            status: true,
            userId: true,
          },
        },
        hotelRoom: { select: { roomType: true } },
      },
    });

    return assignments.map((item) => ({
      id: item.id,
      bookingId: item.bookingId,
      reference: item.booking.reference,
      status: item.booking.status,
      startDate: item.startDate,
      endDate: item.endDate,
      quantity: item.quantity,
      unitPriceUsd: Number(item.unitPriceUsd),
      subtotalUsd: Number(item.subtotalUsd),
      customerId: item.booking.userId,
      roomType: item.hotelRoom?.roomType ?? null,
    }));
  }

  /**
   * Guide availability across a date range.
   *
   * Rewritten from the old single-`date` equality check to a true interval
   * overlap. `BookingItem` now stores `startDate`/`endDate`, so a guide booked
   * for the 10th–14th must show as unavailable when asked about the 12th, which
   * the previous equality test missed entirely.
   *
   * Two intervals overlap when each starts on or before the other ends.
   */
  async getGuideAvailability(
    guideId: string,
    startDate: string,
    endDate: string,
  ) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      select: { id: true, isActive: true },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with id ${guideId} not found`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const overlappingItems = await this.prisma.bookingItem.findMany({
      where: {
        guideId,
        startDate: { lte: end },
        endDate: { gte: start },
        booking: {
          deletedAt: null,
          status: BLOCKING_BOOKING_STATUSES,
        },
      },
      select: {
        startDate: true,
        endDate: true,
        booking: { select: { id: true, reference: true, status: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const bookedRanges = overlappingItems.map((item) => ({
      startDate: item.startDate,
      endDate: item.endDate,
      bookingId: item.booking.id,
      reference: item.booking.reference,
      status: item.booking.status,
    }));

    return {
      guideId: guideId,
      isAvailable: bookedRanges.length === 0 && guide.isActive,
      isActive: guide.isActive,
      requestedRange: { startDate: start, endDate: end },
      bookedRanges: bookedRanges,
      totalConflicts: bookedRanges.length,
    };
  }

  /** Filters a comma-separated query value down to valid enum members. */
  private parseEnumList<T extends Record<string, string>>(
    raw: string | undefined,
    enumObject: T,
  ): T[keyof T][] {
    if (!raw) return [];
    const allowed = new Set(Object.values(enumObject));
    return raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => allowed.has(v)) as T[keyof T][];
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
          userId: params.userId ?? null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId ?? null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn('Audit log creation failed', {
        entityType: params.entityType,
        entityId: params.entityId,
        error: (error as Error).message,
      });
    }
  }
}
