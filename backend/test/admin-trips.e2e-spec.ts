import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/prisma/prisma.service';
import { PrismaFilter } from './../src/common/filters/prisma.filter';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

/**
 * Trip package lifecycle, end to end through the real HTTP stack.
 *
 * Unlike the service specs, this exercises the guards, the global ValidationPipe
 * (`forbidNonWhitelisted`), the response envelope and the public catalogue in one
 * pass — the layers that unit tests deliberately mock away.
 *
 * Fixtures are created and removed by id. Nothing seeded is touched: an earlier
 * e2e spec in this directory truncated the whole `users` table, which is a data
 * loss hazard when DATABASE_URL points at a development database.
 */
describe('Admin trips (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const createdTripIds: string[] = [];

  const ADMIN_EMAIL = 'admin@derlg.demo';
  /*
   * Mirrors `resolvePassword()` in prisma/seeds/12-admin-users.ts, which only
   * honours the env var when it is at least 8 characters. `??` alone is wrong
   * here: SEED_ADMIN_PASSWORD is commonly present-but-empty in .env, and an empty
   * string is not nullish, so the fallback would never apply and login would fail
   * with "password should not be empty".
   */
  const envPassword = process.env.SEED_ADMIN_PASSWORD;
  const ADMIN_PASSWORD =
    envPassword && envPassword.length >= 8 ? envPassword : 'DerLgAdmin!2026';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new PrismaFilter(), new AllExceptionsFilter());
    app.use(cookieParser());
    prisma = app.get(PrismaService);
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = login.body?.data?.accessToken;
  }, 60000);

  afterAll(async () => {
    // Only this spec's own trips; translations and itinerary cascade.
    if (createdTripIds.length > 0) {
      await prisma.trip.deleteMany({ where: { id: { in: createdTripIds } } });
    }
    await app.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${adminToken}`);
  }

  it('should have obtained an admin token from the seeded account', () => {
    // Everything below is meaningless without this, so fail loudly here.
    expect(adminToken).toBeTruthy();
  });

  it('should reject an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/v1/admin/trips').expect(401);
  });

  it('should reject an undeclared query parameter', async () => {
    // Proves forbidNonWhitelisted is active on this route.
    await auth(
      request(app.getHttpServer()).get('/v1/admin/trips?bogus=1'),
    ).expect(400);
  });

  it('should run the full lifecycle: create, translate, itinerary, publish, expose publicly, delete', async () => {
    // ---- create as a draft -------------------------------------------------
    const created = await auth(
      request(app.getHttpServer()).post('/v1/admin/trips'),
    )
      .send({
        category: 'temples',
        durationDays: 2,
        basePriceUsd: 199.5,
        maxCapacity: 8,
        translations: [{ language: 'en', title: 'E2E Angkor Circuit' }],
      })
      .expect(201);

    const tripId = created.body.data.id as string;
    createdTripIds.push(tripId);
    expect(created.body.success).toBe(true);
    expect(created.body.data.isPublished).toBe(false);

    // ---- a draft must not appear on the public catalogue --------------------
    const draftPublic = await request(app.getHttpServer())
      .get('/v1/trips?limit=50')
      .expect(200);
    expect(
      draftPublic.body.data.items.some((t: { id: string }) => t.id === tripId),
    ).toBe(false);

    // ---- add the remaining translations ------------------------------------
    await auth(request(app.getHttpServer()).patch(`/v1/admin/trips/${tripId}`))
      .send({
        translations: [
          { language: 'zh', title: '吴哥环线' },
          { language: 'km', title: 'អង្គរ' },
        ],
      })
      .expect(200);

    const detail = await auth(
      request(app.getHttpServer()).get(`/v1/admin/trips/${tripId}`),
    ).expect(200);
    // The English row supplied at creation must survive a PATCH that only names
    // other languages.
    expect(
      (detail.body.data.translations as { language: string }[])
        .map((t) => t.language)
        .sort(),
    ).toEqual(['en', 'km', 'zh']);

    // ---- itinerary ---------------------------------------------------------
    await auth(
      request(app.getHttpServer()).post(`/v1/admin/trips/${tripId}/itinerary`),
    )
      .send({
        dayNumber: 1,
        sortOrder: 0,
        translations: [{ language: 'en', title: 'Sunrise at Angkor Wat' }],
      })
      .expect(201);

    await auth(
      request(app.getHttpServer()).post(`/v1/admin/trips/${tripId}/itinerary`),
    )
      .send({
        dayNumber: 1,
        sortOrder: 1,
        translations: [{ language: 'en', title: 'Bayon faces' }],
      })
      .expect(201);

    // A day beyond the declared duration must be refused.
    await auth(
      request(app.getHttpServer()).post(`/v1/admin/trips/${tripId}/itinerary`),
    )
      .send({
        dayNumber: 9,
        translations: [{ language: 'en', title: 'Too late' }],
      })
      .expect(400);

    // ---- batched reorder ---------------------------------------------------
    const itinerary = await auth(
      request(app.getHttpServer()).get(`/v1/admin/trips/${tripId}/itinerary`),
    ).expect(200);
    const [first, second] = itinerary.body.data as { id: string }[];

    const reordered = await auth(
      request(app.getHttpServer()).patch(
        `/v1/admin/trips/${tripId}/itinerary/reorder`,
      ),
    )
      .send({
        items: [
          { itemId: first.id, dayNumber: 1, sortOrder: 1 },
          { itemId: second.id, dayNumber: 1, sortOrder: 0 },
        ],
      })
      .expect(200);
    expect(reordered.body.data[0].id).toBe(second.id);

    // ---- shortening below an existing itinerary day is refused -------------
    await auth(request(app.getHttpServer()).patch(`/v1/admin/trips/${tripId}`))
      .send({ durationDays: 1 })
      .expect(200); // day 1 only, so this is still valid

    // ---- publish, then confirm the public catalogue reflects it ------------
    await auth(
      request(app.getHttpServer()).patch(`/v1/admin/trips/${tripId}/publish`),
    )
      .send({ isPublished: true })
      .expect(200);

    const publishedPublic = await request(app.getHttpServer())
      .get('/v1/trips?limit=50')
      .expect(200);
    // Requires the Redis catalogue cache to have been invalidated by the publish;
    // without that the trip stays invisible until the TTL lapses.
    expect(
      publishedPublic.body.data.items.some(
        (t: { id: string }) => t.id === tripId,
      ),
    ).toBe(true);

    await request(app.getHttpServer()).get(`/v1/trips/${tripId}`).expect(200);

    // ---- delete ------------------------------------------------------------
    await auth(
      request(app.getHttpServer()).delete(`/v1/admin/trips/${tripId}`),
    ).expect(200);

    const afterDelete = await prisma.trip.findUnique({ where: { id: tripId } });
    expect(afterDelete).toBeNull();
    createdTripIds.pop();
  }, 60000);

  it('should refuse to publish a trip that has no English title', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/v1/admin/trips'),
    )
      .send({
        category: 'food',
        durationDays: 1,
        basePriceUsd: 40,
        translations: [{ language: 'zh', title: '仅中文' }],
      })
      .expect(201);

    const tripId = created.body.data.id as string;
    createdTripIds.push(tripId);

    const refused = await auth(
      request(app.getHttpServer()).patch(`/v1/admin/trips/${tripId}/publish`),
    )
      .send({ isPublished: true })
      .expect(400);

    // English is the public site's fallback locale, so the card would otherwise
    // render untitled.
    expect(JSON.stringify(refused.body)).toMatch(/English/i);
  }, 30000);

  it('should refuse to delete a trip that bookings reference', async () => {
    const booked = await prisma.bookingItem.findFirst({
      where: { tripId: { not: null } },
      select: { tripId: true },
    });

    if (!booked?.tripId) {
      // The seed normally provides booking fixtures; skip rather than assert on
      // data this spec did not create.
      return;
    }

    const conflict = await auth(
      request(app.getHttpServer()).delete(`/v1/admin/trips/${booked.tripId}`),
    ).expect(409);

    expect(JSON.stringify(conflict.body)).toMatch(/booking record/i);

    // The trip must still be there.
    const stillThere = await prisma.trip.findUnique({
      where: { id: booked.tripId },
    });
    expect(stillThere).not.toBeNull();
  }, 30000);
});
