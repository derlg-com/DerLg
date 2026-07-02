import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';

describe('AiToolsService.searchTrips (budget/duration relaxation)', () => {
  let service: AiToolsService;
  let prisma: { trip: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { trip: { findMany: jest.fn().mockResolvedValue([]) } };
    const mod = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('omits budget and duration filters when not provided', async () => {
    await service.searchTrips({ destination: 'Siem Reap' });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.basePriceUsd).toBeUndefined();
    expect(where.durationDays).toBeUndefined();
    expect(where.isPublished).toBe(true);
  });

  it('applies budget as an upper bound when provided', async () => {
    await service.searchTrips({ destination: 'Siem Reap', budget_usd: 600 });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.basePriceUsd).toEqual({ lte: 600 });
  });

  it('uses a +/-2 day tolerance window for duration', async () => {
    await service.searchTrips({ destination: 'Siem Reap', duration_days: 3 });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.durationDays).toEqual({ gte: 1, lte: 5 });
  });
});

describe('AiToolsService.searchGuides (card-ready shape)', () => {
  let service: AiToolsService;
  let prisma: {
    guide: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      guide: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [AiToolsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('returns name (from user.fullName), languages, and verification', async () => {
    prisma.guide.findMany.mockResolvedValue([
      {
        id: 'g1',
        userId: 'u1',
        bio: 'Temple expert',
        avatarUrl: 'a.jpg',
        pricePerDayUsd: 50,
        province: 'Siem Reap',
        isVerified: true,
        languages: [{ language: 'en' }, { language: 'zh' }],
        specialities: [{ speciality: 'Angkor Wat' }],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', fullName: 'Sok Dara' }]);

    const result = await service.searchGuides({
      location: 'Siem Reap',
      language: 'en',
      date: '2026-07-01',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sok Dara');
    expect(result[0].languages).toEqual(['en', 'zh']);
    expect(result[0].specialities).toEqual(['Angkor Wat']);
    expect(result[0].is_verified).toBe(true);
    expect(result[0].price_per_day_usd).toBe(50);
  });

  it('falls back to "Local Guide" when the user has no fullName', async () => {
    prisma.guide.findMany.mockResolvedValue([
      {
        id: 'g2',
        userId: 'u2',
        bio: null,
        avatarUrl: null,
        pricePerDayUsd: 40,
        province: 'Kampot',
        isVerified: true,
        languages: [{ language: 'en' }],
        specialities: [],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u2', fullName: null }]);

    const result = await service.searchGuides({
      location: 'Kampot',
      language: 'en',
      date: '2026-07-01',
    });
    expect(result[0].name).toBe('Local Guide');
  });
});


describe('AiToolsService.sendSosAlert (user existence gate)', () => {
  let service: AiToolsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    emergencyAlert: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      emergencyAlert: { create: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [AiToolsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('throws BadRequestException (400) for a non-existent user and does not write an alert', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.sendSosAlert({
        user_id: 'guest-not-a-real-row',
        location: '11.5564,104.9282',
        message: 'I had an accident',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The FK-violating write must never be attempted for a missing user.
    expect(prisma.emergencyAlert.create).not.toHaveBeenCalled();
  });

  it('writes the emergency alert for a valid user and reports sent', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'real-user-uuid' });
    prisma.emergencyAlert.create.mockResolvedValue({ id: 'alert-1' });

    const result = await service.sendSosAlert({
      user_id: 'real-user-uuid',
      location: '11.5564,104.9282',
      message: 'Emergency near the river',
    });

    expect(result.sent).toBe(true);
    expect(prisma.emergencyAlert.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.emergencyAlert.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe('real-user-uuid');
    expect(createArg.data.alertType).toBe('sos');
    expect(createArg.data.latitude).toBeCloseTo(11.5564);
    expect(createArg.data.longitude).toBeCloseTo(104.9282);
  });
});
