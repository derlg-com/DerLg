import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/prisma/prisma.service';
import { RedisService } from './../src/modules/redis/redis.service';
import { PrismaFilter } from './../src/common/filters/prisma.filter';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }
}

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redisMock: InMemoryRedis;

  beforeAll(async () => {
    redisMock = new InMemoryRedis();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .compile();

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
  }, 30000);

  beforeEach(async () => {
    await prisma.user.deleteMany();
    const keys = await redisMock.keys('session:*');
    const resetKeys = await redisMock.keys('password_reset:*');
    for (const key of [...keys, ...resetKeys]) {
      await redisMock.del(key);
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  const registerDto = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  };

  it('POST /v1/auth/register → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user.email).toBe(registerDto.email);
  });

  it('POST /v1/auth/register duplicate → 409', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(409);

    expect(res.body.error.code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('POST /v1/auth/login → 200 + cookie', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: registerDto.email, password: registerDto.password })
      .expect(200);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /v1/auth/login wrong password → 401', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: registerDto.email, password: 'wrongpassword' })
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('GET /v1/users/me → 200 with Bearer', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    const accessToken = registerRes.body.data.accessToken;

    await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('POST /v1/auth/refresh → 200 + new cookie', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    const agent = request.agent(app.getHttpServer());
    const loginRes = await agent
      .post('/v1/auth/login')
      .send({ email: registerDto.email, password: registerDto.password })
      .expect(200);

    expect(loginRes.headers['set-cookie']).toBeDefined();

    const refreshRes = await agent.post('/v1/auth/refresh').expect(200);

    expect(refreshRes.body.data).toHaveProperty('accessToken');
    expect(refreshRes.headers['set-cookie']).toBeDefined();
  });

  it('POST /v1/auth/logout → 200', async () => {
    const agent = request.agent(app.getHttpServer());
    const registerRes = await agent
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);
    const accessToken = registerRes.body.data.accessToken;

    await agent
      .post('/v1/auth/login')
      .send({ email: registerDto.email, password: registerDto.password })
      .expect(200);

    await agent
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('refresh token invalidated after logout → 401', async () => {
    const agent = request.agent(app.getHttpServer());
    const registerRes = await agent
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);
    const accessToken = registerRes.body.data.accessToken;

    await agent
      .post('/v1/auth/login')
      .send({ email: registerDto.email, password: registerDto.password })
      .expect(200);

    await agent
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await agent.post('/v1/auth/refresh').expect(401);
  });

  it('POST /v1/auth/forgot-password → 200', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: registerDto.email })
      .expect(200);
  });

  it('POST /v1/auth/forgot-password unknown email → 200 (silent)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(200);

    expect(res.body.data.message).toBe(
      'Check your email for reset instructions',
    );
  });

  it('POST /v1/auth/reset-password → 200', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registerDto)
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: registerDto.email })
      .expect(200);

    const resetKeys = await redisMock.keys('password_reset:*');
    expect(resetKeys.length).toBe(1);
    const token = resetKeys[0].replace('password_reset:', '');

    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token, newPassword: 'newpassword123' })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: registerDto.email, password: 'newpassword123' })
      .expect(200);

    expect(loginRes.body.data).toHaveProperty('accessToken');
  });

  it('POST /v1/auth/reset-password invalid token → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: 'invalid-token', newPassword: 'newpassword123' })
      .expect(400);

    expect(res.body.error.code).toBe('AUTH_RESET_TOKEN_INVALID');
  });

  it('POST /v1/auth/google → 200 with url', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/google')
      .expect(200);

    expect(res.body.data).toHaveProperty('url');
    expect(res.body.data.url).toContain('accounts.google.com');
  });
});
