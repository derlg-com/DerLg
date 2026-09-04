import { AdminBookingsService } from './admin-bookings.service';
import { AdminDriversService } from './admin-drivers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Filters that the admin UI has always sent and the API silently ignored.
 *
 * Each of these was a dropdown that appeared to work and changed nothing:
 * the param was never declared on the handler, so it was dropped before it
 * reached a `where` clause. The guide filter was the worst of them — the guide
 * detail page listed every booking in the system and attributed all of them to
 * the guide being viewed.
 */
describe('admin list filters', () => {
  describe('AdminBookingsService.getAllBookings', () => {
    let service: AdminBookingsService;
    let booking: { findMany: jest.Mock; count: jest.Mock };

    const whereFor = async (
      filters: Parameters<AdminBookingsService['getAllBookings']>[0],
    ) => {
      await service.getAllBookings(filters);
      return booking.findMany.mock.calls[0][0].where;
    };

    beforeEach(() => {
      booking = {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      };
      service = new AdminBookingsService({
        booking,
        driverAssignment: { findMany: jest.fn(), findFirst: jest.fn() },
        auditLog: { create: jest.fn() },
      } as unknown as PrismaService);
    });

    it('filters to bookings whose customer used the AI concierge', async () => {
      const where = await whereFor({ aiAssisted: true });

      expect(where.user).toEqual({ aiChatSessions: { some: {} } });
    });

    it('inverts the filter for manual bookings', async () => {
      const where = await whereFor({ aiAssisted: false });

      expect(where.user).toEqual({ NOT: { aiChatSessions: { some: {} } } });
    });

    it('applies no user constraint when the filter is absent', async () => {
      const where = await whereFor({});

      expect(where.user).toBeUndefined();
    });

    it('filters by guide through the booking line items', async () => {
      const where = await whereFor({ guideId: 'guide-1' });

      expect(where.AND).toEqual([{ items: { some: { guideId: 'guide-1' } } }]);
    });

    it('keeps the booking-type filter when a guide filter is also applied', async () => {
      // Assigning `where.items` twice would silently drop the type filter; the
      // guide predicate is added under AND for exactly this reason.
      const where = await whereFor({
        guideId: 'guide-1',
        bookingType: 'transportation',
      });

      expect(where.items).toEqual({
        some: { bookingType: 'transportation' },
      });
      expect(where.AND).toEqual([{ items: { some: { guideId: 'guide-1' } } }]);
    });

    it('still excludes soft-deleted bookings alongside the new filters', async () => {
      const where = await whereFor({ aiAssisted: true, guideId: 'g1' });

      expect(where.deletedAt).toBeNull();
    });
  });

  describe('AdminDriversService.getAllDrivers', () => {
    let service: AdminDriversService;
    let driver: { findMany: jest.Mock; count: jest.Mock };

    const whereFor = async (
      filters: Parameters<AdminDriversService['getAllDrivers']>[0],
    ) => {
      await service.getAllDrivers(filters);
      return driver.findMany.mock.calls[0][0].where;
    };

    beforeEach(() => {
      driver = {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      };
      service = new AdminDriversService(
        { driver } as unknown as PrismaService,
        {
          getClient: () => ({ publish: jest.fn() }),
        } as unknown as RedisService,
      );
    });

    it('filters to drivers who linked a Telegram account', async () => {
      const where = await whereFor({ hasTelegram: true });

      expect(where.telegramId).toEqual({ not: null });
    });

    it('filters to drivers who have not linked one', async () => {
      const where = await whereFor({ hasTelegram: false });

      expect(where.telegramId).toBeNull();
    });

    it('does not constrain telegramId when the filter is absent', async () => {
      const where = await whereFor({});

      expect(where).not.toHaveProperty('telegramId');
    });

    it('includes the vehicle so the list can render its Vehicle column', async () => {
      await service.getAllDrivers({});

      expect(driver.findMany.mock.calls[0][0].include).toEqual({
        vehicle: { select: { id: true, name: true, licensePlate: true } },
      });
    });
  });
});
