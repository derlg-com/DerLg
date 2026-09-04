import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventType, Prisma } from '@prisma/client';

@Injectable()
export class AdminHotelsService {
  private readonly logger = new Logger(AdminHotelsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllHotels(filters: {
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { search, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.HotelWhereInput = {};

    // `search` was destructured and then never used, so the hotels search box
    // returned the unfiltered list. Hotel names live on the translation rows,
    // not the hotel itself, so the filter reaches through the relation.
    if (search && search.trim() !== '') {
      const term = search.trim();
      where.translations = {
        some: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { address: { contains: term, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          translations: {
            where: { language: 'en' },
            select: { name: true, address: true },
          },
          _count: {
            select: { rooms: true },
          },
        },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    const mapped = data.map((hotel) => ({
      id: hotel.id,
      name: hotel.translations[0]?.name || null,
      address: hotel.translations[0]?.address || null,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      starRating: hotel.starRating,
      images: hotel.images,
      amenities: hotel.amenities,
      isPublished: hotel.isPublished,
      roomCount: hotel._count.rooms,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    }));

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

  async getHotelById(id: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      include: {
        translations: {
          select: {
            language: true,
            name: true,
            address: true,
            description: true,
          },
        },
        rooms: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { reviews: true },
        },
      },
    });

    if (!hotel) {
      throw new NotFoundException(`Hotel with id ${id} not found`);
    }

    return {
      id: hotel.id,
      translations: hotel.translations,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      starRating: hotel.starRating,
      images: hotel.images,
      amenities: hotel.amenities,
      isPublished: hotel.isPublished,
      rooms: hotel.rooms.map((room) => ({
        id: room.id,
        hotelId: room.hotelId,
        roomType: room.roomType,
        maxOccupancy: room.maxOccupancy,
        priceUsd: Number(room.priceUsd),
        amenities: room.amenities,
        images: room.images,
        isActive: room.isActive,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      })),
      reviewCount: hotel._count.reviews,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    };
  }

  async createHotel(dto: {
    name: string;
    latitude: number;
    longitude: number;
    starRating?: number;
    address?: string;
    description?: string;
    images?: string[];
    amenities?: string[];
    isPublished?: boolean;
  }) {
    const now = new Date();
    const hotelId = randomUUID();

    const hotel = await this.prisma.hotel.create({
      data: {
        id: hotelId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        starRating: dto.starRating,
        images: dto.images || [],
        amenities: dto.amenities || [],
        isPublished: dto.isPublished ?? false,
        updatedAt: now,
      },
    });

    await this.prisma.hotelTranslation.create({
      data: {
        id: randomUUID(),
        hotelId: hotel.id,
        language: 'en',
        name: dto.name,
        address: dto.address || null,
        description: dto.description || null,
      },
    });

    return {
      id: hotel.id,
      name: dto.name,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      starRating: hotel.starRating,
      address: dto.address,
      description: dto.description,
      images: hotel.images,
      amenities: hotel.amenities,
      isPublished: hotel.isPublished,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    };
  }

  async updateHotel(
    id: string,
    dto: {
      name?: string;
      latitude?: number;
      longitude?: number;
      starRating?: number;
      address?: string;
      description?: string;
      images?: string[];
      amenities?: string[];
      isPublished?: boolean;
    },
  ) {
    const existing = await this.prisma.hotel.findUnique({
      where: { id },
      include: {
        translations: {
          where: { language: 'en' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Hotel with id ${id} not found`);
    }

    const hotel = await this.prisma.hotel.update({
      where: { id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        starRating: dto.starRating,
        images: dto.images,
        amenities: dto.amenities,
        isPublished: dto.isPublished,
      },
    });

    const enTranslation = existing.translations[0];
    if (
      dto.name !== undefined ||
      dto.address !== undefined ||
      dto.description !== undefined
    ) {
      if (enTranslation) {
        await this.prisma.hotelTranslation.update({
          where: { id: enTranslation.id },
          data: {
            name: dto.name,
            address: dto.address,
            description: dto.description,
          },
        });
      } else {
        await this.prisma.hotelTranslation.create({
          data: {
            id: randomUUID(),
            hotelId: id,
            language: 'en',
            name: dto.name || '',
            address: dto.address || null,
            description: dto.description || null,
          },
        });
      }
    }

    return {
      id: hotel.id,
      name: dto.name ?? enTranslation?.name,
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      starRating: hotel.starRating,
      address: dto.address ?? enTranslation?.address,
      description: dto.description ?? enTranslation?.description,
      images: hotel.images,
      amenities: hotel.amenities,
      isPublished: hotel.isPublished,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    };
  }

  async getHotelRooms(hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true },
    });

    if (!hotel) {
      throw new NotFoundException(`Hotel with id ${hotelId} not found`);
    }

    const rooms = await this.prisma.hotelRoom.findMany({
      where: { hotelId: hotelId },
      orderBy: { createdAt: 'desc' },
    });

    return rooms.map((room) => ({
      id: room.id,
      hotelId: room.hotelId,
      roomType: room.roomType,
      maxOccupancy: room.maxOccupancy,
      priceUsd: Number(room.priceUsd),
      amenities: room.amenities,
      images: room.images,
      isActive: room.isActive,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }));
  }

  async createRoom(
    hotelId: string,
    dto: {
      roomType: string;
      maxOccupancy: number;
      priceUsd: number;
      amenities?: string[];
      images?: string[];
      isActive?: boolean;
    },
  ) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true },
    });

    if (!hotel) {
      throw new NotFoundException(`Hotel with id ${hotelId} not found`);
    }

    return this.prisma.hotelRoom.create({
      data: {
        id: randomUUID(),
        hotelId: hotelId,
        roomType: dto.roomType,
        maxOccupancy: dto.maxOccupancy,
        priceUsd: dto.priceUsd,
        amenities: dto.amenities || [],
        images: dto.images || [],
        isActive: dto.isActive ?? true,
        updatedAt: new Date(),
      },
    });
  }

  async updateRoom(
    hotelId: string,
    roomId: string,
    dto: {
      roomType?: string;
      maxOccupancy?: number;
      priceUsd?: number;
      amenities?: string[];
      images?: string[];
      isActive?: boolean;
    },
  ) {
    const room = await this.prisma.hotelRoom.findFirst({
      where: { id: roomId, hotelId: hotelId },
    });

    if (!room) {
      throw new NotFoundException(
        `Room with id ${roomId} not found for hotel ${hotelId}`,
      );
    }

    return this.prisma.hotelRoom.update({
      where: { id: roomId },
      data: {
        roomType: dto.roomType,
        maxOccupancy: dto.maxOccupancy,
        priceUsd: dto.priceUsd,
        amenities: dto.amenities,
        images: dto.images,
        isActive: dto.isActive,
      },
    });
  }

  async getRoomAvailability(
    roomId: string,
    startDate: string,
    endDate: string,
  ) {
    const room = await this.prisma.hotelRoom.findUnique({
      where: { id: roomId },
      include: {
        hotel: {
          select: {
            translations: {
              where: { language: 'en' },
              select: { name: true },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${roomId} not found`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Interval overlap, not per-day equality.
    //
    // The old query matched `booking_items.date` inside [start, end]. That column
    // no longer exists: the merge_booking_methods migration replaced it with a
    // startDate/endDate pair. Beyond the rename, the original logic was wrong for
    // ranges — a room booked 10th–14th did not surface when asked about the 12th,
    // because no single stored date fell in the window.
    //
    // Two closed intervals overlap when each begins on or before the other ends.
    const overlappingItems = await this.prisma.bookingItem.findMany({
      where: {
        hotelRoomId: roomId,
        startDate: { lte: end },
        endDate: { gte: start },
        booking: {
          // Soft-deleted bookings hold no inventory.
          deletedAt: null,
          // Cancelled/expired bookings release the room; anything else holds it.
          status: {
            notIn: ['cancelled', 'expired', 'payment_failed', 'no_show'],
          },
        },
      },
      select: {
        startDate: true,
        endDate: true,
        quantity: true,
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
      orderBy: { startDate: 'asc' },
    });

    const bookedRanges = overlappingItems.map((item) => ({
      startDate: item.startDate,
      endDate: item.endDate,
      quantity: item.quantity,
      bookingId: item.booking.id,
      reference: item.booking.reference,
      status: item.booking.status,
    }));

    return {
      roomId,
      roomType: room.roomType,
      hotelName: room.hotel.translations[0]?.name ?? null,
      isAvailable: bookedRanges.length === 0 && room.isActive,
      isActive: room.isActive,
      requestedRange: { startDate: start, endDate: end },
      bookedRanges,
      totalConflicts: bookedRanges.length,
    };
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
