import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { ErrorCode } from '../src/common/errors/error-codes';

/**
 * Task 12 acceptance for the parts that need no Stripe account: the webhook is
 * reachable without a session but refuses anything it cannot verify, and the
 * intent endpoint enforces ownership and booking state.
 *
 * The live card journey (4242…) needs real test keys; see README.
 */
describe('Payments (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  let token: string;
  let bookingId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: () =>
          Promise.resolve({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app, ['http://localhost:3100']);
    await app.init();

    const registered = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `e2e-payments-${Date.now()}@derlg.test`,
        password: 'Sup3rSecret',
        fullName: 'Payment Tester',
      })
      .expect(201);
    token = registered.body.data.accessToken;

    const booking = await request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        packageSlug: 'angkor-essentials-3-day',
        startDate: '2028-06-01',
        guests: 2,
        contactName: 'Payment Tester',
        contactEmail: 'pay@derlg.test',
      })
      .expect(201);
    bookingId = booking.body.data.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { user: { email: { startsWith: 'e2e-payments-' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-payments-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /v1/payments/webhook', () => {
    it('is reachable without a session — Stripe cannot present a JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send({ id: 'evt_test', type: 'payment_intent.succeeded' });

      // Not 401: it fails on signature verification, which is the real gate.
      expect(response.status).not.toBe(401);
      expect([400, 503]).toContain(response.status);
    });

    it('rejects a payload with no signature header', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send({ id: 'evt_test', type: 'payment_intent.succeeded' });

      expect(response.body.error.code).toBe(ErrorCode.PAYMENT_SIGNATURE_INVALID);
    });

    it('rejects a forged signature', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1,v1=deadbeef')
        .send({ id: 'evt_forged', type: 'payment_intent.succeeded' });

      expect([400, 503]).toContain(response.status);
      expect(response.body.error.code).toBe(ErrorCode.PAYMENT_SIGNATURE_INVALID);
    });

    it('never confirms a booking from an unverified payload', async () => {
      await request(app.getHttpServer())
        .post('/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1,v1=deadbeef')
        .send({
          id: 'evt_forged_2',
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_forged', metadata: { bookingId } } },
        });

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { status: true, checkInCode: true },
      });
      expect(booking.status).not.toBe('CONFIRMED');
      expect(booking.checkInCode).toBeNull();
    });
  });

  describe('POST /v1/payments/:bookingId/intent', () => {
    it('requires a session', async () => {
      await request(app.getHttpServer()).post(`/v1/payments/${bookingId}/intent`).expect(401);
    });

    it('rejects a malformed booking id', async () => {
      await request(app.getHttpServer())
        .post('/v1/payments/not-a-uuid/intent')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('404s a booking that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/v1/payments/00000000-0000-4000-8000-000000000000/intent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('403s another traveller´s booking', async () => {
      const intruder = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `e2e-payments-intruder-${Date.now()}@derlg.test`,
          password: 'Sup3rSecret',
          fullName: 'Intruder',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/payments/${bookingId}/intent`)
        .set('Authorization', `Bearer ${intruder.body.data.accessToken}`)
        .expect(403);
    }, 30_000);

    it('reports 503 while Stripe is unconfigured rather than crashing', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/${bookingId}/intent`)
        .set('Authorization', `Bearer ${token}`);

      // With STRIPE_SECRET_KEY set this becomes a 201 with a client secret.
      if (response.status === 503) {
        expect(response.body.error.code).toBe(ErrorCode.PAYMENT_FAILED);
        expect(response.body.message).toMatch(/not configured/i);
      } else {
        expect(response.status).toBe(201);
        expect(response.body.data).toMatchObject({
          clientSecret: expect.any(String),
          amountCents: 37_800,
        });
      }
    });

    it('refuses to charge for a cancelled booking', async () => {
      const throwaway = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          packageSlug: 'phnom-penh-history-2-day',
          startDate: '2028-06-10',
          guests: 1,
          contactName: 'Payment Tester',
          contactEmail: 'pay@derlg.test',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/bookings/${throwaway.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/v1/payments/${throwaway.body.data.id}/intent`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);

      expect(response.body.error.code).toBe(ErrorCode.BOOKING_INVALID_STATE);
    }, 30_000);
  });

  describe('POST /v1/payments/:bookingId/refund-quote', () => {
    it('quotes a full refund for an unpaid booking far from departure', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/${bookingId}/refund-quote`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        tier: 'FULL',
        percentage: 100,
        // Nothing has been paid, so there is nothing to give back.
        amountCents: 0,
      });
      expect(response.body.data.daysUntilDeparture).toBeGreaterThan(7);
    });

    it('requires a session', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/${bookingId}/refund-quote`)
        .expect(401);
    });
  });
});
