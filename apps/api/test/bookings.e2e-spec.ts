import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { ErrorCode } from '../src/common/errors/error-codes';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { holdKey } from '../src/modules/bookings/interfaces/booking.interface';
import { RedisService } from '../src/modules/redis/redis.service';

/**
 * Task 11 acceptance against the real database: holds, references, countdown,
 * concurrency on the last seat, expiry sweeping, and ownership.
 */
describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let redis: RedisService;
  let bookings: BookingsService;
  const prisma = new PrismaClient();

  const password = 'Sup3rSecret';
  let ownerToken: string;
  let ownerId: string;
  let intruderToken: string;
  let scarceHotelId: string;

  const contact = { contactName: 'Sok Dara', contactEmail: 'sok@derlg.test' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // POST /v1/bookings is capped at 12/min in production because each call
      // takes row locks. This suite deliberately exceeds that while exercising
      // contention, so the counter is stubbed to never accumulate. The limit
      // itself is reviewed in Task 20.
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: () =>
          Promise.resolve({
            totalHits: 1,
            timeToExpire: 60,
            isBlocked: false,
            timeToBlockExpire: 0,
          }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, ['http://localhost:3100']);
    await app.init();

    redis = app.get(RedisService);
    bookings = app.get(BookingsService);

    const register = async (label: string) => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `e2e-bookings-${label}-${Date.now()}@derlg.test`,
          password,
          fullName: `Booking ${label}`,
        })
        .expect(201);
      return response.body.data as { accessToken: string; user: { id: string } };
    };

    const owner = await register('owner');
    ownerToken = owner.accessToken;
    ownerId = owner.user.id;
    intruderToken = (await register('intruder')).accessToken;

    // A deliberately scarce resource for the concurrency test: one room only.
    const city = await prisma.city.findFirstOrThrow({ where: { slug: 'siem-reap' } });
    const scarce = await prisma.hotel.upsert({
      where: { slug: 'e2e-scarce-inn' },
      create: {
        slug: 'e2e-scarce-inn',
        name: 'E2E Scarce Inn',
        cityId: city.id,
        description: 'Exactly one room, for testing contention.',
        address: 'Test Street',
        starRating: 2,
        pricePerNightCents: 5000,
        amenities: [],
        roomsPerNight: 1,
        latitude: 13.35,
        longitude: 103.85,
      },
      update: { roomsPerNight: 1 },
      select: { id: true },
    });
    scarceHotelId = scarce.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { user: { email: { startsWith: 'e2e-bookings-' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-bookings-' } } });
    await prisma.hotel.deleteMany({ where: { slug: 'e2e-scarce-inn' } });
    await prisma.$disconnect();
    await app.close();
  });

  function asOwner(method: 'get' | 'post', path: string) {
    return request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${ownerToken}`);
  }

  /** Creates a draft whose only bookable item is the one-room hotel. */
  async function scarceDraft(startDate: string, token = ownerToken) {
    const draft = (
      await request(app.getHttpServer())
        .post('/v1/journey-drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ guests: 2, startDate })
        .expect(201)
    ).body.data;

    await request(app.getHttpServer())
      .patch(`/v1/journey-drafts/${draft.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        operations: [
          {
            op: 'add_item',
            dayKey: draft.days[0].dayKey,
            item: { type: 'HOTEL', refId: scarceHotelId, title: 'E2E Scarce Inn' },
          },
        ],
      })
      .expect(200);

    return draft.id as string;
  }

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/v1/bookings').expect(401);
    await request(app.getHttpServer()).post('/v1/bookings').send(contact).expect(401);
  });

  it('holds a package booking with a reference, countdown and frozen snapshot', async () => {
    const response = await asOwner('post', '/v1/bookings')
      .send({ packageSlug: 'angkor-essentials-3-day', startDate: '2027-11-01', guests: 2, ...contact })
      .expect(201);

    const booking = response.body.data;
    expect(booking).toMatchObject({
      status: 'HOLD',
      guests: 2,
      startDate: '2027-11-01',
      // Three-day package: day 1 + 2 more.
      endDate: '2027-11-03',
      currency: 'USD',
      // $189pp x 2.
      totalCents: 37_800,
      contactName: 'Sok Dara',
    });
    expect(booking.reference).toMatch(/^DLG-\d{4}-\d{4,}$/);
    expect(booking.secondsRemaining).toBeGreaterThan(840);
    expect(booking.secondsRemaining).toBeLessThanOrEqual(900);
    // The itinerary is frozen into the booking, not referenced live.
    expect(booking.snapshot.days.length).toBe(3);
    expect(booking.snapshot.price.totalCents).toBe(37_800);
    // Inventory ledger rows exist for the bookable items only.
    expect(booking.items.length).toBeGreaterThan(0);
    expect(booking.items.every((item: { bookable: boolean }) => item.bookable)).toBe(true);
    expect(booking.checkInCode).toBeNull();

    // Redis carries the countdown with a matching TTL.
    const ttl = await redis.raw.ttl(holdKey(booking.id));
    expect(ttl).toBeGreaterThan(840);
    expect(ttl).toBeLessThanOrEqual(900);
  }, 30_000);

  it('books a customised draft at the draft´s own price', async () => {
    const draft = (
      await asOwner('post', '/v1/journey-drafts')
        .send({ packageSlug: 'angkor-essentials-3-day', startDate: '2027-11-10', guests: 2 })
        .expect(201)
    ).body.data;

    const luxHotel = await prisma.hotel.findFirstOrThrow({
      where: { slug: 'sokha-heritage-residence' },
      select: { id: true },
    });
    const hotelItem = draft.days
      .flatMap((day: { items: Array<{ itemKey: string; type: string }> }) => day.items)
      .find((item: { type: string }) => item.type === 'HOTEL');

    const upgraded = (
      await request(app.getHttpServer())
        .patch(`/v1/journey-drafts/${draft.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          operations: [
            {
              op: 'replace_item',
              itemKey: hotelItem.itemKey,
              item: { type: 'HOTEL', refId: luxHotel.id, title: 'Sokha Heritage Residence' },
            },
          ],
        })
        .expect(200)
    ).body.data;

    const booking = (
      await asOwner('post', '/v1/bookings').send({ draftId: draft.id, ...contact }).expect(201)
    ).body.data;

    // The booking charges what the editor last showed.
    expect(booking.totalCents).toBe(upgraded.price.totalCents);
    expect(booking.draftId).toBe(draft.id);
  }, 30_000);

  it('rejects a booking with neither a draft nor a package', async () => {
    await asOwner('post', '/v1/bookings').send(contact).expect(400);
  });

  it('requires a start date when booking a package directly', async () => {
    await asOwner('post', '/v1/bookings')
      .send({ packageSlug: 'angkor-essentials-3-day', ...contact })
      .expect(400);
  });

  it('validates the contact details', async () => {
    await asOwner('post', '/v1/bookings')
      .send({ packageSlug: 'angkor-essentials-3-day', startDate: '2027-11-01', contactName: 'A', contactEmail: 'nope' })
      .expect(400);
  });

  it('lets exactly one of two concurrent bookings take the last room', async () => {
    const startDate = '2027-12-01';
    const [draftA, draftB] = await Promise.all([scarceDraft(startDate), scarceDraft(startDate)]);

    const results = await Promise.allSettled([
      asOwner('post', '/v1/bookings').send({ draftId: draftA, ...contact }),
      asOwner('post', '/v1/bookings').send({ draftId: draftB, ...contact }),
    ]);

    const statuses = results.map((result) =>
      result.status === 'fulfilled' ? result.value.status : 0,
    );
    const created = statuses.filter((status) => status === 201);
    const rejected = statuses.filter((status) => status === 409);

    // One winner, one loser — never two holds on a single room.
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const held = await prisma.bookingItem.count({
      where: {
        refId: scarceHotelId,
        date: new Date(`${startDate}T00:00:00.000Z`),
        booking: { status: { in: ['HOLD', 'PENDING_PAYMENT', 'CONFIRMED'] } },
      },
    });
    expect(held).toBe(1);
  }, 60_000);

  it('reports the room as sold out to a later traveller', async () => {
    const startDate = '2027-12-05';
    const first = await scarceDraft(startDate);
    await asOwner('post', '/v1/bookings').send({ draftId: first, ...contact }).expect(201);

    const second = await scarceDraft(startDate);
    const response = await asOwner('post', '/v1/bookings')
      .send({ draftId: second, ...contact })
      .expect(409);

    expect(response.body.error.code).toBe(ErrorCode.AVAILABILITY_UNAVAILABLE);
  }, 40_000);

  it('expires a lapsed hold and returns the room to stock', async () => {
    const startDate = '2027-12-10';
    const draft = await scarceDraft(startDate);
    const booking = (
      await asOwner('post', '/v1/bookings').send({ draftId: draft, ...contact }).expect(201)
    ).body.data;

    // Backdate the hold so it has lapsed, then run the sweeper directly.
    await prisma.booking.update({
      where: { id: booking.id },
      data: { holdExpiresAt: new Date(Date.now() - 60_000) },
    });

    const expired = await bookings.expireLapsedHolds();
    expect(expired).toBeGreaterThanOrEqual(1);

    const after = (await asOwner('get', `/v1/bookings/${booking.id}`).expect(200)).body.data;
    expect(after.status).toBe('EXPIRED');
    expect(after.secondsRemaining).toBeNull();
    expect(await redis.raw.exists(holdKey(booking.id))).toBe(0);

    // The room is bookable again.
    const next = await scarceDraft(startDate);
    await asOwner('post', '/v1/bookings').send({ draftId: next, ...contact }).expect(201);
  }, 60_000);

  it('cancels a hold and frees the room immediately', async () => {
    const startDate = '2027-12-20';
    const draft = await scarceDraft(startDate);
    const booking = (
      await asOwner('post', '/v1/bookings').send({ draftId: draft, ...contact }).expect(201)
    ).body.data;

    const cancelled = (await asOwner('post', `/v1/bookings/${booking.id}/cancel`).expect(200)).body
      .data;
    expect(cancelled.status).toBe('CANCELLED');
    expect(await redis.raw.exists(holdKey(booking.id))).toBe(0);

    const next = await scarceDraft(startDate);
    await asOwner('post', '/v1/bookings').send({ draftId: next, ...contact }).expect(201);
  }, 60_000);

  it('refuses to cancel twice', async () => {
    const booking = (
      await asOwner('post', '/v1/bookings')
        .send({ packageSlug: 'phnom-penh-history-2-day', startDate: '2027-12-25', guests: 1, ...contact })
        .expect(201)
    ).body.data;

    await asOwner('post', `/v1/bookings/${booking.id}/cancel`).expect(200);
    const response = await asOwner('post', `/v1/bookings/${booking.id}/cancel`).expect(409);

    expect(response.body.error.code).toBe(ErrorCode.BOOKING_INVALID_STATE);
  }, 30_000);

  it('lists only the caller´s bookings and hides others behind 403', async () => {
    const mine = (await asOwner('get', '/v1/bookings').expect(200)).body.data;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((booking: { id: string }) => Boolean(booking.id))).toBe(true);

    const theirs = (
      await request(app.getHttpServer())
        .get('/v1/bookings')
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(200)
    ).body.data;
    expect(theirs).toHaveLength(0);

    await request(app.getHttpServer())
      .get(`/v1/bookings/${mine[0].id}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/v1/bookings/${mine[0].id}/cancel`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);
  }, 30_000);

  it('cannot book another traveller´s draft', async () => {
    const theirDraft = (
      await request(app.getHttpServer())
        .post('/v1/journey-drafts')
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({ guests: 2, startDate: '2027-12-28' })
        .expect(201)
    ).body.data;

    await asOwner('post', '/v1/bookings').send({ draftId: theirDraft.id, ...contact }).expect(403);
  }, 30_000);

  it('never trusts a client-supplied amount', async () => {
    // `totalCents` is not part of the DTO, so sending it is rejected outright.
    await asOwner('post', '/v1/bookings')
      .send({
        packageSlug: 'angkor-essentials-3-day',
        startDate: '2027-11-20',
        guests: 2,
        totalCents: 1,
        ...contact,
      })
      .expect(400);
  });

  it('gives every booking a distinct sequential reference', async () => {
    const created = await prisma.booking.findMany({
      where: { userId: ownerId },
      select: { reference: true },
    });

    const references = created.map((booking) => booking.reference);
    expect(new Set(references).size).toBe(references.length);
    expect(references.every((reference) => /^DLG-\d{4}-\d{4,}$/.test(reference))).toBe(true);
  });
});
