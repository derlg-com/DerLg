import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import { BookGuideUseCase } from './book-guide.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

const D = (n: string) => new Prisma.Decimal(n);

describe('BookGuideUseCase', () => {
  let useCase: BookGuideUseCase;
  let prisma: {
    guide: { findFirst: jest.Mock };
    booking: { findFirst: jest.Mock };
  };
  let commitBooking: { execute: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const guideFactory = (
    over: Partial<{ isActive: boolean; pricePerDayUsd: Prisma.Decimal }> = {},
  ) => ({
    id: 'guide-1',
    isActive: over.isActive ?? true,
    isVerified: true,
    province: 'Siem Reap',
    pricePerDayUsd: over.pricePerDayUsd ?? D('80'),
    languages: [{ language: 'en' }, { language: 'zh' }],
    specialities: [{ speciality: 'Angkor Wat historian' }],
  });

  const baseDto = {
    startDate: '2026-10-01',
    endDate: '2026-10-03',
  };

  beforeEach(async () => {
    prisma = {
      guide: { findFirst: jest.fn() },
      booking: { findFirst: jest.fn() },
    };
    commitBooking = {
      execute: jest
        .fn()
        .mockResolvedValue({ id: 'booking-1', reference: 'GDE-AB12CD' }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        BookGuideUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: CommitBookingUseCase, useValue: commitBooking },
      ],
    }).compile();

    useCase = mod.get(BookGuideUseCase);
  });

  it('per-day pricing: subtotal = pricePerDayUsd × days', async () => {
    prisma.guide.findFirst.mockResolvedValue(
      guideFactory({ pricePerDayUsd: D('80') }),
    );

    await useCase.execute(user, 'guide-1', baseDto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.reference).toMatch(/^GDE-/);
    expect(input.metadata.method).toBe('single_resource');
    expect(input.metadata.singleResourceKind).toBe('guide');
    // Oct 1 → Oct 3 = 2 days
    expect(input.items[0].quantity).toBe(2);
    expect(input.totalPriceUsd.toString()).toBe('160');
  });

  it('throws GDE_NOT_FOUND when guide missing', async () => {
    prisma.guide.findFirst.mockResolvedValue(null);

    try {
      await useCase.execute(user, 'guide-1', baseDto);
      fail('expected NotFoundException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(NotFoundException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.GDE_NOT_FOUND);
    }
  });

  it('throws GDE_INACTIVE when guide is not active', async () => {
    prisma.guide.findFirst.mockResolvedValue(guideFactory({ isActive: false }));

    try {
      await useCase.execute(user, 'guide-1', baseDto);
      fail('expected ForbiddenException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ForbiddenException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.GDE_INACTIVE);
    }
  });

  it('throws BKNG_INVALID_DATE_RANGE when endDate < startDate', async () => {
    prisma.guide.findFirst.mockResolvedValue(guideFactory());

    try {
      await useCase.execute(user, 'guide-1', {
        startDate: '2026-10-03',
        endDate: '2026-10-01',
      });
      fail('expected BadRequestException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(BadRequestException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_INVALID_DATE_RANGE);
    }
  });

  it('snapshot captures languages, specialities, province, and verification', async () => {
    prisma.guide.findFirst.mockResolvedValue(guideFactory());

    await useCase.execute(user, 'guide-1', baseDto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.items[0].snapshot).toMatchObject({
      guideId: 'guide-1',
      languages: ['en', 'zh'],
      specialities: ['Angkor Wat historian'],
      province: 'Siem Reap',
      isVerified: true,
      pricePerDayUsd: 80,
      days: 2,
      linkedTripBookingId: null,
    });
  });

  describe('linkedTripBookingId validation', () => {
    it('happy path: linked trip booking owned by user, active, dates within trip range', async () => {
      prisma.guide.findFirst.mockResolvedValue(guideFactory());
      prisma.booking.findFirst.mockResolvedValue({
        id: 'trip-booking-1',
        userId: user.sub,
        method: 'single_resource',
        singleResourceKind: 'trip',
        items: [
          {
            startDate: new Date('2026-09-30'),
            endDate: new Date('2026-10-05'),
          },
        ],
      });

      await useCase.execute(user, 'guide-1', {
        ...baseDto,
        linkedTripBookingId: 'trip-booking-1',
      });

      const [, input] = commitBooking.execute.mock.calls[0];
      expect(input.items[0].snapshot).toMatchObject({
        linkedTripBookingId: 'trip-booking-1',
      });
    });

    it('throws GDE_INVALID_TRIP_LINK when linked booking not found / not owned', async () => {
      prisma.guide.findFirst.mockResolvedValue(guideFactory());
      prisma.booking.findFirst.mockResolvedValue(null);

      try {
        await useCase.execute(user, 'guide-1', {
          ...baseDto,
          linkedTripBookingId: 'trip-booking-X',
        });
        fail('expected BadRequestException');
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(BadRequestException);
        const err = e as { response: { code: string } };
        expect(err.response.code).toBe(ErrorCode.GDE_INVALID_TRIP_LINK);
      }
    });

    it('throws GDE_INVALID_TRIP_LINK when linked booking is not a trip', async () => {
      prisma.guide.findFirst.mockResolvedValue(guideFactory());
      prisma.booking.findFirst.mockResolvedValue({
        id: 'guide-booking-1',
        userId: user.sub,
        method: 'single_resource',
        singleResourceKind: 'transportation',
        items: [
          {
            startDate: new Date('2026-09-30'),
            endDate: new Date('2026-10-05'),
          },
        ],
      });

      try {
        await useCase.execute(user, 'guide-1', {
          ...baseDto,
          linkedTripBookingId: 'guide-booking-1',
        });
        fail('expected BadRequestException');
      } catch (e: unknown) {
        const err = e as { response: { code: string } };
        expect(err.response.code).toBe(ErrorCode.GDE_INVALID_TRIP_LINK);
      }
    });

    it('throws GDE_INVALID_TRIP_LINK when guide dates fall outside linked trip range', async () => {
      prisma.guide.findFirst.mockResolvedValue(guideFactory());
      prisma.booking.findFirst.mockResolvedValue({
        id: 'trip-booking-1',
        userId: user.sub,
        method: 'single_resource',
        singleResourceKind: 'trip',
        items: [
          {
            startDate: new Date('2026-10-05'),
            endDate: new Date('2026-10-08'),
          },
        ],
      });

      try {
        await useCase.execute(user, 'guide-1', {
          ...baseDto,
          linkedTripBookingId: 'trip-booking-1',
        });
        fail('expected BadRequestException');
      } catch (e: unknown) {
        const err = e as { response: { code: string } };
        expect(err.response.code).toBe(ErrorCode.GDE_INVALID_TRIP_LINK);
      }
    });
  });

  it('passes idempotencyKey to CommitBookingUseCase', async () => {
    prisma.guide.findFirst.mockResolvedValue(guideFactory());

    await useCase.execute(user, 'guide-1', baseDto, 'idem-gde-1');

    expect(commitBooking.execute).toHaveBeenCalledWith(
      user,
      expect.any(Object),
      'idem-gde-1',
    );
  });
});
