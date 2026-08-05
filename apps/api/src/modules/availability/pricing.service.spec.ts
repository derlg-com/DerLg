import { ItemType, PricingMode } from '@prisma/client';

import { ErrorCode } from '../../common/errors/error-codes';
import { CatalogRefResolver, ResolvedRefs } from '../catalog/catalog-ref.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { unitsFor } from './interfaces/availability.interface';
import { PackagePricingBasis, PricingService } from './pricing.service';

import type { PriceableItem } from './interfaces/availability.interface';

/** Builds a ResolvedRefs map without touching the database. */
function resolvedWith(overrides: {
  places?: Array<{ id: string; entranceFeeCents: number }>;
  hotels?: Array<{ id: string; pricePerNightCents: number }>;
  transports?: Array<{ id: string; pricePerSeatCents: number }>;
  guides?: Array<{ id: string; pricePerDayCents: number }>;
}): ResolvedRefs {
  return {
    places: new Map((overrides.places ?? []).map((row) => [row.id, row as never])),
    hotels: new Map((overrides.hotels ?? []).map((row) => [row.id, row as never])),
    transports: new Map((overrides.transports ?? []).map((row) => [row.id, row as never])),
    guides: new Map((overrides.guides ?? []).map((row) => [row.id, row as never])),
  };
}

function item(overrides: Partial<PriceableItem>): PriceableItem {
  return {
    dayNumber: 1,
    type: ItemType.PLACE,
    refId: 'place-1',
    title: 'Angkor Wat',
    bookable: true,
    ...overrides,
  };
}

const perPersonBasis: PackagePricingBasis = {
  id: 'pkg-1',
  pricingMode: PricingMode.PER_PERSON,
  basePriceCents: 18_900,
  minGroupSize: 1,
  maxGroupSize: 16,
};

const perGroupBasis: PackagePricingBasis = {
  id: 'pkg-2',
  pricingMode: PricingMode.PER_GROUP,
  basePriceCents: 128_000,
  minGroupSize: 2,
  maxGroupSize: 8,
};

describe('unitsFor', () => {
  it('charges places and transport per traveller', () => {
    expect(unitsFor(ItemType.PLACE, 4)).toBe(4);
    expect(unitsFor(ItemType.TRANSPORT, 4)).toBe(4);
  });

  it('charges hotels per room at double occupancy, rounding up', () => {
    expect(unitsFor(ItemType.HOTEL, 1)).toBe(1);
    expect(unitsFor(ItemType.HOTEL, 2)).toBe(1);
    expect(unitsFor(ItemType.HOTEL, 3)).toBe(2);
    expect(unitsFor(ItemType.HOTEL, 8)).toBe(4);
  });

  it('charges one guide per day regardless of party size', () => {
    expect(unitsFor(ItemType.GUIDE, 1)).toBe(1);
    expect(unitsFor(ItemType.GUIDE, 8)).toBe(1);
  });

  it('never charges for custom free-form entries', () => {
    expect(unitsFor(ItemType.CUSTOM, 8)).toBe(0);
  });
});

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService(new CatalogRefResolver({} as unknown as PrismaService));
  });

  describe('baseCentsFor', () => {
    it('multiplies a per-person package by the party size', () => {
      expect(service.baseCentsFor(perPersonBasis, 3)).toBe(56_700);
    });

    it('charges a per-group package once', () => {
      expect(service.baseCentsFor(perGroupBasis, 6)).toBe(128_000);
    });

    it('is zero for a from-scratch journey', () => {
      expect(service.baseCentsFor(null, 4)).toBe(0);
    });
  });

  describe('assertGroupSize', () => {
    it('accepts a party inside the allowed range, including the bounds', () => {
      expect(() => service.assertGroupSize(perGroupBasis, 2)).not.toThrow();
      expect(() => service.assertGroupSize(perGroupBasis, 4)).not.toThrow();
      expect(() => service.assertGroupSize(perGroupBasis, 8)).not.toThrow();
    });

    it.each([1, 9, 20])('rejects a party of %i with a stable error code', (guests) => {
      expect(() => service.assertGroupSize(perGroupBasis, guests)).toThrow(
        expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }),
      );
    });
  });

  describe('lineItems', () => {
    it('prices each type from its own column with the right quantity', () => {
      const resolved = resolvedWith({
        places: [{ id: 'place-1', entranceFeeCents: 3700 }],
        hotels: [{ id: 'hotel-1', pricePerNightCents: 5400 }],
        transports: [{ id: 'transport-1', pricePerSeatCents: 1800 }],
        guides: [{ id: 'guide-1', pricePerDayCents: 4500 }],
      });

      const lines = service.lineItems(
        [
          item({ type: ItemType.PLACE, refId: 'place-1' }),
          item({ type: ItemType.HOTEL, refId: 'hotel-1', title: 'Hotel' }),
          item({ type: ItemType.TRANSPORT, refId: 'transport-1', title: 'Bus' }),
          item({ type: ItemType.GUIDE, refId: 'guide-1', title: 'Guide' }),
        ],
        4,
        resolved,
      );

      expect(lines).toEqual([
        expect.objectContaining({ type: 'PLACE', quantity: 4, unitPriceCents: 3700, totalCents: 14_800 }),
        expect.objectContaining({ type: 'HOTEL', quantity: 2, unitPriceCents: 5400, totalCents: 10_800 }),
        expect.objectContaining({ type: 'TRANSPORT', quantity: 4, unitPriceCents: 1800, totalCents: 7200 }),
        expect.objectContaining({ type: 'GUIDE', quantity: 1, unitPriceCents: 4500, totalCents: 4500 }),
      ]);
    });

    it('skips CUSTOM and non-bookable items entirely', () => {
      const resolved = resolvedWith({ places: [{ id: 'place-1', entranceFeeCents: 3700 }] });

      const lines = service.lineItems(
        [
          item({ type: ItemType.CUSTOM, refId: null, title: 'Pool afternoon', bookable: false }),
          item({ type: ItemType.PLACE, refId: 'place-1', bookable: false }),
        ],
        2,
        resolved,
      );

      expect(lines).toEqual([]);
    });

    it('drops free items so the breakdown has no zero-value noise', () => {
      const resolved = resolvedWith({ places: [{ id: 'place-free', entranceFeeCents: 0 }] });

      expect(service.lineItems([item({ refId: 'place-free' })], 2, resolved)).toEqual([]);
    });

    it('adds an item-level extra charge on top of the catalogue price', () => {
      const resolved = resolvedWith({ places: [{ id: 'place-1', entranceFeeCents: 1000 }] });

      const [line] = service.lineItems([item({ extraPriceCents: 500 })], 2, resolved);

      expect(line).toMatchObject({ unitPriceCents: 1500, quantity: 2, totalCents: 3000 });
    });

    it('honours an explicit quantity override', () => {
      const resolved = resolvedWith({ hotels: [{ id: 'hotel-1', pricePerNightCents: 5000 }] });

      const [line] = service.lineItems(
        [item({ type: ItemType.HOTEL, refId: 'hotel-1', quantity: 3 })],
        2,
        resolved,
      );

      expect(line).toMatchObject({ quantity: 3, totalCents: 15_000 });
    });

    it('ignores a reference that no longer exists rather than throwing', () => {
      expect(service.lineItems([item({ refId: 'deleted' })], 2, resolvedWith({}))).toEqual([]);
    });
  });

  describe('quote', () => {
    const resolved = resolvedWith({
      places: [{ id: 'place-1', entranceFeeCents: 3700 }],
      hotels: [
        { id: 'hotel-cheap', pricePerNightCents: 2800 },
        { id: 'hotel-pricey', pricePerNightCents: 18_500 },
      ],
    });

    const template = [
      item({ refId: 'place-1' }),
      item({ type: ItemType.HOTEL, refId: 'hotel-cheap', title: 'Lotus Lodge' }),
    ];

    it('returns the base price unchanged when nothing was customised', () => {
      const quote = service.quote(
        { guests: 2, items: template, basis: perPersonBasis, templateItems: template },
        resolved,
      );

      expect(quote).toMatchObject({
        guests: 2,
        baseCents: 37_800,
        deltaCents: 0,
        totalCents: 37_800,
        currency: 'USD',
      });
      // Item costs are shown for transparency but never added on top of base.
      expect(quote.itemsCents).toBe(quote.templateItemsCents);
    });

    it('adds the difference when the traveller upgrades a hotel', () => {
      const upgraded = [
        item({ refId: 'place-1' }),
        item({ type: ItemType.HOTEL, refId: 'hotel-pricey', title: 'Sokha Heritage' }),
      ];

      const quote = service.quote(
        { guests: 2, items: upgraded, basis: perPersonBasis, templateItems: template },
        resolved,
      );

      // One room either way: 18500 - 2800 = 15700 more.
      expect(quote.deltaCents).toBe(15_700);
      expect(quote.totalCents).toBe(37_800 + 15_700);
    });

    it('subtracts the difference when the traveller removes a paid item', () => {
      const quote = service.quote(
        { guests: 2, items: [item({ refId: 'place-1' })], basis: perPersonBasis, templateItems: template },
        resolved,
      );

      expect(quote.deltaCents).toBe(-2800);
      expect(quote.totalCents).toBe(37_800 - 2800);
    });

    it('never lets a discount drive the total below zero', () => {
      const quote = service.quote(
        {
          guests: 1,
          items: [],
          basis: { ...perPersonBasis, basePriceCents: 1000 },
          templateItems: [item({ type: ItemType.HOTEL, refId: 'hotel-pricey', title: 'Suite' })],
        },
        resolved,
      );

      expect(quote.totalCents).toBe(0);
    });

    it('prices a from-scratch journey as the sum of its items', () => {
      const quote = service.quote(
        {
          guests: 2,
          items: [item({ type: ItemType.HOTEL, refId: 'hotel-cheap', title: 'Lotus Lodge' })],
          basis: null,
        },
        resolved,
      );

      expect(quote).toMatchObject({ baseCents: 0, itemsCents: 2800, deltaCents: 0, totalCents: 2800 });
    });

    it('rejects a party size the package cannot take', () => {
      expect(() =>
        service.quote({ guests: 12, items: template, basis: perGroupBasis }, resolved),
      ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }));
    });

    it('produces integer cents only — never floating point money', () => {
      const quote = service.quote(
        { guests: 3, items: template, basis: perPersonBasis, templateItems: template },
        resolved,
      );

      for (const value of [quote.baseCents, quote.itemsCents, quote.totalCents, quote.deltaCents]) {
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });
});
