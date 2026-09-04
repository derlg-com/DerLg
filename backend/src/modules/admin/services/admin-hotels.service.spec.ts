import { NotFoundException } from '@nestjs/common';

import { AdminHotelsService } from './admin-hotels.service';

/**
 * Room availability was the single most consequential drift fix in the merge.
 *
 * The standalone service matched `booking_items.date` inside the requested
 * window. That column was replaced by a `startDate`/`endDate` pair, and the old
 * logic was wrong for ranges even before the rename: a room booked 10th–14th did
 * not surface when someone asked about the 12th, because no stored date fell in
 * the window. For a hotel-booking product that is a double-booking generator.
 *
 * These tests pin the corrected predicate — two closed intervals overlap when
 * each begins on or before the other ends — and the statuses that release a room.
 */
describe('AdminHotelsService', () => {
  let service: AdminHotelsService;
  let prisma: {
    hotelRoom: { findUnique: jest.Mock };
    bookingItem: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const ROOM = {
    id: 'room-1',
    roomType: 'Deluxe King',
    isActive: true,
    hotel: { translations: [{ name: 'Angkor Grand' }] },
  };

  beforeEach(() => {
    prisma = {
      hotelRoom: { findUnique: jest.fn().mockResolvedValue(ROOM) },
      bookingItem: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new AdminHotelsService(prisma as never);
  });

  it('should 404 for a room that does not exist', async () => {
    prisma.hotelRoom.findUnique.mockResolvedValue(null);

    await expect(
      service.getRoomAvailability('missing', '2026-09-01', '2026-09-05'),
    ).rejects.toThrow(NotFoundException);
  });

  describe('overlap predicate', () => {
    /** The where-clause the service handed to Prisma. */
    const capturedWhere = () =>
      prisma.bookingItem.findMany.mock.calls[0][0].where as Record<
        string,
        { lte?: Date; gte?: Date }
      >;

    it('should query on interval overlap, not on a single date', async () => {
      await service.getRoomAvailability('room-1', '2026-09-10', '2026-09-14');

      const where = capturedWhere();
      // The corrected predicate: item.startDate <= requestedEnd
      //                      AND item.endDate   >= requestedStart
      expect(where.startDate).toEqual({ lte: new Date('2026-09-14') });
      expect(where.endDate).toEqual({ gte: new Date('2026-09-10') });
      // The removed column must not appear at all.
      expect(where).not.toHaveProperty('date');
    });

    it('should exclude soft-deleted bookings', async () => {
      await service.getRoomAvailability('room-1', '2026-09-10', '2026-09-14');

      const booking = prisma.bookingItem.findMany.mock.calls[0][0].where
        .booking as Record<string, unknown>;
      expect(booking.deletedAt).toBeNull();
    });

    it('should treat cancelled, expired, failed and no-show bookings as releasing the room', async () => {
      await service.getRoomAvailability('room-1', '2026-09-10', '2026-09-14');

      const booking = prisma.bookingItem.findMany.mock.calls[0][0].where
        .booking as { status: { notIn: string[] } };
      expect(booking.status.notIn).toEqual(
        expect.arrayContaining([
          'cancelled',
          'expired',
          'payment_failed',
          'no_show',
        ]),
      );
    });
  });

  describe('conflict reporting', () => {
    const conflict = (startDate: string, endDate: string) => ({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      quantity: 1,
      booking: { id: 'bk-1', reference: 'ADM-HOTEL-1', status: 'confirmed' },
    });

    it('should report available when nothing overlaps', async () => {
      prisma.bookingItem.findMany.mockResolvedValue([]);

      const result = await service.getRoomAvailability(
        'room-1',
        '2026-09-01',
        '2026-09-05',
      );

      expect(result.isAvailable).toBe(true);
      expect(result.totalConflicts).toBe(0);
      expect(result.bookedRanges).toEqual([]);
      expect(result.hotelName).toBe('Angkor Grand');
    });

    // The case the old implementation got wrong: a mid-stay query.
    it('should report unavailable for a date inside an existing stay', async () => {
      prisma.bookingItem.findMany.mockResolvedValue([
        conflict('2026-09-10', '2026-09-14'),
      ]);

      const result = await service.getRoomAvailability(
        'room-1',
        '2026-09-12',
        '2026-09-12',
      );

      expect(result.isAvailable).toBe(false);
      expect(result.totalConflicts).toBe(1);
      expect(result.bookedRanges[0].reference).toBe('ADM-HOTEL-1');
    });

    it.each([
      ['exact match', '2026-09-10', '2026-09-14'],
      ['overlaps the front', '2026-09-08', '2026-09-11'],
      ['overlaps the back', '2026-09-13', '2026-09-16'],
      ['fully envelops', '2026-09-01', '2026-09-30'],
      ['fully enclosed', '2026-09-11', '2026-09-12'],
    ])(
      'should report unavailable when the request %s',
      async (_l, start, end) => {
        prisma.bookingItem.findMany.mockResolvedValue([
          conflict('2026-09-10', '2026-09-14'),
        ]);

        const result = await service.getRoomAvailability('room-1', start, end);
        expect(result.isAvailable).toBe(false);
      },
    );

    it('should report unavailable for an inactive room even with no conflicts', async () => {
      prisma.hotelRoom.findUnique.mockResolvedValue({
        ...ROOM,
        isActive: false,
      });
      prisma.bookingItem.findMany.mockResolvedValue([]);

      const result = await service.getRoomAvailability(
        'room-1',
        '2026-09-01',
        '2026-09-05',
      );

      expect(result.isAvailable).toBe(false);
      expect(result.isActive).toBe(false);
    });

    it('should echo the requested range back', async () => {
      const result = await service.getRoomAvailability(
        'room-1',
        '2026-09-01',
        '2026-09-05',
      );

      expect(result.requestedRange).toEqual({
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
      });
    });
  });

  describe('createAuditLog', () => {
    it('should not propagate a failure to the caller', async () => {
      // Losing an audit row must not turn a successful admin action into a 500.
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'HOTEL',
          entityId: 'hotel-1',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
