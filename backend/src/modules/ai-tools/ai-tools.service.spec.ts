import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';

describe('AiToolsService.searchTrips (budget/duration relaxation)', () => {
  let service: AiToolsService;
  let prisma: { trip: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { trip: { findMany: jest.fn().mockResolvedValue([]) } };
    const mod = await Test.createTestingModule({
      providers: [AiToolsService, { provide: PrismaService, useValue: prisma }],
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
        specialties: [{ specialty: 'culture_history' }],
        trips: [],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', fullName: 'Sok Dara' },
    ]);

    const result = await service.searchGuides({
      location: 'Siem Reap',
      language: 'en',
      date: '2026-07-01',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sok Dara');
    expect(result[0].languages).toEqual(['en', 'zh']);
    expect(result[0].specialties).toEqual(['culture_history']);
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
        specialties: [],
        trips: [],
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

describe('AiToolsService.createCustomTrip (P6b server-side pricing)', () => {
  let service: AiToolsService;
  let prisma: {
    hotelRoom: { findUnique: jest.Mock };
    guide: { findUnique: jest.Mock };
    transportationVehicle: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    trip: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      hotelRoom: { findUnique: jest.fn() },
      guide: { findUnique: jest.fn() },
      transportationVehicle: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      trip: { create: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [AiToolsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('rejects a trip with no components and no extras', async () => {
    await expect(
      service.createCustomTrip({ title: 'Empty', duration_days: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.trip.create).not.toHaveBeenCalled();
  });

  it('sums components x duration plus extras, caps nothing below 500/unit', async () => {
    prisma.hotelRoom.findUnique.mockResolvedValue({
      id: 'r1',
      roomType: 'Deluxe King',
      priceUsd: 120,
      hotel: { translations: [{ name: 'Sokha Siem Reap' }] },
    });
    prisma.guide.findUnique.mockResolvedValue({
      id: 'g1',
      userId: 'u1',
      pricePerDayUsd: 45,
    });
    prisma.transportationVehicle.findUnique.mockResolvedValue({
      id: 'v1',
      name: 'Phnom Penh VIP Hiace',
      priceUsd: 90,
    });
    prisma.user.findUnique.mockResolvedValue({ fullName: 'Sok Dara' });
    prisma.trip.create.mockResolvedValue({ id: 'trip-1' });

    const result = await service.createCustomTrip({
      title: '3-day Siem Reap custom',
      duration_days: 3,
      hotel_room_id: 'r1',
      guide_id: 'g1',
      vehicle_id: 'v1',
      extras: [
        { name: 'Sunrise photo session', unit_price_usd: 40, quantity: 1 },
      ],
    });

    expect(result.total_usd).toBe(120 * 3 + 45 * 3 + 90 * 3 + 40);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({
      type: 'hotel',
      name: 'Sokha Siem Reap',
      quantity: 3,
      unit_price_usd: 120,
    });
    expect(result.extras[0].subtotal_usd).toBe(40);

    const createArg = prisma.trip.create.mock.calls[0][0];
    expect(createArg.data.category).toBe('custom');
    expect(createArg.data.basePriceUsd).toBe(result.total_usd);
    expect(createArg.data.isPublished).toBe(true);
    expect(createArg.data.guides).toEqual({ connect: { id: 'g1' } });
    expect(createArg.data.extras).toEqual(result.extras);
  });

  it('throws 404 when a referenced component does not exist', async () => {
    prisma.hotelRoom.findUnique.mockResolvedValue(null);
    prisma.guide.findUnique.mockResolvedValue(null);
    prisma.transportationVehicle.findUnique.mockResolvedValue(null);

    await expect(
      service.createCustomTrip({
        title: 'Broken',
        duration_days: 2,
        hotel_room_id: 'missing-room',
        extras: [{ name: 'x', unit_price_usd: 10, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
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
