import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ReleaseHoldUtil } from '../utils';
import { CancelBookingUseCase } from './cancel-booking.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

const D = (n: string) => new Prisma.Decimal(n);

describe('CancelBookingUseCase', () => {
  let useCase: CancelBookingUseCase;
  let prisma: any;
  let release: { release: jest.Mock };
  let events: { emit: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const bookingFactory = (
    override: Partial<{
      status: BookingStatus;
      startDaysOut: number;
      total: string;
    }> = {},
  ) => {
    const status = override.status ?? BookingStatus.hold;
    const startDaysOut = override.startDaysOut ?? 10;
    const total = override.total ?? '120';
    const startDate = new Date(Date.now() + startDaysOut * 86_400_000);
    return {
      id: 'booking-1',
      userId: user.sub,
      reference: 'TRN-ABC123',
      status,
      startDate,
      endDate: startDate,
      totalUsd: D(total),
      subtotalUsd: D(total),
      discountUsd: D('0'),
      cancelledAt: null,
      refundPercentage: null,
      qrCodeUrl: null,
      method: 'single_resource',
      singleResourceKind: 'transportation',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      items: [],
    };
  };

  beforeEach(async () => {
    prisma = {
      booking: { findFirst: jest.fn(), update: jest.fn() },
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    release = { release: jest.fn() };
    events = { emit: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        CancelBookingUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: ReleaseHoldUtil, useValue: release },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    useCase = mod.get(CancelBookingUseCase);
  });

  it('100% refund tier when start is > 7 days out', async () => {
    const b = bookingFactory({ startDaysOut: 10, total: '100' });
    prisma.booking.findFirst.mockResolvedValue(b);
    prisma.booking.update.mockResolvedValue({
      ...b,
      status: BookingStatus.cancelled,
    });

    const result = await useCase.execute(user, 'booking-1', {});
    expect(result.refundPercentage).toBe(100);
    expect(result.refundAmountUsd).toBe(100);
    expect(release.release).toHaveBeenCalledWith('booking-1');
    expect(events.emit).toHaveBeenCalledWith(
      'booking.cancelled',
      expect.objectContaining({
        refundPercentage: 100,
        refundAmountUsd: 100,
      }),
    );
  });

  it('50% refund tier in 3-7 day window', async () => {
    const b = bookingFactory({ startDaysOut: 5, total: '200' });
    prisma.booking.findFirst.mockResolvedValue(b);
    prisma.booking.update.mockResolvedValue({
      ...b,
      status: BookingStatus.cancelled,
    });
    const result = await useCase.execute(user, 'booking-1', {});
    expect(result.refundPercentage).toBe(50);
    expect(result.refundAmountUsd).toBe(100);
  });

  it('0% refund inside 3 days', async () => {
    const b = bookingFactory({ startDaysOut: 1, total: '200' });
    prisma.booking.findFirst.mockResolvedValue(b);
    prisma.booking.update.mockResolvedValue({
      ...b,
      status: BookingStatus.cancelled,
    });
    const result = await useCase.execute(user, 'booking-1', {});
    expect(result.refundPercentage).toBe(0);
  });

  it('throws BKNG_ALREADY_CANCELLED if booking is already cancelled', async () => {
    prisma.booking.findFirst.mockResolvedValue(
      bookingFactory({ status: BookingStatus.cancelled }),
    );
    await expect(useCase.execute(user, 'booking-1', {})).rejects.toThrow(
      BadRequestException,
    );

    prisma.booking.findFirst.mockResolvedValue(
      bookingFactory({ status: BookingStatus.cancelled }),
    );
    try {
      await useCase.execute(user, 'booking-1', {});
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_ALREADY_CANCELLED);
    }
  });

  it('throws BKNG_PAYMENT_PENDING if a Payment row is still processing', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingFactory());
    prisma.payment.findFirst.mockResolvedValue({
      id: 'p-1',
      status: 'processing',
    });
    await expect(useCase.execute(user, 'booking-1', {})).rejects.toThrow(
      ConflictException,
    );

    prisma.booking.findFirst.mockResolvedValue(bookingFactory());
    prisma.payment.findFirst.mockResolvedValue({
      id: 'p-1',
      status: 'processing',
    });
    try {
      await useCase.execute(user, 'booking-1', {});
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_PAYMENT_PENDING);
    }
  });
});
