import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { ErrorCode } from '../src/common/errors/error-codes';
import { REFRESH_COOKIE_NAME } from '../src/modules/auth/auth.controller';

/**
 * Task 4 acceptance, end to end against the dev database:
 * register -> me -> refresh (rotating) -> logout -> refresh rejected,
 * plus reuse detection and the shape of every failure.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  const email = `e2e-auth-${Date.now()}@derlg.test`;
  const password = 'Sup3rSecret';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, ['http://localhost:3100']);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-auth-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  function refreshCookieFrom(response: request.Response): string {
    const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = raw?.find((value) => value.startsWith(`${REFRESH_COOKIE_NAME}=`));
    if (!cookie) {
      throw new Error('No refresh cookie was set');
    }
    return cookie.split(';')[0];
  }

  let firstCookie: string;
  let accessToken: string;

  it('registers a new account and sets an httpOnly refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password, fullName: 'E2E Traveller' })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: 'Account created',
      data: {
        user: { email, fullName: 'E2E Traveller', role: 'TRAVELER', locale: 'en' },
        accessToken: expect.any(String),
        expiresIn: 900,
      },
    });
    // The refresh token is cookie-only and never in the body.
    expect(response.body.data).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const rawCookie = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith(`${REFRESH_COOKIE_NAME}=`),
    )!;
    expect(rawCookie).toContain('HttpOnly');
    expect(rawCookie).toContain('SameSite=Strict');
    expect(rawCookie).toContain('Path=/v1/auth');

    firstCookie = refreshCookieFrom(response);
    accessToken = response.body.data.accessToken;
  }, 30_000);

  it('rejects a second registration with the same email', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password, fullName: 'Impostor' })
      .expect(409);

    expect(response.body.error.code).toBe(ErrorCode.AUTH_EMAIL_TAKEN);
  }, 30_000);

  it('rejects a weak password with field-level detail', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: `e2e-auth-weak-${Date.now()}@derlg.test`, password: 'short', fullName: 'W P' })
      .expect(400);

    expect(response.body.error.details.fields).toEqual(
      expect.arrayContaining([expect.stringContaining('at least 8 characters')]),
    );
  });

  it('returns the profile for a valid access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({ email, fullName: 'E2E Traveller' });
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects /users/me without or with a bad token', async () => {
    await request(app.getHttpServer()).get('/v1/users/me').expect(401);

    const response = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);

    expect(response.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('signs in with the right password and rejects the wrong one identically to unknown email', async () => {
    const ok = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(ok.body.data.accessToken).toEqual(expect.any(String));

    const wrongPassword = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'Wr0ngPassword' })
      .expect(401);

    const unknownEmail = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'nobody-e2e@derlg.test', password })
      .expect(401);

    // Identical responses so an attacker cannot enumerate accounts.
    expect(wrongPassword.body.error.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    expect(unknownEmail.body.error.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  }, 30_000);

  it('rotates the refresh token: a new cookie is issued and the old one dies', async () => {
    const rotated = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);

    const secondCookie = refreshCookieFrom(rotated);
    expect(secondCookie).not.toBe(firstCookie);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));

    // Replaying the consumed token is treated as theft.
    const replay = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);
    expect(replay.body.error.code).toBe(ErrorCode.AUTH_REFRESH_REUSED);

    // ...and that kills the rotated token too, since it is the same family.
    const afterTheft = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', secondCookie)
      .expect(401);
    expect(afterTheft.body.error.code).toBe(ErrorCode.AUTH_REFRESH_REUSED);
  }, 30_000);

  it('refuses to refresh without a cookie', async () => {
    const response = await request(app.getHttpServer()).post('/v1/auth/refresh').expect(401);

    expect(response.body.success).toBe(false);
  });

  it('logs out, clears the cookie, and invalidates the session', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const cookie = refreshCookieFrom(login);

    const logout = await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    const cleared = (logout.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith(`${REFRESH_COOKIE_NAME}=`),
    );
    expect(cleared).toBeDefined();

    const afterLogout = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    expect(afterLogout.body.error.code).toBe(ErrorCode.AUTH_REFRESH_REUSED);
  }, 30_000);

  it('stores only a hash of the refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token = refreshCookieFrom(login).split('=')[1];

    const stored = await prisma.refreshToken.findMany({ select: { tokenHash: true } });

    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((row) => row.tokenHash !== token)).toBe(true);
    expect(stored.every((row) => /^[0-9a-f]{64}$/.test(row.tokenHash))).toBe(true);
  }, 30_000);
});
