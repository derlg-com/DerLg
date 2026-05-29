import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, BookingType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import {
  SetHoldUtil,
  IdempotencyUtil,
  CheckRoomAvailabilityUtil,
  checkOverlap,
  mapBookingDetail,
} from '../utils';
import type { CommitInput } from '../interfaces';
import type { BookingDetail, BookingCreatedEvent } from '../interfaces';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * Atomic write boundary for every booking creation flow (M1-M4).
 *
 * Future M4 sub-method use cases (BookGuide / BookHotelRoom /
 * BookTransportation / BookSingleTrip) and Phase 5b configuration-driven
 * flows (M1/M2/M3) build a CommitInput and delegate here. This is the
 * ONLY writer to the Booking + BookingItem tables.
 *
 * Steps (in order):
 *   1. Idempotency lookup — return cached body on retry.
 *   2. Validate input shape (non-empty items, sane intervals).
 *   3. Atomic transaction:
 *      a. Per-item availability check (per-night counter for hotels,
 *         interval-overlap for everything else).
 *      b. Booking + BookingItem insert.
 *   4. Set Redis hold key (TTL 900s default).
 *   5. Emit booking.created event (Phase 8 listeners consume).
 *   6. Cache idempotency result (24h).
 */
@Injectable()
export class CommitBookingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly setHold: SetHoldUtil,
    private readonly idempotency: IdempotencyUtil,
    private readonly checkRoom: CheckRoomAvailabilityUtil,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    user: JwtPayload,
    input: CommitInput,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    if (idempotencyKey) {
      const cached = await this.idempotency.lookup<BookingDetail>(
        user.sub,
        idempotencyKey,
      );
      if (cached) return cached.response;
    }

    if (input.items.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_INVALID_DATE_RANGE,
        message: 'CommitInput.items cannot be empty',
      });
    }
    for (const item of input.items) {
      if (item.endDate < item.startDate) {
        throw new BadRequestException({
          code: ErrorCode.BKNG_INVALID_DATE_RANGE,
          message: `Item ${item.type}/${item.resourceId} has endDate < startDate`,
        });
      }
    }

    const created = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        for (const item of input.items) {
          if (item.type === BookingType.hotel_room) {
            // Current schema treats each HotelRoom row as a single physical
            // room (no `totalRooms` inventory column yet). The per-night
            // counter with totalRooms=1 correctly enforces "no overlapping
            // booking on the same room" for any subset of nights in range.
            // When pooled-room inventory lands, replace `1` with
            // `room.totalRooms` from a findFirst lookup.
            const ok = await this.checkRoom.isAvailable(tx, {
              hotelRoomId: item.resourceId,
              totalRooms: 1,
              checkInDate: item.startDate,
              checkOutDate: item.endDate,
            });
            if (!ok) {
              throw new ConflictException({
                code: ErrorCode.BKNG_UNAVAILABLE,
                message:
                  'Room is fully booked for at least one requested night',
              });
            }
          } else {
            const conflicts = await tx.bookingItem.findMany({
              where: {
                [resourceFkColumn(item.type)]: item.resourceId,
                bookingType: item.type,
                booking: {
                  status: { in: ['hold', 'pending_payment', 'confirmed'] },
                  deletedAt: null,
                },
              },
              select: { startDate: true, endDate: true },
            });
            if (
              checkOverlap(conflicts, {
                startDate: item.startDate,
                endDate: item.endDate,
              })
            ) {
              throw new ConflictException({
                code: ErrorCode.BKNG_UNAVAILABLE,
                message: `Resource ${item.resourceId} is unavailable for the requested dates`,
              });
            }
          }
        }

        const earliestStart = input.items
          .map((i) => i.startDate)
          .reduce((a, b) => (a < b ? a : b));
        const latestEnd = input.items
          .map((i) => i.endDate)
          .reduce((a, b) => (a > b ? a : b));

        const ttlMs = 15 * 60 * 1000;

        return tx.booking.create({
          data: {
            userId: user.sub,
            reference: input.reference,
            method: input.metadata.method,
            singleResourceKind: input.metadata.singleResourceKind ?? null,
            tripTemplateId: input.metadata.tripTemplateId ?? null,
            status: 'hold',
            startDate: earliestStart,
            endDate: latestEnd,
            subtotalUsd: input.totalPriceUsd,
            totalUsd: input.totalPriceUsd,
            expiresAt: new Date(Date.now() + ttlMs),
            items: {
              create: input.items.map((i) => ({
                bookingType: i.type,
                [resourceFkColumn(i.type)]: i.resourceId,
                startDate: i.startDate,
                endDate: i.endDate,
                quantity: i.quantity,
                unitPriceUsd: i.unitPriceUsd,
                subtotalUsd: i.subtotalUsd,
                snapshot: i.snapshot,
              })),
            },
          },
          include: { items: true },
        });
      },
    );

    await this.setHold.set(created.id);

    const mapped = mapBookingDetail(created) as BookingDetail;

    const payload: BookingCreatedEvent = {
      bookingId: created.id,
      userId: created.userId,
      method: created.method,
      singleResourceKind: created.singleResourceKind,
      tripTemplateId: created.tripTemplateId,
      reference: created.reference,
      totalUsd: created.totalUsd.toNumber(),
      startDate: created.startDate.toISOString().slice(0, 10),
      endDate: created.endDate?.toISOString().slice(0, 10) ?? null,
      status: 'hold',
      createdAt: created.createdAt.toISOString(),
    };
    this.events.emit('booking.created', payload);

    if (idempotencyKey) {
      await this.idempotency.store(
        user.sub,
        idempotencyKey,
        created.id,
        mapped,
      );
    }

    return mapped;
  }
}

function resourceFkColumn(
  type: BookingType,
): 'tripId' | 'hotelRoomId' | 'vehicleId' | 'guideId' {
  switch (type) {
    case BookingType.trip_package:
      return 'tripId';
    case BookingType.hotel_room:
      return 'hotelRoomId';
    case BookingType.transportation:
      return 'vehicleId';
    case BookingType.tour_guide:
      return 'guideId';
  }
}
