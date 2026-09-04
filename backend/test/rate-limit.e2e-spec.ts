import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';

import { PrismaFilter } from './../src/common/filters/prisma.filter';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { RedisService } from './../src/modules/redis/redis.service';

/**
 * Rate limiting, end to end.
 *
 * This suite exists because rate limiting was configured but never enforced:
 * `ThrottlerModule` was registered and `@Throttle()` decorators were scattered
 * across the admin controllers, but no `ThrottlerGuard` was ever bound as an
 * `APP_GUARD`. Every one of those decorators was dead metadata, and the login
 * endpoint had no brute-force protection at all despite a dedicated limiter being
 * declared for it.
 *
 * A unit test cannot catch that class of bug — the guard was correct in isolation;
 * it simply was not wired. So this drives the real HTTP stack.
 *
 * `THROTTLE_IN_TESTS` is set before the module is imported: `CustomThrottlerGuard`
 * bypasses itself under Jest by default, otherwise an e2e suite that signs in once
 * per spec file would exhaust the 5-per-5-minutes login budget and fail every
 * other suite.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let redis: RedisService;

  // A distinct address per run so a leftover counter from a previous run cannot
  // make this pass or fail spuriously. Requires TRUST_PROXY_HOPS >= 1 for the
  // forwarded header to be honoured, which is asserted below.
  const CLIENT_IP = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

  beforeAll(async () => {
    process.env.THROTTLE_IN_TESTS = 'true';
    // The limiter keys on the client IP, which behind a proxy only resolves
    // correctly when Express is told how many hops to trust.
    process.env.TRUST_PROXY_HOPS = '1';

    // Imported after the env is set so module-level config sees it.
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('./../src/app.module');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.set('trust proxy', 1);
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
    redis = app.get(RedisService);
  }, 60000);

  afterAll(async () => {
    delete process.env.THROTTLE_IN_TESTS;
    // Leave no counters behind for the next run.
    await redis.delByPattern('throttle:*');
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('X-Forwarded-For', CLIENT_IP)
      .send({
        email: 'nobody@example.invalid',
        password: 'wrong-password-123',
      });

  it('enforces the login limit after 5 attempts from one address', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await login();
      statuses.push(response.status);
    }

    // The first five are rejected on credentials (401), not on volume.
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    // The sixth onwards are refused outright.
    expect(statuses.slice(5)).toEqual([429, 429]);
  }, 30000);

  it('returns the rate-limit error code in the standard envelope', async () => {
    const response = await login();

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({
      success: false,
      error: expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' }),
    });
  });

  it('keys buckets per address, so one noisy client cannot lock out another', async () => {
    const other = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.250')
      .send({
        email: 'nobody@example.invalid',
        password: 'wrong-password-123',
      });

    expect(other.status).toBe(401);
  });

  it('does not throttle unrelated endpoints under the auth limit', async () => {
    // The auth limit is a per-route override. A shared named limiter would have
    // applied 5-per-5-minutes to the whole API.
    const health = await request(app.getHttpServer())
      .get('/v1/health')
      .set('X-Forwarded-For', CLIENT_IP);

    expect(health.status).not.toBe(429);
  });

  it('persists counters in Redis rather than process memory', async () => {
    // In-process counters would give an effective limit of N x limit across N
    // instances, and would reset on every deploy.
    const keys = await redis.keys('throttle:*');

    expect(keys.length).toBeGreaterThan(0);
  });
});
