import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Prisma,
  BookingMethod,
  SingleResourceKind,
  BookingType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import {
  SetHoldUtil,
  IdempotencyUtil,
  CheckRoomAvailabilityUtil,
} from '../utils';
import { CommitBookingUseCase } from './commit-booking.use-case';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import type { CommitInput } from '../interfaces';

const D = (n: string) => new Prisma.Decimal(n);

describe('CommitBookingUseCase', () => {
  let useCase: CommitBookingUseCase;
  let prisma: any;
  let setHold: { set: jest.Mock };
  let idem: { lookup: jest.Mock; store: jest.Mock };
  let events: { emit: jest.Mock };

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.c', role: 'user' };

  const baseInput: CommitInput = {
    reference: 'TRN-ABC123',
    totalPriceUsd: D('120'),
    items: [
      {
        type: BookingType.transportation,
        resourceId: 'vehicle-1',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-02'),
        quantity: 1,
        unitPriceUsd: D('120'),
        subtotalUsd: D('120'),
        snapshot: { vehicleId: 'vehicle-1' },
      },
    ],
    metadata: {
      method: BookingMethod.single_resource,
      singleResourceKind: SingleResourceKind.transportation,
    },
  };

  const createdBookingFactory = () => ({
    id: 'booking-1',
    userId: user.sub,
    reference: 'TRN-ABC123',
    method: BookingMethod.single_resource,
    singleResourceKind: SingleResourceKind.transportation,
    status: 'hold',
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-02'),
    totalUsd: D('120'),
    subtotalUsd: D('120'),
    discountUsd: D('0'),
    loyaltyDiscountUsd: D('0'),
    expiresAt: new Date('2026-10-01T00:15:00Z'),
    cancelledAt: null,
    cancelReason: null,
    refundPercentage: null,
    qrCodeUrl: null,
    passengerCount: 1,
    roomCount: 1,
    createdAt: new Date('2026-09-30T23:00:00Z'),
    updatedAt: new Date('2026-09-30T23:00:00Z'),
    deletedAt: null,
    items: [],
  });

  beforeEach(async () => {
    const tx = {
      bookingItem: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { create: jest.fn().mockResolvedValue(createdBookingFactory()) },
      hotelRoom: { findFirst: jest.fn().mockResolvedValue({ totalRooms: 1 }) },
    };
    const $transaction = jest
      .fn()
      .mockImplementation(async (cb: (tx: typeof tx) => Promise<unknown>) =>
        cb(tx),
      );

    prisma = { $transaction, _tx: tx };
    setHold = { set: jest.fn().mockResolvedValue(undefined) };
    idem = {
      lookup: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockResolvedValue(undefined),
    };
    events = { emit: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        CommitBookingUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: SetHoldUtil, useValue: setHold },
        { provide: IdempotencyUtil, useValue: idem },
        {
          provide: CheckRoomAvailabilityUtil,
          useValue: { isAvailable: jest.fn().mockResolvedValue(true) },
        },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    useCase = mod.get(CommitBookingUseCase);
  });

  it('writes the hold key after a successful commit', async () => {
    await useCase.execute(user, baseInput);
    expect(setHold.set).toHaveBeenCalledWith('booking-1');
  });

  it('emits booking.created with the spec payload', async () => {
    await useCase.execute(user, baseInput);
    expect(events.emit).toHaveBeenCalledWith(
      'booking.created',
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'user-1',
        method: BookingMethod.single_resource,
        singleResourceKind: SingleResourceKind.transportation,
        reference: 'TRN-ABC123',
        status: 'hold',
      }),
    );
  });

  it('throws 409 BKNG_UNAVAILABLE when overlap is detected', async () => {
    prisma._tx.bookingItem.findMany.mockResolvedValue([
      {
        id: 'existing-1',
        startDate: new Date('2026-09-30'),
        endDate: new Date('2026-10-03'),
      },
    ]);

    await expect(useCase.execute(user, baseInput)).rejects.toThrow(
      ConflictException,
    );

    prisma._tx.bookingItem.findMany.mockResolvedValue([
      {
        id: 'existing-1',
        startDate: new Date('2026-09-30'),
        endDate: new Date('2026-10-03'),
      },
    ]);
    try {
      await useCase.execute(user, baseInput);
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_UNAVAILABLE);
    }
  });

  it('returns the cached body and skips DB writes on idempotent retry', async () => {
    idem.lookup.mockResolvedValueOnce({
      bookingId: 'booking-1',
      response: { id: 'booking-1', reference: 'TRN-ABC123' },
    });
    const result = await useCase.execute(user, baseInput, 'idem-key-1');
    expect(result).toMatchObject({ id: 'booking-1', reference: 'TRN-ABC123' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(setHold.set).not.toHaveBeenCalled();
  });

  it('stores the idempotency entry on first call when key supplied', async () => {
    await useCase.execute(user, baseInput, 'idem-key-1');
    expect(idem.store).toHaveBeenCalledWith(
      'user-1',
      'idem-key-1',
      'booking-1',
      expect.any(Object),
    );
  });
});
