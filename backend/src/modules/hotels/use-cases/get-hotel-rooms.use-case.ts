import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { hotelRoomsKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { overlappingRoomIds } from '../utils';
import type { RoomAvailabilityQueryDto } from '../dto';
import type { RoomAvailability } from '../interfaces';
import { Prisma, BookingStatus } from '@prisma/client';

@Injectable()
export class GetHotelRoomsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    hotelId: string,
    query: RoomAvailabilityQueryDto,
  ): Promise<RoomAvailability[]> {
    const { checkIn, checkOut } = query;

    // Verify hotel exists before caching — prevents stale 404s
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, isPublished: true },
      select: { id: true },
    });

    if (!hotel) {
      throw new NotFoundException({
        code: ErrorCode.HTL_NOT_FOUND,
        message: 'Hotel not found',
      });
    }

    return this.cache.getOrSet(
      hotelRoomsKey(hotelId, checkIn, checkOut),
      3600,
      async () => {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        const [rooms, bookingItems] = await Promise.all([
          this.prisma.hotelRoom.findMany({
            where: { hotelId, isActive: true },
            select: {
              id: true,
              roomType: true,
              maxOccupancy: true,
              priceUsd: true,
              amenities: true,
              images: true,
            } satisfies Prisma.HotelRoomSelect,
          }),
          this.prisma.bookingItem.findMany({
            where: {
              hotelRoomId: { not: null },
              hotelRoom: { hotelId },
              startDate: { lt: checkOutDate },
              endDate: { gte: checkInDate },
              booking: {
                status: {
                  in: [
                    BookingStatus.hold,
                    BookingStatus.pending_payment,
                    BookingStatus.confirmed,
                  ],
                },
                deletedAt: null,
              },
            },
            select: { hotelRoomId: true, startDate: true, endDate: true },
          }),
        ]);

        const bookedIds = overlappingRoomIds(
          bookingItems,
          checkInDate,
          checkOutDate,
        );

        return rooms.map((room) => ({
          id: room.id,
          roomType: room.roomType,
          maxOccupancy: room.maxOccupancy,
          priceUsd:
            typeof room.priceUsd === 'number'
              ? room.priceUsd
              : room.priceUsd.toNumber(),
          amenities: room.amenities,
          images: room.images,
          available: !bookedIds.has(room.id),
        }));
      },
    );
  }
}
