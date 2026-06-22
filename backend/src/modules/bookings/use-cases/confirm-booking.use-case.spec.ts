import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ReleaseHoldUtil } from '../utils';
import { ConfirmBookingUseCase } from './confirm-booking.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

const D = (n: string) => new Prisma.Decimal(n);

describe('ConfirmBookingUseCase', () => {
  let useCase: ConfirmBookingUseCase;
  let prisma: any;
  let config: { get: jest.Mock };
  let release: { release: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const bookingFactory = (status: BookingStatus = BookingStatus.hold) => ({
    id: 'booking-1',
    userId: user.sub,
    reference: 'TRP-ABC123',
    method: 'single_resource',
    singleResourceKind: 'trip',
    tripTemplateId: null,
    status,
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-03'),
    totalUsd: D('300'),
    subtotalUsd: D('300'),
    discountUsd: D('0'),
    expiresAt: new Date('2026-10-01T00:15:00Z'),
    cancelledAt: null,
    refundPercentage: null,
    qrCodeUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'item-1',
        bookingType: 'trip_package',
        tripId: 'trip-1',
        hotelRoomId: null,
        vehicleId: null,
        guideId: null,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-03'),
        quantity: 2,
        unitPriceUsd: D('150'),
        subtotalUsd: D('300'),
        snapshot: { name: 'Angkor Highlights', coverImageUrl: 'x.jpg' },
      },
    ],
  });

  beforeEach(async () => {
    const tx = {
      payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
      booking: {
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...bookingFactory(),
            status: data.status,
            qrCodeUrl: data.qrCodeUrl,
          }),
        ),
      },
    };
    prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(bookingFactory()) },
      _tx: tx,
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };
    config = { get: jest.fn().mockReturnValue(true) };
    release = { release: jest.fn().mockResolvedValue(undefined) };

    const mod = await Test.createTestingModule({
      providers: [
        ConfirmBookingUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: ReleaseHoldUtil, useValue: release },
      ],
    }).compile();

    useCase = mod.get(ConfirmBookingUseCase);
  });

  it('confirms a hold booking, records a succeeded payment, releases the hold', async () => {
    const result = await useCase.execute(user, 'booking-1', { method: 'card' });

    expect(result.status).toBe('CONFIRMED');
    expect(result.qrCodeUrl).toContain('DERLG-TICKET-TRP-ABC123');
    expect(prisma._tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          provider: 'stripe',
          status: 'succeeded',
        }),
      }),
    );
    expect(release.release).toHaveBeenCalledWith('booking-1');
  });

  it('records a bakong provider for QR methods', async () => {
    await useCase.execute(user, 'booking-1', { method: 'bakong_qr' });
    expect(prisma._tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'bakong' }),
      }),
    );
  });

  it('rejects when DEMO_PAYMENTS is disabled', async () => {
    config.get.mockReturnValue(false);
    await expect(
      useCase.execute(user, 'booking-1', {}),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a booking owned by another user', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...bookingFactory(),
      userId: 'someone-else',
    });
    try {
      await useCase.execute(user, 'booking-1', {});
      fail('expected ForbiddenException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ForbiddenException);
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_NOT_AUTHOR);
    }
  });

  it('is idempotent when the booking is already confirmed', async () => {
    prisma.booking.findFirst.mockResolvedValue(
      bookingFactory(BookingStatus.confirmed),
    );
    const result = await useCase.execute(user, 'booking-1', {});
    expect(result.status).toBe('CONFIRMED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
