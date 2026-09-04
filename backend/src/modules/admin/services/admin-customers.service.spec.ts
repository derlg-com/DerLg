import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { AdminCustomersService } from './admin-customers.service';

/**
 * Suspension is the security-critical path here.
 *
 * `User.status` and the `suspended` rejection in the login use case already
 * existed, but nothing could set the column — so an abusive or compromised
 * account could not actually be locked out.
 *
 * The subtlety these tests pin: clearing Redis is what does the work. The auth
 * flow stores refresh tokens only at `session:{userId}:{tokenId}` and never
 * writes the `refresh_tokens` table, so `refreshToken.updateMany` always matches
 * zero rows. A suspension that relied on it alone would leave the user able to
 * refresh indefinitely.
 */
describe('AdminCustomersService', () => {
  let service: AdminCustomersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: { updateMany: jest.Mock };
    review: { findMany: jest.Mock };
    loyaltyTransaction: { create: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let redis: { delByPattern: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cust-1',
          status: 'active',
          role: 'user',
          adminProfile: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({
          id: 'cust-1',
          status: 'suspended',
          role: 'guide',
        }),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      review: { findMany: jest.fn().mockResolvedValue([]) },
      loyaltyTransaction: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([{ loyaltyPoints: 100 }]),
    };
    redis = { delByPattern: jest.fn().mockResolvedValue(3) };
    service = new AdminCustomersService(prisma as never, redis as never);
  });

  describe('getAllCustomers', () => {
    it('should filter by status when one is supplied', async () => {
      await service.getAllCustomers({ status: 'suspended' });

      expect(prisma.user.findMany.mock.calls[0][0].where.status).toBe(
        'suspended',
      );
    });

    it('should not constrain status when none is supplied', async () => {
      await service.getAllCustomers({});

      expect(
        prisma.user.findMany.mock.calls[0][0].where.status,
      ).toBeUndefined();
    });

    it('should search across name, email and phone', async () => {
      await service.getAllCustomers({ search: 'dara' });

      const or = prisma.user.findMany.mock.calls[0][0].where.OR;
      expect(or).toHaveLength(3);
    });

    it('should cap limit at 100', async () => {
      await service.getAllCustomers({ limit: '500' });

      expect(prisma.user.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('should expose status so the UI can render a badge', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'cust-1',
          email: 'a@b.c',
          fullName: 'Dara',
          phone: null,
          avatarUrl: null,
          loyaltyPoints: 10,
          isStudentVerified: false,
          role: 'user',
          status: 'suspended',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { bookings: 1, reviews: 0 },
        },
      ]);

      const result = await service.getAllCustomers({});

      expect(result.data[0].status).toBe('suspended');
    });
  });

  describe('setCustomerStatus', () => {
    it('should 404 for an unknown customer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setCustomerStatus('missing', 'suspended', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should clear the Redis sessions that actually gate refresh', async () => {
      const result = await service.setCustomerStatus(
        'cust-1',
        'suspended',
        'Chargeback fraud',
      );

      expect(redis.delByPattern).toHaveBeenCalledWith('session:cust-1:*');
      expect(result.clearedSessionKeys).toBe(3);
    });

    it('should report the previous status alongside the new one', async () => {
      const result = await service.setCustomerStatus(
        'cust-1',
        'suspended',
        'reason',
      );

      expect(result.previousStatus).toBe('active');
      expect(result.status).toBe('suspended');
    });

    it('should NOT terminate sessions when reactivating', async () => {
      prisma.user.update.mockResolvedValue({ id: 'cust-1', status: 'active' });

      const result = await service.setCustomerStatus(
        'cust-1',
        'active',
        'Investigation cleared',
      );

      // Restoring an account should not punish the user by signing them out of
      // every other device.
      expect(redis.delByPattern).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(result.clearedSessionKeys).toBe(0);
    });

    it('should still flip the status when Redis is unavailable', async () => {
      redis.delByPattern.mockRejectedValue(new Error('redis down'));

      // A Redis outage must not leave the account half-suspended: the status
      // change is the durable part and has to land.
      const result = await service.setCustomerStatus(
        'cust-1',
        'suspended',
        'reason',
      );

      expect(result.status).toBe('suspended');
      expect(result.clearedSessionKeys).toBe(0);
    });

    it('should treat inactive like suspended for session teardown', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'cust-1',
        status: 'inactive',
      });

      await service.setCustomerStatus('cust-1', 'inactive', 'dormant');

      expect(redis.delByPattern).toHaveBeenCalled();
    });
  });

  describe('setCustomerRole', () => {
    it("should refuse a change to the acting admin's own account", async () => {
      // Otherwise a super admin could demote themselves out of the only account
      // able to undo it.
      await expect(service.setCustomerRole('me', 'user', 'me')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refuse to grant an admin role', async () => {
      // A users.role of operations_manager without a matching admin_users grant
      // yields a JWT claiming privilege that AdminRoleGuard then denies.
      await expect(
        service.setCustomerRole('cust-1', 'super_admin', 'admin-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should name the assignable roles in the refusal', async () => {
      await expect(
        service.setCustomerRole('cust-1', 'operations_manager', 'admin-1'),
      ).rejects.toThrow(/user, guide, student/);
    });

    it('should refuse when the target still holds an admin grant', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'cust-1',
        role: 'support_agent',
        adminProfile: { id: 'grant-1' },
      });

      await expect(
        service.setCustomerRole('cust-1', 'user', 'admin-1'),
      ).rejects.toThrow(/admin grant/);
    });

    it('should 404 for an unknown customer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setCustomerRole('missing', 'guide', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should apply an allowed role and report the transition', async () => {
      const result = await service.setCustomerRole(
        'cust-1',
        'guide',
        'admin-1',
      );

      expect(result).toEqual({
        id: 'cust-1',
        previousRole: 'user',
        role: 'guide',
      });
    });
  });

  describe('updateCustomer', () => {
    it('should 404 for an unknown customer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateCustomer('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should never write email, which is the login identity', async () => {
      await service.updateCustomer('cust-1', { fullName: 'New Name' });

      expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty(
        'email',
      );
    });
  });

  describe('createAuditLog', () => {
    it('should swallow a logging failure rather than failing the action', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'USER',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getCustomerById', () => {
    const DETAIL = {
      id: 'cust-1',
      email: 'wendy@example.com',
      fullName: 'Wendy',
      phone: '+8613800000000',
      avatarUrl: null,
      loyaltyPoints: 250,
      isStudentVerified: false,
      role: 'user',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-02-01'),
      bookings: [
        {
          id: 'bk-1',
          reference: 'DL-001',
          status: 'confirmed',
          totalUsd: '120.50',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-03'),
          createdAt: new Date('2026-02-01'),
        },
        {
          id: 'bk-2',
          reference: 'DL-002',
          status: 'cancelled',
          totalUsd: '80.25',
          startDate: new Date('2026-04-01'),
          endDate: null,
          createdAt: new Date('2026-02-05'),
        },
      ],
      loyaltyTransactions: [
        {
          id: 'lt-1',
          type: 'earned',
          points: 250,
          balanceAfter: 250,
          reference: 'DL-001',
          createdAt: new Date('2026-02-01'),
        },
      ],
      reviews: [
        {
          id: 'rv-1',
          rating: 5,
          text: 'Great',
          hotelId: 'hotel-1',
          guideId: null,
          tripId: null,
          createdAt: new Date('2026-02-10'),
        },
      ],
      _count: { bookings: 2, reviews: 1 },
    };

    it('should 404 for an unknown customer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should sum total spend across every booking', async () => {
      prisma.user.findUnique.mockResolvedValue(DETAIL);

      const result = await service.getCustomerById('cust-1');

      expect(result.totalSpentUsd).toBeCloseTo(200.75);
    });

    it('should convert Prisma Decimal booking totals to numbers', async () => {
      prisma.user.findUnique.mockResolvedValue(DETAIL);

      const result = await service.getCustomerById('cust-1');

      // Serialising a Decimal straight to JSON yields a string, which breaks
      // arithmetic and currency formatting in the panel.
      expect(typeof result.bookings[0].totalUsd).toBe('number');
      expect(result.bookings[0].totalUsd).toBe(120.5);
    });

    it('should tolerate a booking with no total rather than producing NaN', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...DETAIL,
        bookings: [{ ...DETAIL.bookings[0], totalUsd: null }],
      });

      const result = await service.getCustomerById('cust-1');

      expect(result.totalSpentUsd).toBe(0);
    });

    it('should report counts from _count rather than the truncated arrays', async () => {
      prisma.user.findUnique.mockResolvedValue(DETAIL);

      const result = await service.getCustomerById('cust-1');

      expect(result.bookingCount).toBe(2);
      expect(result.reviewCount).toBe(1);
    });

    it('should include loyalty history and reviews', async () => {
      prisma.user.findUnique.mockResolvedValue(DETAIL);

      const result = await service.getCustomerById('cust-1');

      expect(result.loyaltyTransactions).toHaveLength(1);
      expect(result.loyaltyTransactions[0].balanceAfter).toBe(250);
      expect(result.reviews[0].rating).toBe(5);
    });

    it('should never select the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue(DETAIL);

      await service.getCustomerById('cust-1');

      const arg = prisma.user.findUnique.mock.calls[0][0];
      expect(JSON.stringify(arg)).not.toContain('passwordHash');
    });

    it('should order every nested list newest-first', async () => {
      prisma.user.findUnique.mockResolvedValue(DETAIL);

      await service.getCustomerById('cust-1');

      const include = prisma.user.findUnique.mock.calls[0][0].include;
      expect(include.bookings.orderBy).toEqual({ createdAt: 'desc' });
      expect(include.loyaltyTransactions.orderBy).toEqual({
        createdAt: 'desc',
      });
      expect(include.reviews.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('getCustomerReviews', () => {
    it('should 404 for an unknown customer instead of returning an empty list', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      // An empty array would be indistinguishable from "customer exists but has
      // written nothing", which hides a bad id.
      await expect(service.getCustomerReviews('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.review.findMany).not.toHaveBeenCalled();
    });

    it('should scope the query to the customer and order newest-first', async () => {
      await service.getCustomerReviews('cust-1');

      expect(prisma.review.findMany.mock.calls[0][0]).toMatchObject({
        where: { userId: 'cust-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return an empty list for a customer who has written none', async () => {
      const result = await service.getCustomerReviews('cust-1');

      expect(result).toEqual([]);
    });

    it('should surface the verified-booking flag so unverified reviews are visible', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'rv-1',
          rating: 2,
          text: 'Meh',
          images: ['a.jpg'],
          isVerifiedBooking: false,
          hotelId: 'hotel-1',
          guideId: null,
          tripId: null,
          createdAt: new Date('2026-02-10'),
          updatedAt: new Date('2026-02-11'),
        },
      ]);

      const [review] = await service.getCustomerReviews('cust-1');

      expect(review.isVerifiedBooking).toBe(false);
      expect(review.images).toEqual(['a.jpg']);
    });
  });

  describe('adjustLoyaltyPoints', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'cust-1',
        loyaltyPoints: 100,
      });
    });

    it('should 404 for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adjustLoyaltyPoints({
          userId: 'missing',
          points: 10,
          description: 'goodwill',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should credit points and record the previous balance', async () => {
      prisma.$transaction.mockResolvedValue([{ loyaltyPoints: 150 }]);

      const result = await service.adjustLoyaltyPoints({
        userId: 'cust-1',
        points: 50,
        description: 'goodwill',
      });

      expect(result).toEqual({
        userId: 'cust-1',
        previousBalance: 100,
        adjustment: 50,
        newBalance: 150,
        description: 'goodwill',
      });
    });

    it('should floor a debit at zero rather than going negative', async () => {
      prisma.$transaction.mockResolvedValue([{ loyaltyPoints: 0 }]);

      await service.adjustLoyaltyPoints({
        userId: 'cust-1',
        points: -500,
        description: 'clawback',
      });

      // A negative balance would let the next earn event look like a refund.
      expect(prisma.user.update.mock.calls[0][0].data.loyaltyPoints).toBe(0);
    });

    it('should write the balance and the ledger row in one transaction', async () => {
      await service.adjustLoyaltyPoints({
        userId: 'cust-1',
        points: 50,
        description: 'goodwill',
      });

      // Two tables: a partial write would leave the balance and its history
      // permanently disagreeing.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });

    it('should record the adjustment as an audited ledger entry, not a silent overwrite', async () => {
      await service.adjustLoyaltyPoints({
        userId: 'cust-1',
        points: -30,
        description: 'chargeback reversal',
      });

      const ledger = prisma.loyaltyTransaction.create.mock.calls[0][0].data;
      expect(ledger.type).toBe('adjusted');
      expect(ledger.points).toBe(-30);
      expect(ledger.balanceAfter).toBe(70);
      expect(ledger.reference).toBe('chargeback reversal');
    });
  });
});
