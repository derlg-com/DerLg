import { NotFoundException } from '@nestjs/common';
import { Specialty, SupportedLanguage } from '@prisma/client';

import { AdminGuidesService } from './admin-guides.service';

/**
 * Guides drifted in two ways: `guide_specialities` (free text) became
 * `guide_specialties` with a `Specialty` enum, and `SupportedLanguage` grew from
 * 3 values to 10. Passing an out-of-enum value to Prisma throws, so the service
 * filters query input down to valid members instead of surfacing a 500.
 */
describe('AdminGuidesService', () => {
  let service: AdminGuidesService;
  let prisma: {
    guide: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    bookingItem: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      guide: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      bookingItem: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    service = new AdminGuidesService(prisma as never);
  });

  const capturedWhere = () =>
    prisma.guide.findMany.mock.calls[0][0].where as Record<string, unknown>;

  describe('filtering', () => {
    it('should filter on the renamed specialties relation', async () => {
      await service.getAllGuides({ specialties: 'food_tours' });

      const where = capturedWhere();
      expect(where.specialties).toEqual({
        some: { specialty: { in: [Specialty.food_tours] } },
      });
      // The old names must be gone: the relation is `specialties`, and the
      // column is `specialty`, not `speciality`.
      expect(where).not.toHaveProperty('guide_specialities');
    });

    it('should filter on the renamed languages relation', async () => {
      await service.getAllGuides({ languages: 'en,zh' });

      expect(capturedWhere().languages).toEqual({
        some: {
          language: { in: [SupportedLanguage.en, SupportedLanguage.zh] },
        },
      });
    });

    it('should accept the languages added after the original introspection', async () => {
      // The stale schema only knew en/zh/km.
      await service.getAllGuides({ languages: 'ja,ko,fr,de,es,th,vi' });

      const where = capturedWhere() as {
        languages: { some: { language: { in: string[] } } };
      };
      expect(where.languages.some.language.in).toHaveLength(7);
    });

    it('should drop values outside the enum rather than pass them to Prisma', async () => {
      await service.getAllGuides({
        languages: 'en,klingon',
        specialties: 'food_tours,interpretive_dance',
      });

      const where = capturedWhere() as {
        languages: { some: { language: { in: string[] } } };
        specialties: { some: { specialty: { in: string[] } } };
      };
      expect(where.languages.some.language.in).toEqual(['en']);
      expect(where.specialties.some.specialty.in).toEqual(['food_tours']);
    });

    it('should omit the filter entirely when every value is invalid', async () => {
      await service.getAllGuides({ languages: 'klingon' });
      expect(capturedWhere()).not.toHaveProperty('languages');
    });

    it('should clamp limit to 100', async () => {
      await service.getAllGuides({ limit: '5000' });
      expect(prisma.guide.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('should default to page 1, limit 20', async () => {
      await service.getAllGuides({});
      const args = prisma.guide.findMany.mock.calls[0][0];
      expect(args.take).toBe(20);
      expect(args.skip).toBe(0);
    });

    it('should reject a page below 1 by falling back to the first page', async () => {
      await service.getAllGuides({ page: '-3' });
      expect(prisma.guide.findMany.mock.calls[0][0].skip).toBe(0);
    });
  });

  describe('getGuideAvailability', () => {
    it('should 404 for an unknown guide', async () => {
      prisma.guide.findUnique.mockResolvedValue(null);
      await expect(
        service.getGuideAvailability('missing', '2026-09-01', '2026-09-05'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query interval overlap rather than a single date', async () => {
      prisma.guide.findUnique.mockResolvedValue({ id: 'g-1', isActive: true });

      await service.getGuideAvailability('g-1', '2026-09-10', '2026-09-14');

      const where = prisma.bookingItem.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      expect(where.startDate).toEqual({ lte: new Date('2026-09-14') });
      expect(where.endDate).toEqual({ gte: new Date('2026-09-10') });
      expect(where).not.toHaveProperty('date');
    });

    it('should report a conflict for a date inside an existing engagement', async () => {
      prisma.guide.findUnique.mockResolvedValue({ id: 'g-1', isActive: true });
      prisma.bookingItem.findMany.mockResolvedValue([
        {
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-14'),
          booking: { id: 'bk-1', reference: 'REF-1', status: 'confirmed' },
        },
      ]);

      const result = await service.getGuideAvailability(
        'g-1',
        '2026-09-12',
        '2026-09-12',
      );

      expect(result.isAvailable).toBe(false);
      expect(result.totalConflicts).toBe(1);
    });

    it('should report unavailable for an inactive guide with no conflicts', async () => {
      prisma.guide.findUnique.mockResolvedValue({ id: 'g-1', isActive: false });
      prisma.bookingItem.findMany.mockResolvedValue([]);

      const result = await service.getGuideAvailability(
        'g-1',
        '2026-09-01',
        '2026-09-05',
      );
      expect(result.isAvailable).toBe(false);
    });
  });

  describe('createGuide', () => {
    it('should 404 when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createGuide({
          userId: 'nobody',
          province: 'Siem Reap',
          pricePerDayUsd: 45,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should refuse a second guide profile for the same user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
      prisma.guide.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createGuide({
          userId: 'u-1',
          province: 'Siem Reap',
          pricePerDayUsd: 45,
        }),
      ).rejects.toThrow(/already exists/);
    });

    it('should write the guide and its enum rows in one transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
      prisma.guide.findUnique.mockResolvedValue(null);

      const tx = {
        guide: {
          create: jest.fn().mockResolvedValue({
            id: 'g-new',
            userId: 'u-1',
            bio: null,
            avatarUrl: null,
            images: [],
            pricePerDayUsd: 45,
            isVerified: false,
            province: 'Siem Reap',
            provinces: ['Siem Reap'],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        guideLanguage: { createMany: jest.fn() },
        guideSpecialty: { createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation((cb: (t: unknown) => unknown) =>
        cb(tx),
      );

      await service.createGuide({
        userId: 'u-1',
        province: 'Siem Reap',
        pricePerDayUsd: 45,
        languages: [SupportedLanguage.en],
        specialties: [Specialty.culture_history],
      });

      // A guide without its languages is a record that appears in the catalogue
      // but matches no filter, so all three writes share one transaction.
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.guideSpecialty.createMany).toHaveBeenCalledWith({
        data: [{ guideId: 'g-new', specialty: Specialty.culture_history }],
        skipDuplicates: true,
      });
    });
  });
});
