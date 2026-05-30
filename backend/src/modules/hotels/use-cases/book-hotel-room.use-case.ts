import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { generateReference } from '../../bookings/utils/generate-reference.util';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import type { BookingDetail } from '../../bookings/interfaces';
import type { BookHotelRoomDto } from '../dto/book-hotel-room.dto';

@Injectable()
export class BookHotelRoomUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    hotelId: string,
    dto: BookHotelRoomDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);
    const nights = Math.floor(
      (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
    );
    if (nights < 1) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_INVALID_DATE_RANGE,
      });
    }

    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, isPublished: true },
      include: { translations: { where: { language: 'en' }, take: 1 } },
    });
    if (!hotel) {
      throw new NotFoundException({ code: ErrorCode.HTL_NOT_FOUND });
    }

    const room = await this.prisma.hotelRoom.findFirst({
      where: { id: dto.roomId, hotelId, isActive: true },
    });
    if (!room) {
      throw new NotFoundException({ code: ErrorCode.HTL_ROOM_NOT_FOUND });
    }

    const totalGuests = dto.guestsAdults + (dto.guestsChildren ?? 0);
    if (totalGuests > room.maxOccupancy) {
      throw new BadRequestException({ code: ErrorCode.BKNG_EXCEEDS_OCCUPANCY });
    }

    const subtotal = room.priceUsd.times(nights);
    const hotelName = hotel.translations[0]?.name ?? hotelId;

    return this.commitBooking.execute(
      user,
      {
        reference: generateReference('HTL'),
        totalPriceUsd: subtotal,
        items: [
          {
            type: 'hotel_room',
            resourceId: room.id,
            startDate: checkIn,
            endDate: checkOut,
            quantity: nights,
            unitPriceUsd: room.priceUsd,
            subtotalUsd: subtotal,
            snapshot: {
              hotelId: hotel.id,
              hotelName,
              roomId: room.id,
              roomType: room.roomType,
              maxOccupancy: room.maxOccupancy,
              guestsAdults: dto.guestsAdults,
              guestsChildren: dto.guestsChildren ?? 0,
              nights,
              pricePerNightUsd: room.priceUsd.toNumber(),
            },
          },
        ],
        metadata: {
          method: 'single_resource',
          singleResourceKind: 'hotel',
        },
      },
      idempotencyKey,
    );
  }
}
