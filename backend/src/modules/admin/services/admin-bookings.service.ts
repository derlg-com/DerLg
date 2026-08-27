import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  AssignmentStatus,
  BookingType,
  AuditEventType,
  BookingStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingDetailResponseDto } from '../dto/booking-detail-response.dto';

@Injectable()
export class AdminBookingsService {
  private readonly logger = new Logger(AdminBookingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllBookings(filters: {
    bookingType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { bookingType, status, startDate, endDate, search, page, limit } =
      filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.BookingWhereInput = {
      // Soft-deleted bookings must never appear in an admin list.
      deletedAt: null,
    };

    if (status) {
      if (!(Object.values(BookingStatus) as string[]).includes(status)) {
        throw new BadRequestException(
          `Invalid status. Expected one of: ${Object.values(BookingStatus).join(', ')}`,
        );
      }
      where.status = status as BookingStatus;
    }

    // `bookingType` was accepted and then dropped on the floor — destructured
    // from the query and never applied — so filtering the booking list by type
    // silently returned everything. It filters on the line items, since the type
    // lives on booking_items rather than the booking.
    if (bookingType) {
      if (!(Object.values(BookingType) as string[]).includes(bookingType)) {
        throw new BadRequestException(
          `Invalid bookingType. Expected one of: ${Object.values(BookingType).join(', ')}`,
        );
      }
      where.items = { some: { bookingType: bookingType as BookingType } };
    }

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            fullName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
            },
          },
          payments: {
            select: {
              id: true,
              amountUsd: true,
              status: true,
              refundedAmountUsd: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getBookingById(id: string): Promise<BookingDetailResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
        payments: {
          select: {
            id: true,
            amountUsd: true,
            status: true,
            refundedAmountUsd: true,
            paidAt: true,
          },
        },
        items: {
          select: {
            id: true,
            bookingType: true,
            tripId: true,
            hotelRoomId: true,
            vehicleId: true,
            guideId: true,
            // `date` became a startDate/endDate interval in the
            // merge_booking_methods migration.
            startDate: true,
            endDate: true,
            quantity: true,
            unitPriceUsd: true,
            subtotalUsd: true,
            // Frozen resource state at booking time — carries the cancellation
            // policy and resource names the admin needs when handling disputes.
            snapshot: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    const driverAssignment = await this.prisma.driverAssignment.findFirst({
      where: { bookingId: id },
      select: {
        id: true,
        driverId: true,
        vehicleId: true,
        status: true,
        assignmentTimestamp: true,
      },
    });

    return {
      id: booking.id,
      userId: booking.userId,
      reference: booking.reference,
      startDate: booking.startDate,
      endDate: booking.endDate,
      status: booking.status,
      expiresAt: booking.expiresAt,
      subtotalUsd: Number(booking.subtotalUsd),
      discountUsd: Number(booking.discountUsd),
      loyaltyDiscountUsd: Number(booking.loyaltyDiscountUsd),
      totalUsd: Number(booking.totalUsd),
      cancelledAt: booking.cancelledAt,
      cancelReason: booking.cancelReason,
      refundPercentage: booking.refundPercentage,
      passengerCount: booking.passengerCount,
      roomCount: booking.roomCount,
      // Booking-method fields added by add_booking_method_and_snapshot /
      // merge_booking_methods; the standalone admin schema predated all three.
      method: booking.method,
      singleResourceKind: booking.singleResourceKind,
      tripTemplateId: booking.tripTemplateId,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      user: booking.user,
      payments: booking.payments.map((p) => ({
        id: p.id,
        amountUsd: Number(p.amountUsd),
        status: p.status,
        refundedAmountUsd: Number(p.refundedAmountUsd),
        paidAt: p.paidAt,
      })),
      items: booking.items.map((bi) => ({
        id: bi.id,
        bookingType: bi.bookingType,
        tripId: bi.tripId,
        hotelRoomId: bi.hotelRoomId,
        vehicleId: bi.vehicleId,
        guideId: bi.guideId,
        startDate: bi.startDate,
        endDate: bi.endDate,
        quantity: bi.quantity,
        unitPriceUsd: Number(bi.unitPriceUsd),
        subtotalUsd: Number(bi.subtotalUsd),
        snapshot: bi.snapshot,
      })),
      driverAssignment,
    };
  }

  async updateBooking(
    id: string,
    dto: {
      startDate?: string;
      endDate?: string;
      passengerCount?: number;
      roomCount?: number;
      status?: BookingStatus;
      cancelReason?: string;
    },
  ) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    if (existing.status === BookingStatus.cancelled) {
      throw new ConflictException('Cannot modify a cancelled booking');
    }

    const data: Prisma.BookingUpdateInput = {};
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined)
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.passengerCount !== undefined)
      data.passengerCount = dto.passengerCount;
    if (dto.roomCount !== undefined) data.roomCount = dto.roomCount;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.cancelReason !== undefined) data.cancelReason = dto.cancelReason;

    return this.prisma.booking.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async cancelBooking(id: string, cancelReason?: string) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    if (existing.status === BookingStatus.cancelled) {
      throw new ConflictException('Booking is already cancelled');
    }

    if (existing.status === BookingStatus.completed) {
      throw new ConflictException('Cannot cancel a completed booking');
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        cancelReason: cancelReason || existing.cancelReason,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Cancel any pending driver assignments for this booking
    await this.prisma.driverAssignment.updateMany({
      where: {
        bookingId: id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      data: {
        status: AssignmentStatus.CANCELLED,
      },
    });

    return booking;
  }

  async getUnassignedBookings(filters: { page?: string; limit?: string }) {
    const { page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const assignedBookingIds = await this.prisma.driverAssignment
      .findMany({
        where: {
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { bookingId: true },
      })
      .then((assignments) => assignments.map((a) => a.bookingId));

    const where: Prisma.BookingWhereInput = {
      id: { notIn: assignedBookingIds },
      // `reserved` no longer exists: merge_booking_methods split it into `hold`
      // (awaiting payment) and `pending_payment` (PaymentIntent created). Both
      // still need a driver, as does an already-confirmed booking.
      status: {
        in: [
          BookingStatus.hold,
          BookingStatus.pending_payment,
          BookingStatus.confirmed,
        ],
      },
      // Soft-deleted bookings must never appear in an operational work queue.
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          items: {
            select: {
              id: true,
              bookingType: true,
              vehicleId: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log creation failed: ${(error as Error).message}`,
      );
    }
  }
}
