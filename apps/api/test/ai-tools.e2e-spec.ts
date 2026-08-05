import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { ToolExecutor } from '../src/modules/vibe/tools/tool-executor';
import { ToolRegistry } from '../src/modules/vibe/tools/tool-registry';

/**
 * Task 14 acceptance: the tools return REAL catalogue ids from the seeded
 * database, and the boundary holds — an invented id is reported as unavailable
 * rather than quietly accepted.
 */
describe('AI tools (e2e)', () => {
  let app: INestApplication;
  let registry: ToolRegistry;
  let executor: ToolExecutor;
  const prisma = new PrismaClient();

  const context = { userId: 'e2e-tools-user', conversationId: 'e2e-tools-conv' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    registry = app.get(ToolRegistry);
    executor = app.get(ToolExecutor);
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  function call(name: string, args: unknown) {
    return { id: `call_${name}`, name, arguments: JSON.stringify(args) };
  }

  async function run(name: string, args: unknown) {
    const [outcome] = await executor.execute([call(name, args)], context);
    return outcome;
  }

  it('registers the read tools, and no tool that spends money', () => {
    // The write tools (compose_itinerary, create_booking_hold) are added by
    // Task 16's ComposerTools; the six here are the read-only surface.
    for (const readTool of [
      'search_places',
      'search_hotels',
      'search_transport',
      'search_guides',
      'list_packages',
      'check_availability',
    ]) {
      expect(registry.has(readTool)).toBe(true);
    }

    // The boundary: nothing that spends money or runs arbitrary queries is exposed.
    for (const forbidden of ['charge_card', 'create_payment', 'refund', 'delete_booking', 'run_sql']) {
      expect(registry.has(forbidden)).toBe(false);
    }
  });

  it('publishes a JSON schema for every tool so the model can call it', () => {
    for (const definition of registry.definitions()) {
      expect(definition.name).toMatch(/^[a-z_]+$/);
      expect(definition.description.length).toBeGreaterThan(20);
      expect(definition.parameters).toMatchObject({ type: 'object' });
    }
  });

  it('search_places returns ids that exist in the database', async () => {
    const outcome = await run('search_places', { city: 'siem-reap', category: 'TEMPLE', limit: 5 });

    expect(outcome.success).toBe(true);
    const data = outcome.data as { total: number; items: Array<{ refId: string; name: string }> };
    expect(data.items.length).toBeGreaterThan(0);

    const found = await prisma.place.findMany({
      where: { id: { in: data.items.map((item) => item.refId) } },
      select: { id: true },
    });
    // Every id handed to the model is real.
    expect(found).toHaveLength(data.items.length);
  });

  it('search_hotels honours a price ceiling in dollars', async () => {
    const outcome = await run('search_hotels', { city: 'siem-reap', maxPricePerNightUsd: 60 });

    expect(outcome.success).toBe(true);
    const data = outcome.data as { items: Array<{ pricePerNightUsd: number; refId: string }> };
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((hotel) => hotel.pricePerNightUsd <= 60)).toBe(true);
  });

  it('search_hotels coerces the stringified number llama sends', async () => {
    const outcome = await run('search_hotels', { city: 'siem-reap', maxPricePerNightUsd: '60' });

    expect(outcome.success).toBe(true);
    const data = outcome.data as { items: Array<{ pricePerNightUsd: number }> };
    expect(data.items.every((hotel) => hotel.pricePerNightUsd <= 60)).toBe(true);
  });

  it('search_guides filters by spoken language', async () => {
    const outcome = await run('search_guides', { language: 'Mandarin' });

    expect(outcome.success).toBe(true);
    const data = outcome.data as { items: Array<{ languages: string[] }> };
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((guide) => guide.languages.includes('Mandarin'))).toBe(true);
  });

  it('search_transport finds a real route between two cities', async () => {
    const outcome = await run('search_transport', { fromCity: 'phnom-penh', toCity: 'siem-reap' });

    expect(outcome.success).toBe(true);
    const data = outcome.data as { items: Array<{ from: string; to: string; refId: string }> };
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toMatchObject({ from: 'Phnom Penh', to: 'Siem Reap' });
  });

  it('list_packages surfaces the curated packages with prices in dollars', async () => {
    const outcome = await run('list_packages', { limit: 5 });

    expect(outcome.success).toBe(true);
    const data = outcome.data as { items: Array<{ slug: string; priceUsd: number }> };
    expect(data.items.map((pkg) => pkg.slug)).toContain('angkor-essentials-3-day');
    expect(data.items.find((pkg) => pkg.slug === 'angkor-essentials-3-day')?.priceUsd).toBe(189);
  });

  it('check_availability prices and clears a real itinerary', async () => {
    const place = await prisma.place.findFirstOrThrow({ where: { slug: 'angkor-wat' } });
    const hotel = await prisma.hotel.findFirstOrThrow({ where: { slug: 'lotus-lodge-siem-reap' } });

    const outcome = await run('check_availability', {
      startDate: '2028-09-01',
      guests: 2,
      items: [
        { dayNumber: 1, type: 'PLACE', refId: place.id, title: 'Angkor Wat' },
        { dayNumber: 1, type: 'HOTEL', refId: hotel.id, title: 'Lotus Lodge' },
      ],
    });

    expect(outcome.success).toBe(true);
    const data = outcome.data as {
      available: boolean;
      totalUsd: number;
      items: Array<{ available: boolean }>;
    };
    expect(data.available).toBe(true);
    // 2 x $37 entrance + 1 room at $28.
    expect(data.totalUsd).toBe(102);
    expect(data.items.every((item) => item.available)).toBe(true);
  });

  it('check_availability reports an invented id as unavailable rather than accepting it', async () => {
    const outcome = await run('check_availability', {
      startDate: '2028-09-01',
      guests: 2,
      items: [
        {
          dayNumber: 1,
          type: 'HOTEL',
          refId: '00000000-0000-4000-8000-000000000000',
          title: 'Hotel Imaginary',
        },
      ],
    });

    expect(outcome.success).toBe(true);
    const data = outcome.data as { available: boolean; items: Array<{ reason?: string }> };
    expect(data.available).toBe(false);
    expect(data.items[0].reason).toBe('MISSING_REFERENCE');
  });

  it('rejects a non-uuid refId before it reaches the database', async () => {
    const outcome = await run('check_availability', {
      startDate: '2028-09-01',
      guests: 2,
      items: [{ dayNumber: 1, type: 'HOTEL', refId: 'the-nice-one-downtown' }],
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error?.code).toBe('INVALID_ARGUMENTS');
  });

  it('runs several searches concurrently for one turn', async () => {
    const started = Date.now();
    const outcomes = await executor.execute(
      [
        call('search_places', { city: 'siem-reap', limit: 3 }),
        call('search_hotels', { city: 'siem-reap', limit: 3 }),
        call('search_guides', { city: 'siem-reap' }),
      ],
      context,
    );

    expect(outcomes.every((outcome) => outcome.success)).toBe(true);
    expect(outcomes.map((outcome) => outcome.name)).toEqual([
      'search_places',
      'search_hotels',
      'search_guides',
    ]);
    // Three cached catalogue reads in parallel should be quick.
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
