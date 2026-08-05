import { PrismaClient } from '@prisma/client';

import { runSeed } from './seed-runner';

/**
 * Integration test for the seed. Requires the dev database (`npm run db:up` +
 * `npm run db:migrate`). Image copying is disabled so the run stays fast; the
 * database rows — including attribution — are what we assert on.
 */
describe('runSeed', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function counts() {
    const [cities, places, placeImages, hotels, transports, guides, packages, days, items] =
      await Promise.all([
        prisma.city.count(),
        prisma.place.count(),
        prisma.placeImage.count(),
        prisma.hotel.count(),
        prisma.transport.count(),
        prisma.guide.count(),
        prisma.package.count(),
        prisma.packageDay.count(),
        prisma.packageDayItem.count(),
      ]);
    return { cities, places, placeImages, hotels, transports, guides, packages, days, items };
  }

  it('is idempotent: a second run leaves row counts unchanged', async () => {
    const first = await runSeed(prisma, { copyImages: false });
    const afterFirst = await counts();

    const second = await runSeed(prisma, { copyImages: false });
    const afterSecond = await counts();

    expect(afterSecond).toEqual(afterFirst);
    expect(second.places).toBe(first.places);
    expect(second.placeImages).toBe(first.placeImages);
  }, 120_000);

  it('seeds both cities and the full place catalogue', async () => {
    const summary = await runSeed(prisma, { copyImages: false });

    expect(summary.cities).toBe(2);
    expect(summary.places).toBeGreaterThanOrEqual(39);
    expect(summary.hotels).toBe(6);
    expect(summary.transports).toBe(4);
    expect(summary.guides).toBe(4);
    expect(summary.packages).toBe(3);

    const citySlugs = (await prisma.city.findMany({ select: { slug: true } })).map((c) => c.slug);
    expect(citySlugs.sort()).toEqual(['phnom-penh', 'siem-reap']);
  }, 120_000);

  it('preserves image attribution for folders that ship credits.txt', async () => {
    await runSeed(prisma, { copyImages: false });

    const silverPagoda = await prisma.place.findUnique({
      where: { slug: 'silver-pagoda' },
      select: {
        images: {
          orderBy: { position: 'asc' },
          select: { url: true, position: true, author: true, license: true, sourceUrl: true },
        },
      },
    });

    expect(silverPagoda?.images.length).toBeGreaterThan(0);
    expect(silverPagoda?.images[0]).toMatchObject({
      position: 0,
      license: expect.stringContaining('CC BY-SA'),
      author: expect.any(String),
      sourceUrl: expect.stringContaining('commons.wikimedia.org'),
    });
    // Positions must be contiguous from zero for the gallery renderer.
    expect(silverPagoda?.images.map((image) => image.position)).toEqual([0, 1, 2, 3, 4]);
  }, 120_000);

  it('links every package day item to a real catalogue row (or marks it non-bookable)', async () => {
    await runSeed(prisma, { copyImages: false });

    const items = await prisma.packageDayItem.findMany({
      select: { type: true, refId: true, bookable: true, title: true },
    });

    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      if (item.type === 'CUSTOM') {
        expect(item.refId).toBeNull();
        // Task 16 depends on this: AI-authored / free-form items are never bookable.
        expect(item.bookable).toBe(false);
      } else {
        expect(item.refId).not.toBeNull();
        expect(item.bookable).toBe(true);
      }
    }

    const placeIds = new Set((await prisma.place.findMany({ select: { id: true } })).map((p) => p.id));
    const hotelIds = new Set((await prisma.hotel.findMany({ select: { id: true } })).map((h) => h.id));
    const transportIds = new Set(
      (await prisma.transport.findMany({ select: { id: true } })).map((t) => t.id),
    );
    const guideIds = new Set((await prisma.guide.findMany({ select: { id: true } })).map((g) => g.id));

    for (const item of items) {
      if (item.refId === null) continue;
      const pool =
        item.type === 'PLACE'
          ? placeIds
          : item.type === 'HOTEL'
            ? hotelIds
            : item.type === 'TRANSPORT'
              ? transportIds
              : guideIds;
      expect(pool.has(item.refId)).toBe(true);
    }
  }, 120_000);

  it('gives every package a hero image and contiguous day numbers', async () => {
    await runSeed(prisma, { copyImages: false });

    const packages = await prisma.package.findMany({
      select: {
        slug: true,
        heroImageUrl: true,
        durationDays: true,
        days: { orderBy: { dayNumber: 'asc' }, select: { dayNumber: true } },
      },
    });

    expect(packages).toHaveLength(3);
    for (const pkg of packages) {
      expect(pkg.heroImageUrl).toMatch(/^\/seed\//);
      expect(pkg.days.map((day) => day.dayNumber)).toEqual(
        Array.from({ length: pkg.durationDays }, (_, index) => index + 1),
      );
    }
  }, 120_000);
});
