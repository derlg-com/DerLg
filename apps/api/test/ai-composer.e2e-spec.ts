import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingStatus, DraftSource, ItemType, PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { ToolExecutor } from '../src/modules/vibe/tools/tool-executor';
import { ToolRegistry } from '../src/modules/vibe/tools/tool-registry';

/**
 * Task 16 acceptance: an AI-composed itinerary is a real, priced, bookable plan
 * — and an invented item can never become one.
 */
describe('AI itinerary composition (e2e)', () => {
  let app: INestApplication;
  let registry: ToolRegistry;
  let executor: ToolExecutor;
  const prisma = new PrismaClient();

  let userId: string;
  let context: { userId: string; conversationId: string };
  let angkorWatId: string;
  let lotusLodgeId: string;
  let guideId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    registry = app.get(ToolRegistry);
    executor = app.get(ToolExecutor);

    const user = await prisma.user.create({
      data: {
        email: `composer-${Date.now()}@example.com`,
        passwordHash: 'not-a-real-hash',
        fullName: 'Composer Tester',
      },
      select: { id: true },
    });
    userId = user.id;
    context = { userId, conversationId: 'compose-e2e' };

    angkorWatId = (await prisma.place.findFirstOrThrow({ where: { slug: 'angkor-wat' } })).id;
    lotusLodgeId = (await prisma.hotel.findFirstOrThrow({ where: { slug: 'lotus-lodge-siem-reap' } }))
      .id;
    guideId = (await prisma.guide.findFirstOrThrow({})).id;
  }, 60_000);

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { userId } });
    await prisma.journeyDraft.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  });

  async function run(name: string, args: unknown) {
    const [outcome] = await executor.execute(
      [{ id: `call_${name}`, name, arguments: JSON.stringify(args) }],
      context,
    );
    return outcome;
  }

  function validPlan(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Three days around Angkor',
      startDate: '2029-04-10',
      guests: 2,
      days: [
        {
          dayNumber: 1,
          title: 'Temples before the crowds',
          summary: 'An early start while the stone is still cool.',
          items: [
            {
              type: 'PLACE',
              refId: angkorWatId,
              title: 'Angkor Wat at sunrise',
              startTime: '05:00',
              durationMinutes: 180,
            },
            { type: 'HOTEL', refId: lotusLodgeId, title: 'Lotus Lodge' },
            { type: 'CUSTOM', title: 'Free afternoon by the pool' },
          ],
        },
      ],
      ...overrides,
    };
  }

  it('exposes all nine tools once the write and read tools are registered', () => {
    expect(registry.names().sort()).toEqual([
      'check_availability',
      'compose_itinerary',
      'create_booking_hold',
      'get_journey_draft',
      'list_packages',
      'search_guides',
      'search_hotels',
      'search_places',
      'search_transport',
    ]);
  });

  it('still refuses anything that spends money', () => {
    for (const forbidden of ['charge_card', 'create_payment', 'refund', 'capture_payment']) {
      expect(registry.has(forbidden)).toBe(false);
    }
  });

  describe('compose_itinerary', () => {
    it('persists a priced AI draft built from real catalogue rows', async () => {
      const outcome = await run('compose_itinerary', validPlan());

      expect(outcome.success).toBe(true);
      const data = outcome.data as {
        draftId: string;
        totalUsd: number;
        days: { items: { type: string; bookable: boolean; name: string | null }[] }[];
      };

      // 2 x $37 entrance + 1 room at $28 = $102.
      expect(data.totalUsd).toBe(102);

      const draft = await prisma.journeyDraft.findUniqueOrThrow({
        where: { id: data.draftId },
        select: { userId: true, source: true, totalCents: true, guests: true, startDate: true },
      });
      expect(draft).toMatchObject({
        userId,
        source: DraftSource.AI,
        totalCents: 10_200,
        guests: 2,
      });

      // The catalogue names were resolved server-side, not taken from the model.
      const place = data.days[0].items.find((item) => item.type === ItemType.PLACE);
      expect(place?.name).toBe('Angkor Wat');
    });

    it('accepts the flat item list the model actually produces', async () => {
      const outcome = await run('compose_itinerary', {
        title: 'Siem Reap Trip',
        startDate: '2029-05-10',
        guests: 2,
        items: [
          { dayNumber: 1, type: 'PLACE', refId: angkorWatId, title: 'Angkor Wat' },
          { dayNumber: 1, type: 'HOTEL', refId: lotusLodgeId, title: 'Lotus Lodge' },
          { dayNumber: 2, type: 'CUSTOM', title: 'Slow morning' },
        ],
        dayTitles: [{ dayNumber: 1, title: 'Temples at dawn', summary: 'Early start.' }],
      });

      expect(outcome.success).toBe(true);
      const data = outcome.data as {
        totalUsd: number;
        days: { dayNumber: number; title: string; items: unknown[] }[];
      };
      expect(data.days).toHaveLength(2);
      expect(data.days[0]).toMatchObject({ dayNumber: 1, title: 'Temples at dawn' });
      expect(data.days[0].items).toHaveLength(2);
      expect(data.totalUsd).toBe(102);
    });

    it('stores free time as non-bookable with no price and no reference', async () => {
      const outcome = await run('compose_itinerary', validPlan());
      const { draftId } = outcome.data as { draftId: string };

      const draft = await prisma.journeyDraft.findUniqueOrThrow({
        where: { id: draftId },
        select: { snapshot: true },
      });
      const snapshot = draft.snapshot as unknown as {
        days: { items: { type: string; bookable: boolean; refId: string | null; unitPriceCents: number }[] }[];
      };
      const custom = snapshot.days[0].items.find((item) => item.type === ItemType.CUSTOM);

      expect(custom).toMatchObject({ bookable: false, refId: null, unitPriceCents: 0 });
    });

    it('reports availability for the requested dates', async () => {
      const outcome = await run('compose_itinerary', validPlan());
      const data = outcome.data as { availability: { available: boolean } | null };

      expect(data.availability?.available).toBe(true);
    });

    it('refuses an invented hotel id and names it, writing nothing', async () => {
      const before = await prisma.journeyDraft.count({ where: { userId } });

      const outcome = await run(
        'compose_itinerary',
        validPlan({
          days: [
            {
              dayNumber: 1,
              title: 'Day one',
              items: [
                { type: 'HOTEL', refId: '00000000-0000-4000-8000-000000000000', title: 'Hotel Imaginary' },
              ],
            },
          ],
        }),
      );

      expect(outcome.success).toBe(false);
      expect(outcome.error?.code).toBe('CATALOG_UNKNOWN_REFERENCE');
      expect(outcome.error?.message).toContain('00000000-0000-4000-8000-000000000000');
      expect(await prisma.journeyDraft.count({ where: { userId } })).toBe(before);
    });

    it('refuses a made-up slug for a bookable item before any database query', async () => {
      const outcome = await run(
        'compose_itinerary',
        validPlan({
          days: [
            {
              dayNumber: 1,
              title: 'Day one',
              items: [{ type: 'HOTEL', refId: 'the-nice-one-downtown', title: 'Somewhere' }],
            },
          ],
        }),
      );

      expect(outcome.success).toBe(false);
      expect(outcome.error?.code).toBe('CATALOG_UNKNOWN_REFERENCE');
      expect(outcome.error?.message).toContain('the-nice-one-downtown');
    });

    it('refuses a package basis that does not exist', async () => {
      const outcome = await run(
        'compose_itinerary',
        validPlan({ packageSlug: 'five-star-invented-tour' }),
      );

      expect(outcome.success).toBe(false);
      expect(outcome.error?.code).toBe('CATALOG_UNKNOWN_REFERENCE');
    });

    it('prices a real package basis the same way the manual editor does', async () => {
      const outcome = await run(
        'compose_itinerary',
        validPlan({ packageSlug: 'angkor-essentials-3-day' }),
      );

      expect(outcome.success).toBe(true);
      const data = outcome.data as { totalUsd: number; draftId: string };
      // The package base covers its template, so 2 x $189 stands and the
      // identical item set adds nothing.
      expect(data.totalUsd).toBe(378);

      const draft = await prisma.journeyDraft.findUniqueOrThrow({
        where: { id: data.draftId },
        select: { packageId: true },
      });
      expect(draft.packageId).not.toBeNull();
    });

    it('renumbers days so a plan with gaps still becomes a contiguous trip', async () => {
      const outcome = await run(
        'compose_itinerary',
        validPlan({
          days: [
            { dayNumber: 7, title: 'Guide day', items: [{ type: 'GUIDE', refId: guideId, title: 'Guide' }] },
            { dayNumber: 2, title: 'Temple day', items: [{ type: 'PLACE', refId: angkorWatId, title: 'Angkor Wat' }] },
          ],
        }),
      );

      const data = outcome.data as { days: { dayNumber: number; title: string }[] };
      expect(data.days.map((day) => day.dayNumber)).toEqual([1, 2]);
      expect(data.days.map((day) => day.title)).toEqual(['Temple day', 'Guide day']);
    });
  });

  describe('get_journey_draft', () => {
    it('reads back a plan with its real refIds so the concierge can discuss it', async () => {
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };

      const outcome = await run('get_journey_draft', { draftId });

      expect(outcome.success).toBe(true);
      const data = outcome.data as {
        draftId: string;
        source: string;
        totalUsd: number;
        days: { items: { refId: string | null; name: string; bookable: boolean }[] }[];
      };
      expect(data).toMatchObject({ draftId, source: 'AI', totalUsd: 102 });
      const place = data.days[0].items.find((item) => item.name === 'Angkor Wat');
      expect(place?.refId).toBe(angkorWatId);
      // Free time is described but marked unbookable.
      expect(data.days[0].items.some((item) => !item.bookable)).toBe(true);
    });

    it('falls back to the plan the conversation is working on', async () => {
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };

      const [outcome] = await executor.execute(
        [{ id: 'c1', name: 'get_journey_draft', arguments: '{}' }],
        { ...context, draftId },
      );

      expect(outcome.success).toBe(true);
      expect((outcome.data as { draftId: string }).draftId).toBe(draftId);
    });

    it('explains that there is nothing open when no plan exists', async () => {
      const outcome = await run('get_journey_draft', {});

      expect(outcome.success).toBe(false);
      expect(outcome.error?.message).toMatch(/no plan open/i);
    });

    it('refuses to read a plan belonging to someone else', async () => {
      const stranger = await prisma.user.create({
        data: {
          email: `peeker-${Date.now()}@example.com`,
          passwordHash: 'x',
          fullName: 'Peeker',
        },
        select: { id: true },
      });
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };

      const [outcome] = await executor.execute(
        [{ id: 'c1', name: 'get_journey_draft', arguments: JSON.stringify({ draftId }) }],
        { userId: stranger.id, conversationId: 'intruder' },
      );

      expect(outcome.success).toBe(false);
      expect(outcome.error?.code).toBe('FORBIDDEN');

      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });

  describe('create_booking_hold', () => {
    it('turns a composed plan into a real hold with a ledger the manual path shares', async () => {
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };

      const outcome = await run('create_booking_hold', { draftId });

      expect(outcome.success).toBe(true);
      const data = outcome.data as {
        bookingId: string;
        reference: string;
        status: string;
        totalUsd: number;
        secondsRemaining: number;
      };

      expect(data.reference).toMatch(/^DLG-\d{4}-\d{4}$/);
      expect(data.status).toBe(BookingStatus.HOLD);
      expect(data.totalUsd).toBe(102);
      expect(data.secondsRemaining).toBeGreaterThan(800);
      // No URL is handed to the model; the UI builds the link from bookingId.
      expect(data).not.toHaveProperty('checkoutUrl');

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: data.bookingId },
        select: {
          userId: true,
          status: true,
          totalCents: true,
          contactEmail: true,
          items: { select: { type: true, refId: true } },
        },
      });

      expect(booking).toMatchObject({ userId, status: BookingStatus.HOLD, totalCents: 10_200 });
      // The account's own email, never something from the conversation.
      expect(booking.contactEmail).toContain('composer-');
      // Only the two bookable items reach the inventory ledger.
      expect(booking.items).toHaveLength(2);
      expect(booking.items.map((item) => item.type).sort()).toEqual([
        ItemType.HOTEL,
        ItemType.PLACE,
      ]);
    });

    it('ignores a contact the model tries to supply and uses the account', async () => {
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };

      const outcome = await run('create_booking_hold', {
        draftId,
        contactEmail: 'attacker@example.com',
        contactName: 'Someone Else',
      });

      expect(outcome.success).toBe(true);
      const { bookingId } = outcome.data as { bookingId: string };
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { contactEmail: true, contactName: true },
      });

      expect(booking.contactEmail).toContain('composer-');
      expect(booking.contactEmail).not.toBe('attacker@example.com');
      expect(booking.contactName).toBe('Composer Tester');
    });

    it('does not create a payment when it holds', async () => {
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };
      const outcome = await run('create_booking_hold', { draftId });
      const { bookingId } = outcome.data as { bookingId: string };

      expect(await prisma.payment.count({ where: { bookingId } })).toBe(0);
    });

    it('refuses a draft that belongs to someone else', async () => {
      const stranger = await prisma.user.create({
        data: {
          email: `stranger-${Date.now()}@example.com`,
          passwordHash: 'x',
          fullName: 'Stranger',
        },
        select: { id: true },
      });
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };

      const [outcome] = await executor.execute(
        [
          {
            id: 'c1',
            name: 'create_booking_hold',
            arguments: JSON.stringify({ draftId }),
          },
        ],
        { userId: stranger.id, conversationId: 'intruder' },
      );

      expect(outcome.success).toBe(false);
      expect(outcome.error?.code).toBe('FORBIDDEN');

      await prisma.user.delete({ where: { id: stranger.id } });
    });

    it('falls back to the conversation´s plan when the model sends an unusable id', async () => {
      // Observed live: the model sent the tool's own name, or a blank, instead of
      // the id it had been given a turn earlier.
      const composed = await run('compose_itinerary', validPlan());
      const { draftId } = composed.data as { draftId: string };

      const [outcome] = await executor.execute(
        [
          {
            id: 'c1',
            name: 'create_booking_hold',
            arguments: JSON.stringify({ draftId: 'compose_itinerary' }),
          },
        ],
        { ...context, draftId },
      );

      expect(outcome.success).toBe(true);
      const data = outcome.data as { reference: string; totalUsd: number };
      expect(data.reference).toMatch(/^DLG-/);
      expect(data.totalUsd).toBe(102);
    });

    it('refuses an invented draftId', async () => {
      const outcome = await run('create_booking_hold', {
        draftId: '00000000-0000-4000-8000-000000000000',
      });

      expect(outcome.success).toBe(false);
      expect(outcome.error?.code).toBe('NOT_FOUND');
    });
  });
});
