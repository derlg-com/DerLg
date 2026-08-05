import { DraftSource, ItemType } from '@prisma/client';

import { ErrorCode } from '../../../common/errors/error-codes';
import { BookingsService } from '../../bookings/bookings.service';
import { CatalogRefResolver } from '../../catalog/catalog-ref.resolver';
import { CatalogService } from '../../catalog/catalog.service';
import { DraftSnapshot } from '../../journeys/interfaces/journey-draft.interface';
import { JourneyDraftsService } from '../../journeys/journey-drafts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ComposerTools } from './composer.tools';
import {
  ComposeItemArgsDto,
  ComposeItineraryArgsDto,
  CreateBookingHoldArgsDto,
} from './dto/composer-args.dto';
import { RegisteredTool, ToolContext, ToolRegistry } from './tool-registry';

const context: ToolContext = { userId: 'user-1', conversationId: 'conv-1' };

/** Catalogue ids must be uuid-shaped: a malformed one is refused before Prisma. */
const PLACE_ID = '11111111-1111-4111-8111-111111111111';
const HOTEL_ID = '22222222-2222-4222-8222-222222222222';

describe('ComposerTools', () => {
  let registered: Record<string, RegisteredTool>;
  let registry: ToolRegistry;
  let drafts: { createFromSnapshot: jest.Mock; findOne: jest.Mock };
  let bookings: { create: jest.Mock };
  let catalog: { getPackageBySlug: jest.Mock };
  let refs: { findMissing: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let tools: ComposerTools;

  const draftView = {
    id: 'draft-1',
    title: 'Three days around Angkor',
    startDate: '2028-03-01',
    guests: 2,
    days: [
      {
        dayKey: 'dy_1',
        dayNumber: 1,
        title: 'Temples at dawn',
        summary: 'Early start.',
        items: [
          {
            itemKey: 'it_1',
            type: ItemType.PLACE,
            refId: PLACE_ID,
            title: 'Angkor Wat',
            description: '',
            startTime: '05:00',
            durationMinutes: 180,
            extraPriceCents: 0,
            bookable: true,
            unitPriceCents: 3_700,
            referenceLabel: 'Angkor Wat',
          },
        ],
      },
    ],
    price: {
      baseCents: 0,
      itemsCents: 7_400,
      templateItemsCents: 7_400,
      deltaCents: 0,
      totalCents: 7_400,
      currency: 'USD',
      lines: [{ label: 'Angkor Wat', quantity: 2, unitPriceCents: 3_700, totalCents: 7_400 }],
    },
    availability: { available: true, items: [] },
    source: 'AI' as const,
    packageId: null,
    packageSlug: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    registered = {};
    registry = {
      register: jest.fn((name: string, tool: RegisteredTool) => {
        registered[name] = tool;
      }),
      get: (name: string) => registered[name],
      has: (name: string) => name in registered,
      names: () => Object.keys(registered),
    } as unknown as ToolRegistry;

    drafts = {
      createFromSnapshot: jest.fn().mockResolvedValue(draftView),
      findOne: jest.fn().mockResolvedValue(draftView),
    };
    bookings = {
      create: jest.fn().mockResolvedValue({
        id: 'booking-1',
        reference: 'DLG-2026-0007',
        status: 'HOLD',
        totalCents: 7_400,
        holdExpiresAt: '2026-08-01T12:15:00.000Z',
        secondsRemaining: 900,
        guests: 2,
        startDate: '2028-03-01',
      }),
    };
    catalog = { getPackageBySlug: jest.fn() };
    refs = { findMissing: jest.fn().mockResolvedValue([]) };
    prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ email: 'traveller@example.com', fullName: 'Real Traveller' }),
      },
    };

    tools = new ComposerTools(
      registry,
      drafts as unknown as JourneyDraftsService,
      bookings as unknown as BookingsService,
      catalog as unknown as CatalogService,
      refs as unknown as CatalogRefResolver,
      prisma as unknown as PrismaService,
    );
    jest.spyOn(tools['logger'], 'log').mockImplementation(() => undefined);
    tools.onModuleInit();
  });

  function compose(overrides: Partial<ComposeItineraryArgsDto> = {}): Promise<unknown> {
    const args: ComposeItineraryArgsDto = {
      title: 'Three days around Angkor',
      startDate: '2028-03-01',
      guests: 2,
      days: [
        {
          dayNumber: 1,
          title: 'Temples at dawn',
          items: [{ type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' }],
        },
      ],
      ...overrides,
    };
    return registered.compose_itinerary.handler(args, context) as Promise<unknown>;
  }

  function snapshotPassedToDrafts(): DraftSnapshot {
    return (drafts.createFromSnapshot.mock.calls[0][0] as { snapshot: DraftSnapshot }).snapshot;
  }

  describe('registration', () => {
    it('adds the two write tools plus the draft reader', () => {
      expect(registry.names().sort()).toEqual([
        'compose_itinerary',
        'create_booking_hold',
        'get_journey_draft',
      ]);
    });

    it('tells the model that composing returns a draftId and holding does not charge', () => {
      expect(registered.compose_itinerary.definition.description).toContain('draftId');
      expect(registered.create_booking_hold.definition.description).toMatch(
        /does NOT charge|not charge/i,
      );
    });
  });

  describe('compose_itinerary grounding', () => {
    it('saves the plan as an AI draft through the same service the editor uses', async () => {
      await compose();

      expect(drafts.createFromSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          source: DraftSource.AI,
          guests: 2,
          startDate: '2028-03-01',
          title: 'Three days around Angkor',
        }),
      );
    });

    it('verifies every bookable id against the catalogue before writing', async () => {
      await compose({
        days: [
          {
            dayNumber: 1,
            title: 'Day one',
            items: [
              { type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' },
              { type: 'HOTEL', refId: HOTEL_ID, title: 'Lotus Lodge' },
              { type: 'CUSTOM', title: 'Free afternoon' },
            ],
          },
        ],
      });

      // CUSTOM carries no reference, so only the two real ids are checked.
      expect(refs.findMissing).toHaveBeenCalledWith([
        { type: ItemType.PLACE, refId: PLACE_ID },
        { type: ItemType.HOTEL, refId: HOTEL_ID },
      ]);
    });

    it('refuses an invented id and names it so the model can search again', async () => {
      refs.findMissing.mockResolvedValue([{ type: ItemType.HOTEL, refId: '44444444-4444-4444-4444-444444444444' }]);

      await expect(compose()).rejects.toMatchObject({
        code: ErrorCode.CATALOG_UNKNOWN_REFERENCE,
      });
      await expect(compose()).rejects.toThrow(/44444444-4444-4444-4444-444444444444/);
      // Nothing was written.
      expect(drafts.createFromSnapshot).not.toHaveBeenCalled();
    });

    it('refuses an id the model never looked up, even if it exists', async () => {
      // Provenance, not just existence: a guessed uuid that happens to be real
      // must still be refused, or grounding means nothing.
      refs.findMissing.mockResolvedValue([]);

      const guarded: ToolContext = { ...context, knownRefIds: new Set(['some-other-id']) };

      await expect(
        registered.compose_itinerary.handler(
          {
            title: 'Trip',
            startDate: '2028-03-01',
            guests: 2,
            days: [
              {
                dayNumber: 1,
                title: 'Day one',
                items: [{ type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' }],
              },
            ],
          },
          guarded,
        ),
      ).rejects.toThrow(new RegExp(`not things you have looked up.*${PLACE_ID}`, 's'));

      expect(drafts.createFromSnapshot).not.toHaveBeenCalled();
    });

    it('resolves an item by name when the model could not reproduce the id', async () => {
      // Observed live: llama wrote the tool's own name into refId. The row it
      // meant was already on screen, so match it rather than failing.
      const guarded: ToolContext = {
        ...context,
        knownRefIds: new Set([PLACE_ID]),
        shownItems: [{ type: 'PLACE', refId: PLACE_ID, name: 'Angkor Wat' }],
      };

      await registered.compose_itinerary.handler(
        {
          title: 'Trip',
          startDate: '2028-03-01',
          guests: 2,
          items: [
            { dayNumber: 1, type: 'PLACE', refId: 'search_places', title: 'Angkor Wat at sunrise' },
          ],
        },
        guarded,
      );

      expect(snapshotPassedToDrafts().days[0].items[0]).toMatchObject({
        refId: PLACE_ID,
        referenceLabel: 'Angkor Wat',
      });
    });

    it('will not resolve a name to a row of a different type', async () => {
      const guarded: ToolContext = {
        ...context,
        knownRefIds: new Set([PLACE_ID]),
        shownItems: [{ type: 'PLACE', refId: PLACE_ID, name: 'Angkor Wat' }],
      };

      await expect(
        registered.compose_itinerary.handler(
          {
            title: 'Trip',
            startDate: '2028-03-01',
            guests: 2,
            items: [{ dayNumber: 1, type: 'HOTEL', refId: 'Angkor Wat', title: 'Angkor Wat' }],
          },
          guarded,
        ),
      ).rejects.toThrow(/not things you have looked up/);
    });

    it('accepts ids that a tool returned earlier in the conversation', async () => {
      const guarded: ToolContext = { ...context, knownRefIds: new Set([PLACE_ID]) };

      await registered.compose_itinerary.handler(
        {
          title: 'Trip',
          startDate: '2028-03-01',
          guests: 2,
          days: [
            {
              dayNumber: 1,
              title: 'Day one',
              items: [{ type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' }],
            },
          ],
        },
        guarded,
      );

      expect(drafts.createFromSnapshot).toHaveBeenCalled();
    });

    it('groups the flat item list the model sends into days', async () => {
      // The advertised shape: one flat list, each item tagged with its day.
      // Small models cannot emit two levels of nesting reliably.
      await registered.compose_itinerary.handler(
        {
          title: 'Siem Reap Trip',
          startDate: '2029-05-10',
          guests: 2,
          items: [
            { dayNumber: 1, type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' },
            { dayNumber: 2, type: 'HOTEL', refId: HOTEL_ID, title: 'Lotus Lodge' },
            { dayNumber: 1, type: 'CUSTOM', title: 'Rest in the afternoon' },
          ],
          dayTitles: [
            { dayNumber: 1, title: 'Temples at dawn', summary: 'An early start.' },
            { dayNumber: 2, title: 'Slow morning' },
          ],
        },
        context,
      );

      const snapshot = snapshotPassedToDrafts();
      expect(snapshot.days).toHaveLength(2);
      expect(snapshot.days[0]).toMatchObject({
        dayNumber: 1,
        title: 'Temples at dawn',
        summary: 'An early start.',
      });
      // Both day-1 items landed on day 1, in the order given.
      expect(snapshot.days[0].items.map((item) => item.title)).toEqual([
        'Angkor Wat',
        'Rest in the afternoon',
      ]);
      expect(snapshot.days[1].items.map((item) => item.title)).toEqual(['Lotus Lodge']);
    });

    it('falls back to a plain day heading when none was supplied', async () => {
      await registered.compose_itinerary.handler(
        {
          title: 'Trip',
          startDate: '2029-05-10',
          guests: 2,
          items: [{ dayNumber: 1, type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' }],
        },
        context,
      );

      expect(snapshotPassedToDrafts().days[0].title).toBe('Day 1');
    });

    it('refuses a plan with nothing bookable in it', async () => {
      await expect(
        compose({
          days: [
            {
              dayNumber: 1,
              title: 'Vibes only',
              items: [{ type: 'CUSTOM', title: 'Wander around' }],
            },
          ],
        }),
      ).rejects.toThrow(/needs at least one real/i);
    });

    it('refuses a package slug that does not exist', async () => {
      catalog.getPackageBySlug.mockRejectedValue(new Error('not found'));

      await expect(compose({ packageSlug: 'invented-package' })).rejects.toMatchObject({
        code: ErrorCode.CATALOG_UNKNOWN_REFERENCE,
      });
      expect(drafts.createFromSnapshot).not.toHaveBeenCalled();
    });

    it('keeps a real package as the pricing basis', async () => {
      catalog.getPackageBySlug.mockResolvedValue({ id: 'pkg-1', slug: 'angkor-essentials-3-day' });

      await compose({ packageSlug: 'angkor-essentials-3-day' });

      expect(drafts.createFromSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ packageId: 'pkg-1' }),
      );
    });

    it('stores an invented item as free, non-bookable and reference-less', async () => {
      await compose({
        days: [
          {
            dayNumber: 1,
            title: 'Slow day',
            items: [
              { type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' },
              {
                type: 'CUSTOM',
                title: 'Sunset drinks by the river',
                description: 'Your own time.',
                // Even if the model supplies these, they must not create a charge.
                refId: HOTEL_ID,
              } as ComposeItemArgsDto,
            ],
          },
        ],
      });

      const item = snapshotPassedToDrafts().days[0].items[1];
      expect(item).toMatchObject({
        type: ItemType.CUSTOM,
        refId: null,
        bookable: false,
        extraPriceCents: 0,
        unitPriceCents: 0,
        title: 'Sunset drinks by the river',
      });
    });

    it('lets the model author day themes and descriptions', async () => {
      await compose({
        days: [
          {
            dayNumber: 1,
            title: 'Temples before the crowds',
            summary: 'Start at dawn while the stone is still cool.',
            items: [{ type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' }],
          },
        ],
      });

      expect(snapshotPassedToDrafts().days[0]).toMatchObject({
        title: 'Temples before the crowds',
        summary: 'Start at dawn while the stone is still cool.',
      });
    });

    it('renumbers days so a model that skips numbers still produces a contiguous trip', async () => {
      await compose({
        days: [
          { dayNumber: 5, title: 'Later', items: [] },
          {
            dayNumber: 1,
            title: 'First',
            items: [{ type: 'PLACE', refId: PLACE_ID, title: 'Angkor Wat' }],
          },
          { dayNumber: 9, title: 'Last', items: [] },
        ],
      });

      const snapshot = snapshotPassedToDrafts();
      expect(snapshot.days.map((day) => day.dayNumber)).toEqual([1, 2, 3]);
      expect(snapshot.days.map((day) => day.title)).toEqual(['First', 'Later', 'Last']);
    });

    it('gives every day and item a stable key', async () => {
      await compose();

      const snapshot = snapshotPassedToDrafts();
      expect(snapshot.days[0].dayKey).toMatch(/^dy_/);
      expect(snapshot.days[0].items[0].itemKey).toMatch(/^it_/);
    });

    it('returns the plan with the server´s price and a draftId to book with', async () => {
      const result = (await compose()) as {
        draftId: string;
        totalUsd: number;
        days: { items: { unitPriceUsd: number; name: string | null }[] }[];
        priceLines: { totalUsd: number }[];
      };

      expect(result.draftId).toBe('draft-1');
      // Dollars for the model, computed from the cents the pricing service returned.
      expect(result.totalUsd).toBe(74);
      expect(result.days[0].items[0]).toMatchObject({ unitPriceUsd: 37, name: 'Angkor Wat' });
      expect(result.priceLines[0].totalUsd).toBe(74);
    });

    it('surfaces an unavailable item with its alternatives', async () => {
      drafts.createFromSnapshot.mockResolvedValue({
        ...draftView,
        availability: {
          available: false,
          items: [
            {
              dayNumber: 1,
              date: '2028-03-01',
              available: false,
              reason: 'SOLD_OUT',
              remaining: 0,
              alternatives: [
                { refId: '55555555-5555-4555-8555-555555555555', slug: 'angkor-terrace', label: 'Angkor Terrace', priceCents: 5_400 },
              ],
            },
          ],
        },
      });

      const result = (await compose()) as {
        availability: { available: boolean; unavailable: { alternatives: { name: string }[] }[] };
      };

      expect(result.availability.available).toBe(false);
      expect(result.availability.unavailable[0].alternatives[0]).toMatchObject({
        name: 'Angkor Terrace',
        priceUsd: 54,
      });
    });
  });

  describe('get_journey_draft', () => {
    it('reads the plan the conversation is working on when no id is given', async () => {
      await registered.get_journey_draft.handler({}, { ...context, draftId: 'draft-1' });

      expect(drafts.findOne).toHaveBeenCalledWith('user-1', 'draft-1');
    });

    it('returns the plan with its refIds so the model need not search again', async () => {
      const result = (await registered.get_journey_draft.handler(
        { draftId: 'draft-1' },
        context,
      )) as {
        draftId: string;
        totalUsd: number;
        days: { items: { refId: string | null; name: string }[] }[];
      };

      expect(result).toMatchObject({ draftId: 'draft-1', totalUsd: 74 });
      expect(result.days[0].items[0]).toMatchObject({
        refId: PLACE_ID,
        name: 'Angkor Wat',
      });
    });

    it('says there is nothing open rather than guessing', async () => {
      await expect(registered.get_journey_draft.handler({}, context)).rejects.toThrow(
        /no plan open/i,
      );
      expect(drafts.findOne).not.toHaveBeenCalled();
    });
  });

  describe('create_booking_hold', () => {
    function hold(overrides: Partial<CreateBookingHoldArgsDto> = {}): Promise<unknown> {
      return registered.create_booking_hold.handler(
        { draftId: 'draft-1', ...overrides },
        context,
      ) as Promise<unknown>;
    }

    it('holds through the booking service so the AI takes the same locks as a person', async () => {
      await hold();

      expect(bookings.create).toHaveBeenCalledWith(
        'user-1',
        { name: 'Real Traveller', email: 'traveller@example.com' },
        expect.objectContaining({ draftId: 'draft-1' }),
      );
    });

    it('refuses to let the model choose who the booking is for', async () => {
      // A previous version accepted contactName/contactEmail overrides and the
      // model invented "Traveller <traveller@example.com>", so a real booking
      // carried a contact address belonging to nobody.
      await registered.create_booking_hold.handler(
        {
          draftId: 'draft-1',
          contactEmail: 'attacker@example.com',
          contactName: 'Someone Else',
        } as CreateBookingHoldArgsDto,
        context,
      );

      const [, contact, dto] = bookings.create.mock.calls[0] as [
        string,
        { email: string; name: string },
        { contactEmail: string },
      ];
      expect(contact).toEqual({ name: 'Real Traveller', email: 'traveller@example.com' });
      expect(dto.contactEmail).toBe('traveller@example.com');
    });

    it('declares no contact fields, so a smuggled one is stripped before the handler', () => {
      const declared = Object.keys(
        new (registered.create_booking_hold.argsType as new () => object)(),
      );
      const schema = registered.create_booking_hold.definition.parameters as {
        properties: Record<string, unknown>;
      };
      expect(Object.keys(schema.properties)).toEqual(['draftId']);
      expect(declared).not.toContain('contactEmail');
    });

    it('returns the reference and countdown, but no invented URL', async () => {
      const result = (await hold()) as {
        reference: string;
        totalUsd: number;
        secondsRemaining: number;
      };

      expect(result).toMatchObject({
        reference: 'DLG-2026-0007',
        totalUsd: 74,
        secondsRemaining: 900,
      });
    });

    it('lets a sold-out hold fail with the booking service´s own message', async () => {
      const conflict = Object.assign(new Error('Some items are no longer available'), {
        code: ErrorCode.AVAILABILITY_UNAVAILABLE,
      });
      bookings.create.mockRejectedValue(conflict);

      await expect(hold()).rejects.toThrow('Some items are no longer available');
    });

    it('holds the conversation´s current plan when the model forgets the id', async () => {
      // Observed live: the model dropped the draftId a turn after creating it,
      // stranding a traveller who had already said yes.
      await registered.create_booking_hold.handler({}, { ...context, draftId: 'draft-9' });

      const [, , dto] = bookings.create.mock.calls[0] as [unknown, unknown, { draftId: string }];
      expect(dto.draftId).toBe('draft-9');
    });

    it('explains that there is nothing to hold when no plan exists', async () => {
      await expect(registered.create_booking_hold.handler({}, context)).rejects.toThrow(
        /no saved plan to hold/i,
      );
      expect(bookings.create).not.toHaveBeenCalled();
    });

    it('refuses when the account has vanished', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(hold()).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
      expect(bookings.create).not.toHaveBeenCalled();
    });
  });
});
