import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import { BookTransportationUseCase } from './book-transportation.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

const D = (n: string) => new Prisma.Decimal(n);

describe('BookTransportationUseCase', () => {
  let useCase: BookTransportationUseCase;
  let prisma: { transportationVehicle: { findFirst: jest.Mock } };
  let commitBooking: { execute: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const vehicleFactory = (
    over: Partial<{
      pricingModel: 'per_day' | 'per_km';
      priceUsd: Prisma.Decimal;
      isActive: boolean;
    }> = {},
  ) => ({
    id: 'vehicle-1',
    name: 'Tuk-tuk Express',
    vehicleType: 'tuk_tuk',
    capacity: 4,
    priceUsd: over.priceUsd ?? D('40'),
    pricingModel: over.pricingModel ?? 'per_day',
    isActive: over.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const baseDto = {
    vehicleId: 'vehicle-1',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    pickupLocation: 'Siem Reap Airport',
    dropoffLocation: 'Hotel Indochine',
  };

  beforeEach(async () => {
    prisma = { transportationVehicle: { findFirst: jest.fn() } };
    commitBooking = {
      execute: jest
        .fn()
        .mockResolvedValue({ id: 'booking-1', reference: 'TRN-AB12CD' }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        BookTransportationUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: CommitBookingUseCase, useValue: commitBooking },
      ],
    }).compile();

    useCase = mod.get(BookTransportationUseCase);
  });

  it('per-day pricing: subtotal = priceUsd × days', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue(
      vehicleFactory({ pricingModel: 'per_day', priceUsd: D('40') }),
    );

    await useCase.execute(user, baseDto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.reference).toMatch(/^TRN-/);
    expect(input.metadata.method).toBe('single_resource');
    expect(input.metadata.singleResourceKind).toBe('transportation');
    // Oct 1 → Oct 3 = 2 days
    expect(input.items[0].quantity).toBe(2);
    expect(input.totalPriceUsd.toString()).toBe('80');
  });

  it('per-km pricing: subtotal = priceUsd × estimatedDistanceKm, quantity = km', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue(
      vehicleFactory({ pricingModel: 'per_km', priceUsd: D('0.5') }),
    );

    await useCase.execute(user, { ...baseDto, estimatedDistanceKm: 60 });

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.items[0].quantity).toBe(60);
    expect(input.totalPriceUsd.toString()).toBe('30');
  });

  it('throws TRNS_PRICING_REQUIRES_DISTANCE when per-km vehicle has no distance', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue(
      vehicleFactory({ pricingModel: 'per_km' }),
    );

    try {
      await useCase.execute(user, baseDto);
      fail('expected BadRequestException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(BadRequestException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.TRNS_PRICING_REQUIRES_DISTANCE);
    }
  });

  it('throws TRNS_NOT_FOUND when vehicle missing or inactive', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue(null);

    try {
      await useCase.execute(user, baseDto);
      fail('expected NotFoundException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(NotFoundException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.TRNS_NOT_FOUND);
    }
  });

  it('throws BKNG_INVALID_DATE_RANGE when endDate < startDate', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue(vehicleFactory());

    try {
      await useCase.execute(user, {
        ...baseDto,
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

  it('throws TRNS_PRICING_MISCONFIGURED for unknown pricing model', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue({
      ...vehicleFactory(),
      pricingModel: 'unknown' as 'per_day',
    });

    try {
      await useCase.execute(user, baseDto);
      fail('expected InternalServerErrorException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(InternalServerErrorException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.TRNS_PRICING_MISCONFIGURED);
    }
  });

  it('snapshot includes pickup, dropoff, stops, and distance fields', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue(vehicleFactory());

    await useCase.execute(user, {
      ...baseDto,
      stops: ['Banteay Srei', 'Pre Rup'],
    });

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.items[0].snapshot).toMatchObject({
      pickupLocation: baseDto.pickupLocation,
      dropoffLocation: baseDto.dropoffLocation,
      stops: ['Banteay Srei', 'Pre Rup'],
      estimatedDistanceKm: null,
    });
  });

  it('passes idempotencyKey to CommitBookingUseCase', async () => {
    prisma.transportationVehicle.findFirst.mockResolvedValue(vehicleFactory());

    await useCase.execute(user, baseDto, 'idem-trn-1');

    expect(commitBooking.execute).toHaveBeenCalledWith(
      user,
      expect.any(Object),
      'idem-trn-1',
    );
  });
});
