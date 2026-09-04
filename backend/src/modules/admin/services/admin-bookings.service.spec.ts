import { AdminBookingsService } from './admin-bookings.service';

/**
 * Bookings carried the heaviest drift. Three things changed underneath the
 * standalone admin service:
 *
 *  - `bookings.deleted_at` arrived (soft delete). Queries that ignore it show
 *    deleted bookings in operational lists.
 *  - `booking_status.reserved` was split into `hold` and `pending_payment`.
 *    Filtering on `reserved` now matches nothing.
 *  - `booking_items.date` became a `startDate`/`endDate` interval, plus a
 *    required `snapshot` holding the price and cancellation policy as agreed.
 */
describe('AdminBookingsService', () => {
  let service: AdminBookingsService;
  let prisma: {
    booking: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
    driverAssignment: { findMany: jest.Mock; findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      driverAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new AdminBookingsService(prisma as never);
  });

  describe('getUnassignedBookings', () => {
    const where = async () => {
      await service.getUnassignedBookings({});
      return prisma.booking.findMany.mock.calls[0][0].where as {
        status: { in: string[] };
        deletedAt: Date | null;
      };
    };

    it('should exclude soft-deleted bookings', async () => {
      // Without this a cancelled-and-deleted booking still appears in the queue
      // of work needing a driver.
      expect((await where()).deletedAt).toBeNull();
    });

    it('should look for hold and pending_payment, not the removed reserved status', async () => {
      const statuses = (await where()).status.in;

      expect(statuses).toEqual(
        expect.arrayContaining(['hold', 'pending_payment', 'confirmed']),
      );
      expect(statuses).not.toContain('reserved');
    });

    it('should skip bookings that already have a live assignment', async () => {
      prisma.driverAssignment.findMany.mockResolvedValue([
        { bookingId: 'bk-taken' },
      ]);

      await service.getUnassignedBookings({});

      expect(prisma.booking.findMany.mock.calls[0][0].where.id).toEqual({
        notIn: ['bk-taken'],
      });
      // Only PENDING/ACCEPTED count as live; a rejected offer frees the booking.
      expect(
        prisma.driverAssignment.findMany.mock.calls[0][0].where.status,
      ).toEqual({ in: ['PENDING', 'ACCEPTED'] });
    });

    it('should clamp limit to 100', async () => {
      await service.getUnassignedBookings({ limit: '9999' });
      expect(prisma.booking.findMany.mock.calls[0][0].take).toBe(100);
    });
  });

  describe('getBookingById', () => {
    const BOOKING = {
      id: 'bk-1',
      userId: 'u-1',
      reference: 'ADM-HOTEL-1',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-14'),
      status: 'confirmed',
      expiresAt: new Date('2026-09-01'),
      subtotalUsd: 300,
      discountUsd: 0,
      loyaltyDiscountUsd: 0,
      totalUsd: 300,
      cancelledAt: null,
      cancelReason: null,
      refundPercentage: null,
      passengerCount: 2,
      roomCount: 1,
      method: 'single_resource',
      singleResourceKind: 'hotel',
      tripTemplateId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: 'u-1', email: 'a@b.c', fullName: 'A B', phone: null },
      payments: [],
      items: [
        {
          id: 'item-1',
          bookingType: 'hotel_room',
          tripId: null,
          hotelRoomId: 'room-1',
          vehicleId: null,
          guideId: null,
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-14'),
          quantity: 4,
          unitPriceUsd: 75,
          subtotalUsd: 300,
          snapshot: { cancellationPolicy: '100% refund if 7+ days' },
        },
      ],
    };

    it('should 404 for an unknown booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.getBookingById('nope')).rejects.toThrow(/not found/);
    });

    it('should expose per-item date ranges instead of a single date', async () => {
      prisma.booking.findUnique.mockResolvedValue(BOOKING);

      const result = await service.getBookingById('bk-1');
      const item = result.items?.[0];

      expect(item?.startDate).toEqual(new Date('2026-09-10'));
      expect(item?.endDate).toEqual(new Date('2026-09-14'));
      expect(item).not.toHaveProperty('date');
    });

    it('should surface the frozen snapshot so disputes can be settled', async () => {
      prisma.booking.findUnique.mockResolvedValue(BOOKING);

      const result = await service.getBookingById('bk-1');
      expect(result.items?.[0].snapshot).toEqual({
        cancellationPolicy: '100% refund if 7+ days',
      });
    });

    it('should surface the booking method fields the old schema lacked', async () => {
      prisma.booking.findUnique.mockResolvedValue(BOOKING);

      const result = await service.getBookingById('bk-1');
      expect(result.method).toBe('single_resource');
      expect(result.singleResourceKind).toBe('hotel');
      expect(result.tripTemplateId).toBeNull();
    });

    it('should convert Decimal money columns to numbers', async () => {
      prisma.booking.findUnique.mockResolvedValue(BOOKING);

      const result = await service.getBookingById('bk-1');
      expect(typeof result.totalUsd).toBe('number');
      expect(typeof result.items?.[0].unitPriceUsd).toBe('number');
    });
  });
});
