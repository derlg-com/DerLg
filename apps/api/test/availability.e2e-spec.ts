import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { ErrorCode } from '../src/common/errors/error-codes';

/**
 * Task 8 acceptance against the seeded database, including a real contended
 * booking so the capacity arithmetic is exercised end to end.
 */
describe('Availability (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  let userId: string;
  let hotelId: string;
  let hotelRooms: number;
  let placeId: string;
  let packageId: string;
  const startDate = '2027-03-15';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, ['http://localhost:3100']);
    await app.init();

    const hotel = await prisma.hotel.findFirstOrThrow({
      where: { slug: 'lotus-lodge-siem-reap' },
      select: { id: true, roomsPerNight: true },
    });
    hotelId = hotel.id;
    hotelRooms = hotel.roomsPerNight;

    placeId = (await prisma.place.findFirstOrThrow({ where: { slug: 'angkor-wat' } })).id;
    packageId = (
      await prisma.package.findFirstOrThrow({ where: { slug: 'angkor-essentials-3-day' } })
    ).id;

    const user = await prisma.user.create({
      data: {
        email: `e2e-availability-${Date.now()}@derlg.test`,
        fullName: 'Availability Fixture',
        passwordHash: 'not-used',
      },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-availability-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  afterEach(async () => {
    await prisma.booking.deleteMany({ where: { userId } });
  });

  /** Creates a booking that holds `quantity` rooms of the fixture hotel. */
  async function holdRooms(quantity: number, status: 'HOLD' | 'EXPIRED' | 'CANCELLED' = 'HOLD') {
    return prisma.booking.create({
      data: {
        reference: `DLG-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId,
        status,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${startDate}T00:00:00.000Z`),
        guests: 2,
        totalCents: 1000,
        contactEmail: 'fixture@derlg.test',
        contactName: 'Fixture',
        snapshot: {},
        items: {
          create: {
            dayNumber: 1,
            type: 'HOTEL',
            refId: hotelId,
            title: 'Lotus Lodge',
            date: new Date(`${startDate}T00:00:00.000Z`),
            quantity,
            unitPriceCents: 2800,
            totalCents: 2800 * quantity,
            bookable: true,
          },
        },
      },
      select: { id: true },
    });
  }

  it('prices a package itinerary and reports it available', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({
        startDate,
        guests: 2,
        packageId,
        items: [
          { dayNumber: 1, type: 'PLACE', refId: placeId, title: 'Angkor Wat', itemKey: 'a' },
          { dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge', itemKey: 'b' },
        ],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: 'Availability checked',
      data: {
        availability: {
          startDate,
          guests: 2,
          available: true,
          unavailableCount: 0,
        },
        price: {
          // Angkor Essentials is $189 per person.
          baseCents: 37_800,
          currency: 'USD',
        },
      },
    });
    expect(response.body.data.availability.items).toHaveLength(2);
    expect(response.body.data.availability.items[0].itemKey).toBe('a');
    // $37 entrance x2 travellers + $28 room x1 = itemised transparently.
    expect(response.body.data.price.lines).toHaveLength(2);
  });

  it('counts an existing hold against remaining capacity', async () => {
    await holdRooms(hotelRooms - 1);

    const response = await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({
        startDate,
        guests: 2,
        items: [{ dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge' }],
      })
      .expect(200);

    expect(response.body.data.availability.items[0]).toMatchObject({
      capacity: hotelRooms,
      alreadyBooked: hotelRooms - 1,
      remaining: 1,
      available: true,
    });
  });

  it('reports sold out and offers alternatives once capacity is exhausted', async () => {
    await holdRooms(hotelRooms);

    const response = await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({
        startDate,
        guests: 2,
        items: [{ dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge' }],
      })
      .expect(200);

    const item = response.body.data.availability.items[0];
    expect(item).toMatchObject({ remaining: 0, available: false, reason: 'SOLD_OUT' });
    expect(response.body.data.availability.available).toBe(false);
    // Same-city substitutes with room are suggested.
    expect(item.alternatives.length).toBeGreaterThan(0);
    expect(item.alternatives[0]).toMatchObject({
      refId: expect.any(String),
      slug: expect.any(String),
      remaining: expect.any(Number),
    });
  });

  it('releases inventory held by expired and cancelled bookings', async () => {
    await holdRooms(hotelRooms, 'EXPIRED');
    await holdRooms(hotelRooms, 'CANCELLED');

    const response = await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({
        startDate,
        guests: 2,
        items: [{ dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge' }],
      })
      .expect(200);

    expect(response.body.data.availability.items[0]).toMatchObject({
      alreadyBooked: 0,
      available: true,
    });
  });

  it('does not count a booking the caller asked to exclude', async () => {
    const booking = await holdRooms(hotelRooms);

    const response = await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({
        startDate,
        guests: 2,
        excludeBookingId: booking.id,
        items: [{ dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge' }],
      })
      .expect(200);

    expect(response.body.data.availability.items[0]).toMatchObject({
      alreadyBooked: 0,
      available: true,
    });
  });

  it('confirm succeeds when everything is available', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/availability/confirm')
      .send({
        startDate,
        guests: 2,
        items: [{ dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge' }],
      })
      .expect(200);

    expect(response.body.data.availability.available).toBe(true);
  });

  it('confirm fails with 409 and per-item detail when something sold out', async () => {
    await holdRooms(hotelRooms);

    const response = await request(app.getHttpServer())
      .post('/v1/availability/confirm')
      .send({
        startDate,
        guests: 2,
        items: [{ dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge' }],
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.AVAILABILITY_UNAVAILABLE },
    });
    expect(response.body.error.details.items[0]).toMatchObject({
      refId: hotelId,
      reason: 'SOLD_OUT',
    });
  });

  it('rejects an invented reference id', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({
        startDate,
        guests: 2,
        items: [
          {
            dayNumber: 1,
            type: 'HOTEL',
            refId: '00000000-0000-4000-8000-000000000000',
            title: 'Hotel Imaginary',
          },
        ],
      })
      .expect(200);

    expect(response.body.data.availability.items[0]).toMatchObject({
      available: false,
      reason: 'MISSING_REFERENCE',
    });
  });

  it('rejects a party size the package cannot take', async () => {
    const privatePackage = await prisma.package.findFirstOrThrow({
      where: { slug: 'private-family-angkor-4-day' },
      select: { id: true, maxGroupSize: true },
    });

    const response = await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({
        startDate,
        guests: privatePackage.maxGroupSize + 5,
        packageId: privatePackage.id,
        items: [{ dayNumber: 1, type: 'HOTEL', refId: hotelId, title: 'Lotus Lodge' }],
      })
      .expect(400);

    expect(response.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('validates the request body', async () => {
    await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({ startDate: 'tomorrow', guests: 2, items: [] })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({ startDate, guests: 0, items: [] })
      .expect(400);

    // Unknown properties are rejected outright.
    await request(app.getHttpServer())
      .post('/v1/availability/check')
      .send({ startDate, guests: 2, items: [], sneaky: true })
      .expect(400);
  });
});
