import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/prisma/prisma.service';
import { RedisService } from './../src/modules/redis/redis.service';
import { PrismaFilter } from './../src/common/filters/prisma.filter';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { hashPassword } from './../src/modules/auth/utils/hash-password.util';

/**
 * Customer suspension, end to end.
 *
 * This is the flow worth exercising through the real stack, because the important
 * part is NOT the status column — it is that an already-signed-in customer loses
 * access. `User.status` and the `suspended` check in the login use case existed
 * long before anything could set them, so a suspension that only flipped the
 * column would leave the customer able to refresh indefinitely.
 *
 * The spec therefore signs a real customer in, suspends them, and asserts the
 * live session is gone.
 *
 * Fixtures use a unique email per run and are removed by id. Nothing seeded is
 * touched.
 */
describe('Admin customers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: RedisService;
  let adminToken: string;
  let supportToken: string;
  let customerId: string;

  const CUSTOMER_EMAIL = `e2e.customer.${randomUUID()}@example.com`;
  const CUSTOMER_PASSWORD = 'CustomerPass!2026';

  const envPassword = process.env.SEED_ADMIN_PASSWORD;
  // Mirrors resolvePassword() in the admin seed, which ignores a value under 8
  // characters — SEED_ADMIN_PASSWORD is commonly present-but-empty.
  const ADMIN_PASSWORD =
    envPassword && envPassword.length >= 8 ? envPassword : 'DerLgAdmin!2026';

  async function login(email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password });
    return res;
  }

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
    redis = app.get(RedisService);
    await app.init();

    adminToken = (await login('admin@derlg.demo', ADMIN_PASSWORD)).body?.data
      ?.accessToken;
    supportToken = (await login('support@derlg.demo', ADMIN_PASSWORD)).body
      ?.data?.accessToken;

    const customer = await prisma.user.create({
      data: {
        id: randomUUID(),
        supabaseUid: randomUUID(),
        email: CUSTOMER_EMAIL,
        fullName: 'E2E Customer',
        role: 'user',
        status: 'active',
        passwordHash: await hashPassword(CUSTOMER_PASSWORD),
      },
      select: { id: true },
    });
    customerId = customer.id;
  }, 60000);

  afterAll(async () => {
    if (customerId) {
      await redis.delByPattern(`session:${customerId}:*`);
      await prisma.auditLog.deleteMany({ where: { entityId: customerId } });
      await prisma.user.delete({ where: { id: customerId } });
    }
    await app.close();
  });

  function asAdmin(req: request.Test) {
    return req.set('Authorization', `Bearer ${adminToken}`);
  }

  function asSupport(req: request.Test) {
    return req.set('Authorization', `Bearer ${supportToken}`);
  }

  it('should have obtained both admin tokens', () => {
    expect(adminToken).toBeTruthy();
    expect(supportToken).toBeTruthy();
  });

  it('should require a reason to change status', async () => {
    await asAdmin(
      request(app.getHttpServer()).patch(
        `/v1/admin/customers/${customerId}/status`,
      ),
    )
      .send({ status: 'suspended' })
      .expect(400);
  });

  it('should terminate a live session when suspending', async () => {
    // ---- the customer signs in, creating a real refresh session ------------
    const signIn = await login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    expect(signIn.status).toBe(200);
    const refreshCookie = signIn.headers['set-cookie'];
    expect(refreshCookie).toBeTruthy();

    const sessionsBefore = await redis.keys(`session:${customerId}:*`);
    expect(sessionsBefore.length).toBeGreaterThan(0);

    // Refresh works while active.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    // ---- suspend -----------------------------------------------------------
    const suspended = await asAdmin(
      request(app.getHttpServer()).patch(
        `/v1/admin/customers/${customerId}/status`,
      ),
    )
      .send({ status: 'suspended', reason: 'E2E chargeback investigation' })
      .expect(200);

    expect(suspended.body.data.previousStatus).toBe('active');
    expect(suspended.body.data.status).toBe('suspended');
    expect(suspended.body.data.clearedSessionKeys).toBeGreaterThan(0);

    // ---- the live session must be gone -------------------------------------
    const sessionsAfter = await redis.keys(`session:${customerId}:*`);
    expect(sessionsAfter).toHaveLength(0);

    // The whole point: an outstanding refresh token is now useless.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401);

    // And a fresh sign-in is refused.
    const blocked = await login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toMatch(/AUTH_ACCOUNT_SUSPENDED/);
  }, 60000);

  it('should record the reason and the actor in the audit log', async () => {
    const entries = await prisma.auditLog.findMany({
      where: { entityId: customerId },
      select: { userId: true, metadata: true },
    });

    const statusEntry = entries.find(
      (e) =>
        (e.metadata as { action?: string })?.action === 'SET_CUSTOMER_STATUS',
    );

    expect(statusEntry).toBeDefined();
    // A uuid string, not the JWT payload object — the failure mode that made every
    // explicit admin audit write fail silently for a long time.
    expect(typeof statusEntry?.userId).toBe('string');
    expect(statusEntry?.metadata).toMatchObject({
      reason: 'E2E chargeback investigation',
      newStatus: 'suspended',
    });
  });

  it('should surface the suspended customer under the status filter', async () => {
    const listed = await asAdmin(
      request(app.getHttpServer()).get('/v1/admin/customers?status=suspended'),
    ).expect(200);

    expect(
      listed.body.data.data.some((c: { id: string }) => c.id === customerId),
    ).toBe(true);
  });

  it('should restore access on reactivation', async () => {
    await asAdmin(
      request(app.getHttpServer()).patch(
        `/v1/admin/customers/${customerId}/status`,
      ),
    )
      .send({ status: 'active', reason: 'E2E investigation cleared' })
      .expect(200);

    const restored = await login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    expect(restored.status).toBe(200);
  }, 30000);

  it('should let a support agent edit a profile', async () => {
    await asSupport(
      request(app.getHttpServer()).patch(`/v1/admin/customers/${customerId}`),
    )
      .send({ fullName: 'E2E Customer Renamed' })
      .expect(200);

    const updated = await prisma.user.findUnique({
      where: { id: customerId },
      select: { fullName: true },
    });
    expect(updated?.fullName).toBe('E2E Customer Renamed');
  });

  it('should deny a support agent the role route', async () => {
    // Method-level @AdminRoles(SUPER_ADMIN) overrides the class decorator that
    // otherwise admits SUPPORT_AGENT.
    await asSupport(
      request(app.getHttpServer()).patch(
        `/v1/admin/customers/${customerId}/role`,
      ),
    )
      .send({ role: 'guide' })
      .expect(403);
  });

  it('should refuse to grant an admin role through the customer route', async () => {
    const refused = await asAdmin(
      request(app.getHttpServer()).patch(
        `/v1/admin/customers/${customerId}/role`,
      ),
    )
      .send({ role: 'super_admin' })
      .expect(403);

    expect(JSON.stringify(refused.body)).toMatch(/admin\/users/);
  });

  it('should allow a non-admin role change', async () => {
    await asAdmin(
      request(app.getHttpServer()).patch(
        `/v1/admin/customers/${customerId}/role`,
      ),
    )
      .send({ role: 'guide' })
      .expect(200);

    const updated = await prisma.user.findUnique({
      where: { id: customerId },
      select: { role: true },
    });
    expect(updated?.role).toBe('guide');
  });
});
