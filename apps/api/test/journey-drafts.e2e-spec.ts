import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { ErrorCode } from '../src/common/errors/error-codes';

/**
 * Task 9 acceptance: a real customise session against the seeded catalogue —
 * create from a package, reorder, swap a hotel, add a day, watch the price move,
 * and prove another traveller cannot touch the draft.
 */
describe('Journey drafts (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  const password = 'Sup3rSecret';
  let ownerToken: string;
  let intruderToken: string;
  let draftId: string;

  let luxHotelId: string;
  let placeId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, ['http://localhost:3100']);
    await app.init();

    const register = async (label: string) => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `e2e-drafts-${label}-${Date.now()}@derlg.test`,
          password,
          fullName: `Draft ${label}`,
        })
        .expect(201);
      return response.body.data.accessToken as string;
    };

    ownerToken = await register('owner');
    intruderToken = await register('intruder');

    luxHotelId = (
      await prisma.hotel.findFirstOrThrow({ where: { slug: 'sokha-heritage-residence' } })
    ).id;
    placeId = (await prisma.place.findFirstOrThrow({ where: { slug: 'bayon-temple' } })).id;
  }, 60_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-drafts-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  function asOwner(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${ownerToken}`);
  }

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/v1/journey-drafts').expect(401);
    await request(app.getHttpServer()).post('/v1/journey-drafts').send({}).expect(401);
  });

  it('creates a draft from a package, copying the whole itinerary', async () => {
    const response = await asOwner('post', '/v1/journey-drafts')
      .send({ packageSlug: 'angkor-essentials-3-day', startDate: '2027-07-01', guests: 2 })
      .expect(201);

    const draft = response.body.data;
    draftId = draft.id;

    expect(draft).toMatchObject({
      title: 'Angkor Essentials',
      source: 'MANUAL',
      packageSlug: 'angkor-essentials-3-day',
      startDate: '2027-07-01',
      guests: 2,
    });
    expect(draft.days).toHaveLength(3);
    expect(draft.days.map((day: { dayNumber: number }) => day.dayNumber)).toEqual([1, 2, 3]);
    // $189pp x 2 travellers, nothing customised yet.
    expect(draft.price).toMatchObject({ baseCents: 37_800, deltaCents: 0, totalCents: 37_800 });
    // Every item carries a stable key and a resolved catalogue label.
    const items = draft.days.flatMap((day: { items: unknown[] }) => day.items);
    expect(items.every((item: { itemKey: string }) => item.itemKey.startsWith('it_'))).toBe(true);
    expect(
      items.some((item: { referenceLabel: string | null }) => item.referenceLabel === 'Angkor Wat'),
    ).toBe(true);
    // A dated draft reports live availability.
    expect(draft.availability).toMatchObject({ available: true, unavailableCount: 0 });
  });

  it('creates a blank draft when no package is given', async () => {
    const response = await asOwner('post', '/v1/journey-drafts').send({ guests: 3 }).expect(201);

    expect(response.body.data).toMatchObject({
      packageId: null,
      packageSlug: null,
      guests: 3,
    });
    expect(response.body.data.days).toHaveLength(1);
    expect(response.body.data.price.totalCents).toBe(0);
  });

  it('404s when creating from a package that does not exist', async () => {
    await asOwner('post', '/v1/journey-drafts').send({ packageSlug: 'no-such-package' }).expect(404);
  });

  it('reorders days and keeps the numbering contiguous', async () => {
    const before = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;
    const keys = before.days.map((day: { dayKey: string }) => day.dayKey);

    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({ operations: [{ op: 'reorder_days', dayKeys: [keys[2], keys[0], keys[1]] }] })
      .expect(200);

    const after = response.body.data;
    expect(after.days.map((day: { dayKey: string }) => day.dayKey)).toEqual([
      keys[2],
      keys[0],
      keys[1],
    ]);
    expect(after.days.map((day: { dayNumber: number }) => day.dayNumber)).toEqual([1, 2, 3]);
    // Reordering moves nothing in or out, so the price is unchanged.
    expect(after.price.deltaCents).toBe(0);
  });

  it('swaps a hotel and charges the difference', async () => {
    const draft = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;
    const hotelItem = draft.days
      .flatMap((day: { items: Array<{ itemKey: string; type: string }> }) => day.items)
      .find((item: { type: string }) => item.type === 'HOTEL');
    expect(hotelItem).toBeDefined();

    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({
        operations: [
          {
            op: 'replace_item',
            itemKey: hotelItem.itemKey,
            item: { type: 'HOTEL', refId: luxHotelId, title: 'Sokha Heritage Residence' },
          },
        ],
      })
      .expect(200);

    const after = response.body.data;
    // Angkor Terrace ($54) -> Sokha Heritage ($185), one room for two guests.
    expect(after.price.deltaCents).toBe(18_500 - 5400);
    expect(after.price.totalCents).toBe(37_800 + (18_500 - 5400));
    const swapped = after.days
      .flatMap((day: { items: Array<{ itemKey: string; referenceLabel: string }> }) => day.items)
      .find((item: { itemKey: string }) => item.itemKey === hotelItem.itemKey);
    expect(swapped.referenceLabel).toBe('Sokha Heritage Residence');
  });

  it('adds a day with an activity and reprices', async () => {
    const before = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;

    const withDay = (
      await asOwner('patch', `/v1/journey-drafts/${draftId}`)
        .send({ operations: [{ op: 'add_day', title: 'Extra temple day' }] })
        .expect(200)
    ).body.data;

    expect(withDay.days).toHaveLength(4);
    const newDayKey = withDay.days[3].dayKey;

    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({
        operations: [
          {
            op: 'add_item',
            dayKey: newDayKey,
            item: { type: 'PLACE', refId: placeId, title: 'Bayon Temple', startTime: '09:00' },
          },
        ],
      })
      .expect(200);

    const after = response.body.data;
    expect(after.days[3].items).toHaveLength(1);
    // Bayon has no entrance fee of its own, so the delta is unchanged.
    expect(after.price.deltaCents).toBe(before.price.deltaCents);
    // The new day extends the trip window.
    expect(after.availability.items.some((item: { date: string }) => item.date === '2027-07-04')).toBe(
      true,
    );
  });

  it('adds free time that is never charged for', async () => {
    const draft = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;
    const before = draft.price.totalCents;

    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({
        operations: [
          {
            op: 'add_item',
            dayKey: draft.days[0].dayKey,
            item: { type: 'CUSTOM', title: 'Slow morning', extraPriceCents: 5000 },
          },
        ],
      })
      .expect(200);

    const added = response.body.data.days[0].items.find(
      (item: { title: string }) => item.title === 'Slow morning',
    );
    expect(added).toMatchObject({ bookable: false, refId: null, unitPriceCents: 0 });
    expect(response.body.data.price.totalCents).toBe(before);
  });

  it('changes the traveller count and rescales the base price', async () => {
    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({ operations: [{ op: 'set_guests', guests: 4 }] })
      .expect(200);

    expect(response.body.data.guests).toBe(4);
    // 4 x $189.
    expect(response.body.data.price.baseCents).toBe(75_600);
  });

  it('rejects a forged reference id and leaves the draft untouched', async () => {
    const before = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;

    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({
        operations: [
          {
            op: 'add_item',
            dayKey: before.days[0].dayKey,
            item: {
              type: 'HOTEL',
              refId: '00000000-0000-4000-8000-000000000000',
              title: 'Hotel Imaginary',
            },
          },
        ],
      })
      .expect(400);

    expect(response.body.error.code).toBe(ErrorCode.CATALOG_UNKNOWN_REFERENCE);

    const after = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.days[0].items).toHaveLength(before.days[0].items.length);
  });

  it('rejects an overlapping activity', async () => {
    const draft = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;
    const dayWithSchedule = draft.days.find((day: { items: Array<{ startTime: string | null }> }) =>
      day.items.some((item) => item.startTime !== null),
    );
    const scheduled = dayWithSchedule.items.find(
      (item: { startTime: string | null }) => item.startTime !== null,
    );

    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({
        operations: [
          {
            op: 'add_item',
            dayKey: dayWithSchedule.dayKey,
            item: {
              type: 'PLACE',
              refId: placeId,
              title: 'Colliding visit',
              startTime: scheduled.startTime,
              durationMinutes: 60,
            },
          },
        ],
      })
      .expect(400);

    expect(response.body.error.code).toBe(ErrorCode.DRAFT_INVALID_MUTATION);
  });

  it('refuses to remove a day with activities unless confirmed', async () => {
    const draft = (await asOwner('get', `/v1/journey-drafts/${draftId}`).expect(200)).body.data;
    const populated = draft.days.find((day: { items: unknown[] }) => day.items.length > 0);

    await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({ operations: [{ op: 'remove_day', dayKey: populated.dayKey }] })
      .expect(400);

    const response = await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({
        operations: [{ op: 'remove_day', dayKey: populated.dayKey, confirmRemoval: true }],
      })
      .expect(200);

    expect(response.body.data.days).toHaveLength(draft.days.length - 1);
  });

  it('hides another traveller´s draft behind a 403', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/journey-drafts/${draftId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);

    expect(response.body.error.code).toBe(ErrorCode.FORBIDDEN);

    await request(app.getHttpServer())
      .patch(`/v1/journey-drafts/${draftId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      // A valid payload, so the 403 comes from the ownership check rather than
      // from DTO validation.
      .send({ operations: [{ op: 'set_guests', guests: 6 }] })
      .expect(403);
  });

  it('lists only the caller´s own drafts', async () => {
    const owner = (await asOwner('get', '/v1/journey-drafts').expect(200)).body.data;
    expect(owner.length).toBeGreaterThanOrEqual(2);

    const intruder = (
      await request(app.getHttpServer())
        .get('/v1/journey-drafts')
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(200)
    ).body.data;
    expect(intruder).toHaveLength(0);
  });

  it('deletes a draft', async () => {
    const created = (
      await asOwner('post', '/v1/journey-drafts').send({ guests: 2 }).expect(201)
    ).body.data;

    await asOwner('delete', `/v1/journey-drafts/${created.id}`).expect(200);
    await asOwner('get', `/v1/journey-drafts/${created.id}`).expect(404);
  });

  it('rejects a malformed draft id and unknown operations', async () => {
    await asOwner('get', '/v1/journey-drafts/not-a-uuid').expect(400);
    await asOwner('patch', `/v1/journey-drafts/${draftId}`)
      .send({ operations: [{ op: 'drop_database' }] })
      .expect(400);
  });
});
