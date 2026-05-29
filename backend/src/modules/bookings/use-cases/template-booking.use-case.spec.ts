import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma, BookingType, BookingMethod } from '@prisma/client';
import { CommitBookingUseCase } from './commit-booking.use-case';
import { ErrorCode } from '../../../common/errors/error-codes';
import { TemplateBookingUseCase } from './template-booking.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import type { CreateTemplateBookingDto } from '../dto/create-template-booking.dto';

describe('TemplateBookingUseCase', () => {
  let useCase: TemplateBookingUseCase;
  let commitBooking: { execute: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const baseDto: CreateTemplateBookingDto = {
    items: [
      {
        type: BookingType.transportation,
        resourceId: 'vehicle-1',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        quantity: 1,
        unitPriceUsd: 80,
      },
      {
        type: BookingType.hotel_room,
        resourceId: 'room-1',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        quantity: 1,
        unitPriceUsd: 120,
      },
    ],
  };

  beforeEach(async () => {
    commitBooking = {
      execute: jest.fn().mockResolvedValue({
        id: 'booking-1',
        reference: 'CSM-AB12CD',
        items: [],
      }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        TemplateBookingUseCase,
        { provide: CommitBookingUseCase, useValue: commitBooking },
      ],
    }).compile();

    useCase = mod.get(TemplateBookingUseCase);
  });

  it('happy path delegates to CommitBookingUseCase with CSM- reference and custom_itinerary method', async () => {
    await useCase.execute(user, baseDto);

    expect(commitBooking.execute).toHaveBeenCalledTimes(1);
    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.reference).toMatch(/^CSM-/);
    expect(input.metadata.method).toBe(BookingMethod.custom_itinerary);
    expect(input.items).toHaveLength(2);
  });

  it('totalPriceUsd is the sum of item subtotals (Prisma.Decimal arithmetic)', async () => {
    await useCase.execute(user, baseDto);

    const [, input] = commitBooking.execute.mock.calls[0];
    // 1 × 80 + 1 × 120 = 200
    expect(input.totalPriceUsd.toString()).toBe('200');
  });

  it('item subtotals = unitPriceUsd × quantity', async () => {
    const dto: CreateTemplateBookingDto = {
      items: [
        {
          type: BookingType.tour_guide,
          resourceId: 'guide-1',
          startDate: '2026-10-01',
          endDate: '2026-10-01',
          quantity: 4,
          unitPriceUsd: 50,
        },
      ],
    };

    await useCase.execute(user, dto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.items[0].subtotalUsd.toString()).toBe('200');
    expect(input.items[0].quantity).toBe(4);
    expect(input.totalPriceUsd.toString()).toBe('200');
  });

  it('passes tripTemplateId through to metadata when provided', async () => {
    const dto = { ...baseDto, tripTemplateId: 'trip-template-uuid' };
    await useCase.execute(user, dto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.metadata.tripTemplateId).toBe('trip-template-uuid');
  });

  it('omits tripTemplateId from metadata when not provided (M3 build-from-scratch case)', async () => {
    await useCase.execute(user, baseDto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.metadata.tripTemplateId).toBeUndefined();
  });

  it('throws BadRequestException with BKNG_INVALID_DATE_RANGE when items[] is empty', async () => {
    const dto: CreateTemplateBookingDto = { items: [] };

    await expect(useCase.execute(user, dto)).rejects.toThrow(
      BadRequestException,
    );

    try {
      await useCase.execute(user, dto);
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_INVALID_DATE_RANGE);
    }
    expect(commitBooking.execute).not.toHaveBeenCalled();
  });

  it('passes idempotencyKey through to CommitBookingUseCase', async () => {
    await useCase.execute(user, baseDto, 'idem-key-1');

    expect(commitBooking.execute).toHaveBeenCalledWith(
      user,
      expect.any(Object),
      'idem-key-1',
    );
  });

  it('converts ISO date strings to Date objects on each item', async () => {
    await useCase.execute(user, baseDto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.items[0].startDate).toBeInstanceOf(Date);
    expect(input.items[0].endDate).toBeInstanceOf(Date);
    expect(input.items[0].startDate.toISOString().slice(0, 10)).toBe(
      '2026-10-01',
    );
    expect(input.items[0].endDate.toISOString().slice(0, 10)).toBe(
      '2026-10-02',
    );
  });

  it('preserves Prisma.Decimal precision for unit prices', async () => {
    const dto: CreateTemplateBookingDto = {
      items: [
        {
          type: BookingType.transportation,
          resourceId: 'vehicle-1',
          startDate: '2026-10-01',
          endDate: '2026-10-02',
          quantity: 3,
          unitPriceUsd: 99.99,
        },
      ],
    };

    await useCase.execute(user, dto);

    const [, input] = commitBooking.execute.mock.calls[0];
    expect(input.items[0].unitPriceUsd).toBeInstanceOf(Prisma.Decimal);
    expect(input.items[0].subtotalUsd.toString()).toBe('299.97');
  });
});
