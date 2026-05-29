import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import { BookHotelRoomUseCase } from './book-hotel-room.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

const D = (n: string) => new Prisma.Decimal(n);

describe('BookHotelRoomUseCase', () => {
  let useCase: BookHotelRoomUseCase;
  let prisma: {
    hotel: { findFirst: jest.Mock };
    hotelRoom: { findFirst: jest.Mock };
  };
  let commitBooking: { execute: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const hotelFactory = () => ({
    id: 'hotel-1',
    isPublished: true,
    translations: [{ name: 'Indochine Hotel' }],
  });

  const roomFactory = (over: Partial<{ priceUsd: Prisma.Decimal; maxOccupancy: number }> = {}) => ({
    id: 'room-1',
    hotelId: 'hotel-1',
    roomType: 'deluxe',
    priceUsd: over.priceUsd ?? D('120'),
    maxOccupancy: over.maxOccupancy ?? 2,
    isActive: true,
  });

  const baseDto = {
    roomId: 'room-1',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-04',
    guestsAdults: 2,
  };

  beforeEach(async () => {
    prisma = {
      hotel: { findFirst: jest.fn() },
      hotelRoom: { findFirst: jest.fn() },
    };
    commitBooking = {
      execute: jest
        .fn()
        .mockResolvedValue({ id: 'booking-1', reference: 'HTL-AB12CD' }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        BookHotelRoomUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: CommitBookingUseCase, useValue: commitBooking },
      ],
    }).compile();

    useCase = mod.get(BookHotelRoomUseCase);
  });

  it('per-night pricing: subtotal = priceUsd × nights, quantity = nights', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotelFactory());
    prisma.hotelRoom.findFirst.mockResolvedValue(roomFactory({ priceUsd: D('100') }));

    await useCase.execute(user, 'hotel-1', baseDto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.reference).toMatch(/^HTL-/);
    expect(input.metadata.method).toBe('single_resource');
    expect(input.metadata.singleResourceKind).toBe('hotel');
    // Oct 1 → Oct 4 = 3 nights
    expect(input.items[0].quantity).toBe(3);
    expect(input.totalPriceUsd.toString()).toBe('300');
  });

  it('throws BKNG_INVALID_DATE_RANGE when checkOutDate <= checkInDate (zero nights)', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotelFactory());
    prisma.hotelRoom.findFirst.mockResolvedValue(roomFactory());

    try {
      await useCase.execute(user, 'hotel-1', {
        ...baseDto,
        checkOutDate: baseDto.checkInDate,
      });
      fail('expected BadRequestException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(BadRequestException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_INVALID_DATE_RANGE);
    }
  });

  it('throws HTL_NOT_FOUND when hotel missing or unpublished', async () => {
    prisma.hotel.findFirst.mockResolvedValue(null);

    try {
      await useCase.execute(user, 'hotel-1', baseDto);
      fail('expected NotFoundException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(NotFoundException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.HTL_NOT_FOUND);
    }
  });

  it('throws HTL_ROOM_NOT_FOUND when room missing, inactive, or not part of hotel', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotelFactory());
    prisma.hotelRoom.findFirst.mockResolvedValue(null);

    try {
      await useCase.execute(user, 'hotel-1', baseDto);
      fail('expected NotFoundException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(NotFoundException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.HTL_ROOM_NOT_FOUND);
    }
  });

  it('throws BKNG_EXCEEDS_OCCUPANCY when total guests exceeds maxOccupancy', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotelFactory());
    prisma.hotelRoom.findFirst.mockResolvedValue(roomFactory({ maxOccupancy: 2 }));

    try {
      await useCase.execute(user, 'hotel-1', {
        ...baseDto,
        guestsAdults: 2,
        guestsChildren: 2,
      });
      fail('expected BadRequestException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(BadRequestException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_EXCEEDS_OCCUPANCY);
    }
  });

  it('snapshot captures hotel name, room type, occupancy, and per-night price', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotelFactory());
    prisma.hotelRoom.findFirst.mockResolvedValue(roomFactory({ maxOccupancy: 4 }));

    await useCase.execute(user, 'hotel-1', { ...baseDto, guestsChildren: 1 });

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.items[0].snapshot).toMatchObject({
      hotelId: 'hotel-1',
      hotelName: 'Indochine Hotel',
      roomId: 'room-1',
      roomType: 'deluxe',
      maxOccupancy: 4,
      guestsAdults: 2,
      guestsChildren: 1,
      nights: 3,
      pricePerNightUsd: 120,
    });
  });

  it('passes idempotencyKey to CommitBookingUseCase', async () => {
    prisma.hotel.findFirst.mockResolvedValue(hotelFactory());
    prisma.hotelRoom.findFirst.mockResolvedValue(roomFactory());

    await useCase.execute(user, 'hotel-1', baseDto, 'idem-htl-1');

    expect(commitBooking.execute).toHaveBeenCalledWith(
      user,
      expect.any(Object),
      'idem-htl-1',
    );
  });
});
