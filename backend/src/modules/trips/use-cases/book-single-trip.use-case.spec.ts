import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import { BookSingleTripUseCase } from './book-single-trip.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

const D = (n: string) => new Prisma.Decimal(n);

describe('BookSingleTripUseCase', () => {
  let useCase: BookSingleTripUseCase;
  let prisma: { trip: { findFirst: jest.Mock } };
  let commitBooking: { execute: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const futureStart = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const tripFactory = (
    over: Partial<{
      maxCapacity: number;
      durationDays: number;
      basePriceUsd: Prisma.Decimal;
    }> = {},
  ) => ({
    id: 'trip-1',
    category: 'temples',
    durationDays: over.durationDays ?? 3,
    basePriceUsd: over.basePriceUsd ?? D('99.50'),
    maxCapacity: over.maxCapacity ?? 10,
    coverImage: 'cover.jpg',
    images: [],
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    translations: [
      {
        title: 'Angkor 3-Day Tour',
        meetingPoint: 'Siem Reap Hotel',
        cancellationPolicy: 'Standard policy',
        includedItems: ['Guide', 'Lunch'],
        excludedItems: ['Hotel'],
      },
    ],
  });

  beforeEach(async () => {
    prisma = { trip: { findFirst: jest.fn() } };
    commitBooking = {
      execute: jest
        .fn()
        .mockResolvedValue({ id: 'booking-1', reference: 'TRP-AB12CD' }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        BookSingleTripUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: CommitBookingUseCase, useValue: commitBooking },
      ],
    }).compile();

    useCase = mod.get(BookSingleTripUseCase);
  });

  it('happy path delegates to CommitBookingUseCase with TRP- reference and trip kind', async () => {
    prisma.trip.findFirst.mockResolvedValue(tripFactory());

    await useCase.execute(user, 'trip-1', {
      startDate: futureStart,
      travelers: { adults: 2, children: 1 },
    });

    expect(commitBooking.execute).toHaveBeenCalledTimes(1);
    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.reference).toMatch(/^TRP-/);
    expect(input.metadata.method).toBe('single_resource');
    expect(input.metadata.singleResourceKind).toBe('trip');
    expect(input.items).toHaveLength(1);
    expect(input.items[0].type).toBe('trip_package');
    expect(input.items[0].resourceId).toBe('trip-1');
  });

  it('derives endDate from startDate + durationDays - 1', async () => {
    prisma.trip.findFirst.mockResolvedValue(tripFactory({ durationDays: 3 }));

    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 30);
    const startStr = start.toISOString().slice(0, 10);

    await useCase.execute(user, 'trip-1', {
      startDate: startStr,
      travelers: { adults: 1 },
    });

    const [, input] = commitBooking.execute.mock.calls[0];
    const expectedEnd = new Date(start);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 2);
    expect(input.items[0].endDate.toISOString().slice(0, 10)).toBe(
      expectedEnd.toISOString().slice(0, 10),
    );
  });

  it('per-person pricing: subtotal = basePriceUsd * (adults + children)', async () => {
    prisma.trip.findFirst.mockResolvedValue(
      tripFactory({ basePriceUsd: D('100') }),
    );

    await useCase.execute(user, 'trip-1', {
      startDate: futureStart,
      travelers: { adults: 2, children: 3 },
    });

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.totalPriceUsd.toString()).toBe('500');
    expect(input.items[0].quantity).toBe(5);
  });

  it('throws TRIP_NOT_FOUND when trip is unpublished or missing', async () => {
    prisma.trip.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(user, 'trip-1', {
        startDate: futureStart,
        travelers: { adults: 1 },
      }),
    ).rejects.toThrow(NotFoundException);

    prisma.trip.findFirst.mockResolvedValue(null);
    try {
      await useCase.execute(user, 'trip-1', {
        startDate: futureStart,
        travelers: { adults: 1 },
      });
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.TRIP_NOT_FOUND);
    }
  });

  it('throws BKNG_EXCEEDS_GUESTS when total travelers exceeds maxCapacity', async () => {
    prisma.trip.findFirst.mockResolvedValue(tripFactory({ maxCapacity: 4 }));

    try {
      await useCase.execute(user, 'trip-1', {
        startDate: futureStart,
        travelers: { adults: 3, children: 3 },
      });
      fail('expected BadRequestException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(BadRequestException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_EXCEEDS_GUESTS);
    }
  });

  it('throws BKNG_INVALID_DATE_RANGE when startDate is in the past', async () => {
    prisma.trip.findFirst.mockResolvedValue(tripFactory());

    try {
      await useCase.execute(user, 'trip-1', {
        startDate: '2020-01-01',
        travelers: { adults: 1 },
      });
      fail('expected BadRequestException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(BadRequestException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_INVALID_DATE_RANGE);
    }
  });

  it('passes through idempotencyKey to CommitBookingUseCase', async () => {
    prisma.trip.findFirst.mockResolvedValue(tripFactory());

    await useCase.execute(
      user,
      'trip-1',
      { startDate: futureStart, travelers: { adults: 1 } },
      'idem-key-1',
    );

    expect(commitBooking.execute).toHaveBeenCalledWith(
      user,
      expect.any(Object),
      'idem-key-1',
    );
  });
});
