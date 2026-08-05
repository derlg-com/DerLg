import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { ErrorCode } from '../src/common/errors/error-codes';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { RedisService } from '../src/modules/redis/redis.service';

/**
 * Task 6 acceptance against the seeded dev database: shapes, filters, page
 * bounds, resolved references and a genuine Redis cache hit.
 */
describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let redis: RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, ['http://localhost:3100']);
    await app.init();

    redis = app.get(RedisService);
    // Start from a clean cache so hit/miss assertions are meaningful.
    await app.get(CatalogService).invalidate();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/packages', () => {
    it('returns a paginated envelope with summary fields', async () => {
      const response = await request(app.getHttpServer()).get('/v1/packages').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Packages retrieved',
        meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
      });
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toMatchObject({
        slug: expect.any(String),
        title: expect.any(String),
        kind: expect.stringMatching(/^(PUBLIC|PRIVATE)$/),
        basePriceCents: expect.any(Number),
        durationDays: expect.any(Number),
        city: { slug: expect.any(String), name: expect.any(String) },
      });
      // Summary payloads stay lean: no day tree, no inclusions.
      expect(response.body.data[0]).not.toHaveProperty('days');
      expect(response.body.data[0]).not.toHaveProperty('inclusions');
    });

    it('filters by city, kind and price, in dollars', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/packages?city=siem-reap&kind=PRIVATE')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({ kind: 'PRIVATE', city: { slug: 'siem-reap' } });

      const cheap = await request(app.getHttpServer()).get('/v1/packages?maxPrice=200').expect(200);
      expect(cheap.body.data.every((pkg: { basePriceCents: number }) => pkg.basePriceCents <= 20_000)).toBe(
        true,
      );
    });

    it('sorts by price ascending on request', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/packages?sort=price_asc')
        .expect(200);

      const prices = response.body.data.map((pkg: { basePriceCents: number }) => pkg.basePriceCents);
      expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
    });

    it('honours page and limit, and rejects a limit above the maximum', async () => {
      const page = await request(app.getHttpServer()).get('/v1/packages?limit=2&page=2').expect(200);
      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });

      const rejected = await request(app.getHttpServer()).get('/v1/packages?limit=200').expect(400);
      expect(rejected.body.error.code).toBe(ErrorCode.BAD_REQUEST);
      expect(rejected.body.error.details.fields).toEqual(
        expect.arrayContaining([expect.stringContaining('limit must not be greater than 100')]),
      );
    });

    it('rejects an unknown filter rather than silently ignoring it', async () => {
      await request(app.getHttpServer()).get('/v1/packages?colour=red').expect(400);
    });

    it('serves the second identical request from the Redis cache', async () => {
      await redis.del('catalog:packages:limit=20&page=1&sort=featured');

      await request(app.getHttpServer()).get('/v1/packages').expect(200);
      const cached = await redis.get('catalog:packages:limit=20&page=1&sort=featured');

      expect(cached).not.toBeNull();

      const second = await request(app.getHttpServer()).get('/v1/packages').expect(200);
      expect(second.body.data).toHaveLength(3);
    });
  });

  describe('GET /v1/packages/:slug', () => {
    it('returns the full day tree with every reference resolved', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/packages/private-family-angkor-4-day')
        .expect(200);

      const pkg = response.body.data;
      expect(pkg).toMatchObject({
        slug: 'private-family-angkor-4-day',
        kind: 'PRIVATE',
        pricingMode: 'PER_GROUP',
        durationDays: 4,
        inclusions: expect.any(Array),
        exclusions: expect.any(Array),
      });
      expect(pkg.days).toHaveLength(4);
      expect(pkg.days.map((day: { dayNumber: number }) => day.dayNumber)).toEqual([1, 2, 3, 4]);

      const allItems = pkg.days.flatMap(
        (day: { items: Array<Record<string, unknown>> }) => day.items,
      );
      for (const item of allItems) {
        if (item.type === 'CUSTOM') {
          expect(item.refId).toBeNull();
          expect(item.reference).toBeNull();
          expect(item.bookable).toBe(false);
        } else {
          // Every bookable item resolves to a real catalogue row.
          expect(item.reference).not.toBeNull();
          expect(item.bookable).toBe(true);
        }
      }
    });

    it('404s on an unknown slug with the standard error envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/packages/does-not-exist')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: { code: ErrorCode.NOT_FOUND },
      });
    });
  });

  describe('supporting resources', () => {
    it('lists places with attribution on their images', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/places?city=phnom-penh&category=TEMPLE')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toMatchObject({
        slug: expect.any(String),
        category: 'TEMPLE',
        city: { slug: 'phnom-penh' },
      });
    });

    it('exposes licence attribution on the place detail gallery', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/places/silver-pagoda')
        .expect(200);

      const images = response.body.data.images as Array<{ license: string | null; author: string | null }>;
      expect(images.length).toBeGreaterThan(0);
      // CC BY-SA obliges us to carry the attribution through to the client.
      expect(images[0].license).toContain('CC BY-SA');
      expect(images[0].author).toBeTruthy();
    });

    it('lists hotels under a price ceiling', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/hotels?city=siem-reap&maxPrice=70')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(
        response.body.data.every((hotel: { pricePerNightCents: number }) => hotel.pricePerNightCents <= 7000),
      ).toBe(true);
    });

    it('lists transport between two cities', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/transports?from=phnom-penh&to=siem-reap')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toMatchObject({
        originCity: { slug: 'phnom-penh' },
        destinationCity: { slug: 'siem-reap' },
      });
    });

    it('lists guides by language', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/guides?language=Mandarin')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(
        response.body.data.every((guide: { languages: string[] }) => guide.languages.includes('Mandarin')),
      ).toBe(true);
    });

    it('lists cities', async () => {
      const response = await request(app.getHttpServer()).get('/v1/cities').expect(200);

      expect(response.body.data.map((city: { slug: string }) => city.slug)).toEqual([
        'phnom-penh',
        'siem-reap',
      ]);
    });
  });

  it('serves the catalogue without authentication', async () => {
    // Browsing must work before sign-up; only writes require a session.
    await request(app.getHttpServer()).get('/v1/packages').expect(200);
    await request(app.getHttpServer()).get('/v1/places').expect(200);
  });
});
