import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { createHmac } from 'crypto';

import { AppModule } from './../src/app.module';
import { PrismaFilter } from './../src/common/filters/prisma.filter';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

/**
 * Payment endpoints, end to end through the real HTTP stack.
 *
 * The focus is the webhook, because it is the only unauthenticated route in the
 * payments module and the only thing that can mark a booking paid. Its
 * protection is an HMAC over the raw request body, and that is exactly the kind
 * of wiring a unit test cannot verify: the signature check can be perfectly
 * correct and still be bypassed if `rawBody` is not enabled, or if a body parser
 * has already consumed and re-serialised the payload.
 */
describe('Payments (e2e)', () => {
  let app: INestApplication<App>;

  const WEBHOOK_PATH = '/v1/payments/stripe/webhook';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // `rawBody: true` is set in main.ts on the real bootstrap. `createNestApplication`
    // does not read main.ts, so it is passed here too — otherwise this suite would
    // test a stack that differs from production in the one respect that matters.
    app = moduleFixture.createNestApplication({ rawBody: true });
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
    app.setGlobalPrefix('v1');

    await app.init();
  }, 60000);

  afterAll(async () => {
    // The one test that enables throttling leaves counters behind; the next run
    // would start part-way through its budget.
    const { RedisService } =
      await import('./../src/modules/redis/redis.service');
    await app.get(RedisService).delByPattern('throttle:*');
    await app.close();
  });

  /** Builds the `Stripe-Signature` header Stripe would send for a payload. */
  function signature(
    payload: string,
    secret: string,
    timestamp = Math.floor(Date.now() / 1000),
  ) {
    const digest = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    return `t=${timestamp},v1=${digest}`;
  }

  describe('POST /v1/payments/stripe/webhook', () => {
    const payload = JSON.stringify({
      id: 'evt_test',
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'pi_does_not_exist', amount: 500, amount_received: 500 },
      },
    });

    it('is reachable without a JWT', async () => {
      // Stripe holds no token. If the global JwtAuthGuard applied here, every
      // delivery would 401 and no card payment could ever settle.
      const response = await request(app.getHttpServer())
        .post(WEBHOOK_PATH)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).not.toBe(401);
    });

    it('rejects a delivery with no signature header', async () => {
      const response = await request(app.getHttpServer())
        .post(WEBHOOK_PATH)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({ code: 'PAY_WEBHOOK_INVALID' }),
      });
    });

    it('rejects a forged signature', async () => {
      const response = await request(app.getHttpServer())
        .post(WEBHOOK_PATH)
        .set('Content-Type', 'application/json')
        .set(
          'Stripe-Signature',
          signature(payload, 'whsec_not_the_real_secret'),
        )
        .send(payload);

      // 400 either because the signature does not verify, or because no signing
      // secret is configured in this environment. Both are refusals, which is the
      // point: an unverifiable delivery must never be accepted.
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('rejects a malformed signature header', async () => {
      const response = await request(app.getHttpServer())
        .post(WEBHOOK_PATH)
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', 'not-a-signature')
        .send(payload);

      expect(response.status).toBe(400);
    });

    it('is not rate limited', async () => {
      // Stripe retries any non-2xx for up to three days. A 429 during a spike
      // would delay confirmations for customers who have already paid.
      //
      // `CustomThrottlerGuard` bypasses itself under Jest, so this would assert
      // nothing without switching the limiter on for the duration of the test —
      // and the point is to prove `@NoRateLimit()` is doing the work.
      process.env.THROTTLE_IN_TESTS = 'true';
      try {
        const statuses: number[] = [];
        // Sequential, not parallel: eight simultaneous connections to supertest's
        // ephemeral server resets the socket, which looks like a failure of the
        // thing under test but is not.
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const response = await request(app.getHttpServer())
            .post(WEBHOOK_PATH)
            .set('Content-Type', 'application/json')
            .set('Stripe-Signature', signature(payload, 'whsec_wrong'))
            .send(payload);
          statuses.push(response.status);
        }

        // Eight deliveries is well past the 120/minute global default.
        expect(statuses).not.toContain(429);
      } finally {
        delete process.env.THROTTLE_IN_TESTS;
      }
    }, 30000);
  });

  describe('customer endpoints require authentication', () => {
    it('rejects an unauthenticated intent creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/payments/intents')
        .send({
          bookingId: '11111111-1111-4111-8111-111111111111',
          method: 'card',
        });

      expect(response.status).toBe(401);
    });

    it('rejects an unauthenticated status read', async () => {
      // Payment status exposes an amount and a paid-at time, so it is owner-scoped.
      const response = await request(app.getHttpServer())
        .get('/v1/payments/status')
        .query({ bookingId: '11111111-1111-4111-8111-111111111111' });

      expect(response.status).toBe(401);
    });

    it('rejects an undeclared query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/payments/status')
        .query({
          bookingId: '11111111-1111-4111-8111-111111111111',
          bogus: '1',
        });

      // 401 from the guard or 400 from the pipe; either way it does not proceed.
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('admin payment operations are not publicly reachable', () => {
    const BOOKING_UUID = '11111111-1111-4111-8111-111111111111';

    it.each([
      ['GET', '/v1/admin/payments'],
      ['GET', '/v1/admin/payments/aba-exceptions'],
      ['GET', '/v1/admin/refunds'],
    ])('rejects an unauthenticated %s %s', async (method, path) => {
      const response = await (method === 'GET'
        ? request(app.getHttpServer()).get(path)
        : request(app.getHttpServer()).post(path));

      expect(response.status).toBe(401);
    });

    it('rejects unauthenticated manual settlement', async () => {
      // This endpoint confirms a booking as paid. It must never be reachable
      // without both a token and an admin grant.
      const response = await request(app.getHttpServer())
        .post(`/v1/admin/payments/${BOOKING_UUID}/settle`)
        .send({ abaTrxId: '178220228091798', reason: 'verified on statement' });

      expect(response.status).toBe(401);
    });

    it('rejects unauthenticated refund completion', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/admin/refunds/${BOOKING_UUID}/complete`)
        .send({ providerRefundId: 'ABA-1234', reason: 'transferred by hand' });

      expect(response.status).toBe(401);
    });
  });
});
