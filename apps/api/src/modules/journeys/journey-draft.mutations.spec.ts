import { ItemType } from '@prisma/client';

import { ErrorCode } from '../../common/errors/error-codes';
import { DraftDay, DraftItem, DraftSnapshot } from './interfaces/journey-draft.interface';
import {
  MAX_ITEMS_PER_DAY,
  applyOperation,
  applyOperations,
  assertNoTimeConflicts,
  itemFromInput,
  renumberDays,
} from './journey-draft.mutations';

import type { DraftOperationDto } from './dto/journey-draft.dto';

function makeItem(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    itemKey: 'it_a',
    type: ItemType.PLACE,
    refId: 'place-1',
    title: 'Angkor Wat',
    description: '',
    startTime: '08:00',
    durationMinutes: 60,
    extraPriceCents: 0,
    bookable: true,
    unitPriceCents: 3700,
    referenceLabel: 'Angkor Wat',
    ...overrides,
  };
}

function makeSnapshot(days: Array<Partial<DraftDay>> = []): DraftSnapshot {
  return {
    templateItems: [],
    days:
      days.length > 0
        ? days.map((day, index) => ({
            dayKey: day.dayKey ?? `dy_${index + 1}`,
            dayNumber: index + 1,
            title: day.title ?? `Day ${index + 1}`,
            summary: day.summary ?? '',
            items: day.items ?? [],
          }))
        : [{ dayKey: 'dy_1', dayNumber: 1, title: 'Day 1', summary: '', items: [] }],
  };
}

const context = { guests: 2, startDate: '2027-05-01', title: 'My journey' };

function op(operation: Partial<DraftOperationDto>): DraftOperationDto {
  return operation as DraftOperationDto;
}

describe('renumberDays', () => {
  it('renumbers to a contiguous 1..n sequence', () => {
    const days = makeSnapshot([{ dayKey: 'a' }, { dayKey: 'b' }, { dayKey: 'c' }]).days;
    const shuffled = [days[2], days[0], days[1]];

    expect(renumberDays(shuffled).map((day) => day.dayNumber)).toEqual([1, 2, 3]);
    expect(renumberDays(shuffled).map((day) => day.dayKey)).toEqual(['c', 'a', 'b']);
  });
});

describe('itemFromInput', () => {
  it('builds a bookable item with a fresh key', () => {
    const item = itemFromInput({ type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' });

    expect(item).toMatchObject({
      type: 'HOTEL',
      refId: 'hotel-1',
      bookable: true,
      durationMinutes: 60,
    });
    expect(item.itemKey).toMatch(/^it_/);
  });

  it('forces CUSTOM items to be free and non-bookable, discarding any refId', () => {
    const item = itemFromInput({
      type: 'CUSTOM',
      refId: 'sneaky-ref',
      title: 'Pool afternoon',
      extraPriceCents: 9999,
    });

    expect(item).toMatchObject({ refId: null, bookable: false, extraPriceCents: 0 });
  });

  it('refuses a bookable item with no catalogue reference', () => {
    expect(() => itemFromInput({ type: 'HOTEL', title: 'Mystery hotel' })).toThrow(
      expect.objectContaining({ code: ErrorCode.DRAFT_INVALID_MUTATION }),
    );
  });
});

describe('assertNoTimeConflicts', () => {
  it('accepts back-to-back activities', () => {
    const day = makeSnapshot([
      {
        items: [
          makeItem({ itemKey: 'a', startTime: '08:00', durationMinutes: 60 }),
          makeItem({ itemKey: 'b', startTime: '09:00', durationMinutes: 30 }),
        ],
      },
    ]).days[0];

    expect(() => assertNoTimeConflicts(day)).not.toThrow();
  });

  it('rejects overlapping activities and names both', () => {
    const day = makeSnapshot([
      {
        items: [
          makeItem({ itemKey: 'a', title: 'Angkor Wat', startTime: '08:00', durationMinutes: 120 }),
          makeItem({ itemKey: 'b', title: 'Bayon', startTime: '09:00', durationMinutes: 60 }),
        ],
      },
    ]).days[0];

    expect(() => assertNoTimeConflicts(day)).toThrow(/overlaps/);
  });

  it('exempts day-spanning resources (hotel, transport, guide) and unscheduled items', () => {
    const day = makeSnapshot([
      {
        items: [
          makeItem({ itemKey: 'a', type: ItemType.HOTEL, startTime: '14:00', durationMinutes: 900 }),
          // A private tuk-tuk hired for the whole day runs alongside the visits.
          makeItem({
            itemKey: 'b',
            type: ItemType.TRANSPORT,
            startTime: '05:00',
            durationMinutes: 600,
          }),
          makeItem({ itemKey: 'c', type: ItemType.GUIDE, startTime: '05:00', durationMinutes: 600 }),
          makeItem({ itemKey: 'd', startTime: '05:20', durationMinutes: 180 }),
          makeItem({ itemKey: 'e', startTime: null }),
        ],
      },
    ]).days[0];

    expect(() => assertNoTimeConflicts(day)).not.toThrow();
  });

  it('still rejects two visits in the same slot', () => {
    const day = makeSnapshot([
      {
        items: [
          makeItem({ itemKey: 'a', title: 'Angkor Wat', startTime: '08:00', durationMinutes: 120 }),
          makeItem({ itemKey: 'b', title: 'Free time', type: ItemType.CUSTOM, refId: null, bookable: false, startTime: '09:00', durationMinutes: 60 }),
        ],
      },
    ]).days[0];

    expect(() => assertNoTimeConflicts(day)).toThrow(/overlaps/);
  });
});

describe('applyOperation', () => {
  describe('reorder_days', () => {
    it('reorders and renumbers', () => {
      const snapshot = makeSnapshot([{ dayKey: 'a' }, { dayKey: 'b' }, { dayKey: 'c' }]);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({ op: 'reorder_days', dayKeys: ['c', 'a', 'b'] }),
      );

      expect(next.days.map((day) => [day.dayKey, day.dayNumber])).toEqual([
        ['c', 1],
        ['a', 2],
        ['b', 3],
      ]);
    });

    it('does not mutate the original snapshot', () => {
      const snapshot = makeSnapshot([{ dayKey: 'a' }, { dayKey: 'b' }]);

      applyOperation(snapshot, context, op({ op: 'reorder_days', dayKeys: ['b', 'a'] }));

      expect(snapshot.days.map((day) => day.dayKey)).toEqual(['a', 'b']);
    });

    it('rejects a partial or duplicated ordering', () => {
      const snapshot = makeSnapshot([{ dayKey: 'a' }, { dayKey: 'b' }]);

      expect(() =>
        applyOperation(snapshot, context, op({ op: 'reorder_days', dayKeys: ['a'] })),
      ).toThrow(expect.objectContaining({ code: ErrorCode.DRAFT_INVALID_MUTATION }));
      expect(() =>
        applyOperation(snapshot, context, op({ op: 'reorder_days', dayKeys: ['a', 'a'] })),
      ).toThrow(/every day exactly once/);
    });
  });

  describe('add_day and remove_day', () => {
    it('appends a blank day by default', () => {
      const { snapshot } = applyOperation(makeSnapshot(), context, op({ op: 'add_day' }));

      expect(snapshot.days).toHaveLength(2);
      expect(snapshot.days[1]).toMatchObject({ dayNumber: 2, items: [] });
    });

    it('inserts at a requested position and renumbers', () => {
      const snapshot = makeSnapshot([{ dayKey: 'a' }, { dayKey: 'b' }]);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({ op: 'add_day', position: 1, title: 'Inserted' }),
      );

      expect(next.days.map((day) => day.title)).toEqual(['Day 1', 'Inserted', 'Day 2']);
      expect(next.days.map((day) => day.dayNumber)).toEqual([1, 2, 3]);
    });

    it('removes an empty day without confirmation', () => {
      const snapshot = makeSnapshot([{ dayKey: 'a' }, { dayKey: 'b' }]);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({ op: 'remove_day', dayKey: 'b' }),
      );

      expect(next.days.map((day) => day.dayKey)).toEqual(['a']);
    });

    it('requires confirmation to remove a day that still has activities', () => {
      const snapshot = makeSnapshot([{ dayKey: 'a' }, { dayKey: 'b', items: [makeItem()] }]);

      expect(() =>
        applyOperation(snapshot, context, op({ op: 'remove_day', dayKey: 'b' })),
      ).toThrow(/Confirm removal/);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({ op: 'remove_day', dayKey: 'b', confirmRemoval: true }),
      );
      expect(next.days).toHaveLength(1);
    });

    it('refuses to remove the last remaining day', () => {
      expect(() =>
        applyOperation(makeSnapshot(), context, op({ op: 'remove_day', dayKey: 'dy_1' })),
      ).toThrow(/at least one day/);
    });

    it('rejects an unknown day key', () => {
      expect(() =>
        applyOperation(makeSnapshot(), context, op({ op: 'remove_day', dayKey: 'nope' })),
      ).toThrow(/not part of this journey/);
    });
  });

  describe('items', () => {
    it('adds an item at the end of a day', () => {
      const { snapshot } = applyOperation(
        makeSnapshot([{ dayKey: 'a', items: [makeItem({ itemKey: 'x', startTime: '08:00' })] }]),
        context,
        op({
          op: 'add_item',
          dayKey: 'a',
          item: { type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' },
        }),
      );

      expect(snapshot.days[0].items).toHaveLength(2);
      expect(snapshot.days[0].items[1]).toMatchObject({ type: 'HOTEL', title: 'Lotus Lodge' });
    });

    it('rejects an added item that collides with an existing time slot', () => {
      expect(() =>
        applyOperation(
          makeSnapshot([
            { dayKey: 'a', items: [makeItem({ startTime: '08:00', durationMinutes: 120 })] },
          ]),
          context,
          op({
            op: 'add_item',
            dayKey: 'a',
            item: {
              type: 'PLACE',
              refId: 'place-2',
              title: 'Bayon',
              startTime: '09:00',
              durationMinutes: 60,
            },
          }),
        ),
      ).toThrow(/overlaps/);
    });

    it('caps the number of activities in a single day', () => {
      const items = Array.from({ length: MAX_ITEMS_PER_DAY }, (_, index) =>
        makeItem({ itemKey: `it_${index}`, startTime: null }),
      );

      expect(() =>
        applyOperation(
          makeSnapshot([{ dayKey: 'a', items }]),
          context,
          op({ op: 'add_item', dayKey: 'a', item: { type: 'CUSTOM', title: 'One more' } }),
        ),
      ).toThrow(/at most/);
    });

    it('removes an item by key from whichever day holds it', () => {
      const snapshot = makeSnapshot([
        { dayKey: 'a', items: [makeItem({ itemKey: 'x' })] },
        { dayKey: 'b', items: [makeItem({ itemKey: 'y', startTime: null })] },
      ]);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({ op: 'remove_item', itemKey: 'y' }),
      );

      expect(next.days[0].items).toHaveLength(1);
      expect(next.days[1].items).toHaveLength(0);
    });

    it('replaces an item while keeping its key and schedule', () => {
      const snapshot = makeSnapshot([
        {
          dayKey: 'a',
          items: [makeItem({ itemKey: 'x', type: ItemType.HOTEL, refId: 'hotel-cheap', startTime: '14:00' })],
        },
      ]);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({
          op: 'replace_item',
          itemKey: 'x',
          item: { type: 'HOTEL', refId: 'hotel-lux', title: 'Sokha Heritage' },
        }),
      );

      expect(next.days[0].items[0]).toMatchObject({
        itemKey: 'x',
        refId: 'hotel-lux',
        title: 'Sokha Heritage',
        startTime: '14:00',
      });
    });

    it('moves an item between days', () => {
      const snapshot = makeSnapshot([
        { dayKey: 'a', items: [makeItem({ itemKey: 'x', startTime: null })] },
        { dayKey: 'b', items: [] },
      ]);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({ op: 'move_item', itemKey: 'x', toDayKey: 'b' }),
      );

      expect(next.days[0].items).toHaveLength(0);
      expect(next.days[1].items.map((item) => item.itemKey)).toEqual(['x']);
    });

    it('reorders within a day when moving to a position in the same day', () => {
      const snapshot = makeSnapshot([
        {
          dayKey: 'a',
          items: [
            makeItem({ itemKey: 'x', startTime: null }),
            makeItem({ itemKey: 'y', startTime: null }),
            makeItem({ itemKey: 'z', startTime: null }),
          ],
        },
      ]);

      const { snapshot: next } = applyOperation(
        snapshot,
        context,
        op({ op: 'move_item', itemKey: 'z', toDayKey: 'a', position: 0 }),
      );

      expect(next.days[0].items.map((item) => item.itemKey)).toEqual(['z', 'x', 'y']);
    });

    it('rejects an unknown item key', () => {
      expect(() =>
        applyOperation(makeSnapshot(), context, op({ op: 'remove_item', itemKey: 'ghost' })),
      ).toThrow(/not part of this journey/);
    });
  });

  describe('context operations', () => {
    it('updates the traveller count', () => {
      const { context: next } = applyOperation(
        makeSnapshot(),
        context,
        op({ op: 'set_guests', guests: 6 }),
      );

      expect(next.guests).toBe(6);
    });

    it('sets and clears the start date', () => {
      const set = applyOperation(
        makeSnapshot(),
        context,
        op({ op: 'set_start_date', startDate: '2027-06-01' }),
      );
      expect(set.context.startDate).toBe('2027-06-01');

      const cleared = applyOperation(makeSnapshot(), context, op({ op: 'set_start_date' }));
      expect(cleared.context.startDate).toBeNull();
    });

    it('renames the journey', () => {
      const { context: next } = applyOperation(
        makeSnapshot(),
        context,
        op({ op: 'set_title', title: 'Family temples trip' }),
      );

      expect(next.title).toBe('Family temples trip');
    });
  });
});

describe('applyOperations', () => {
  it('applies a batch in order, threading the result through', () => {
    const snapshot = makeSnapshot([{ dayKey: 'a' }]);

    const result = applyOperations(snapshot, context, [
      op({ op: 'add_day', title: 'Day two' }),
      op({ op: 'set_guests', guests: 4 }),
      op({
        op: 'add_item',
        dayKey: 'a',
        item: { type: 'CUSTOM', title: 'Free morning' },
      }),
    ]);

    expect(result.snapshot.days).toHaveLength(2);
    expect(result.context.guests).toBe(4);
    expect(result.snapshot.days[0].items[0]).toMatchObject({ bookable: false, refId: null });
  });

  it('fails the whole batch if any operation is invalid', () => {
    const snapshot = makeSnapshot([{ dayKey: 'a' }]);

    expect(() =>
      applyOperations(snapshot, context, [
        op({ op: 'add_day' }),
        op({ op: 'remove_day', dayKey: 'does-not-exist' }),
      ]),
    ).toThrow(expect.objectContaining({ code: ErrorCode.DRAFT_INVALID_MUTATION }));

    // The caller's snapshot is untouched, so a rejected patch cannot half-apply.
    expect(snapshot.days).toHaveLength(1);
  });
});
