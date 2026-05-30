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
