import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './src/app.module';
import { RedisService } from './src/modules/redis/redis.service';
import { PrismaFilter } from './src/common/filters/prisma.filter';
import { AllExceptionsFilter } from './src/common/filters/all-exceptions.filter';

class InMemoryRedis {
  private store = new Map();
  async get(key: string) { const e = this.store.get(key); if (!e) return null; if (e.expiresAt && Date.now() > e.expiresAt) { this.store.delete(key); return null; } return e.value; }
  async set(key: string, value: string, ttl?: number) { this.store.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1000 : undefined }); }
  async del(key: string) { this.store.delete(key); }
  async setex(key: string, seconds: number, value: string) { this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 }); }
  async keys(pattern: string) { const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$'); return Array.from(this.store.keys()).filter((k) => regex.test(k)); }
}

async function main() {
  const redisMock = new InMemoryRedis();
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RedisService).useValue(redisMock).compile();
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new PrismaFilter(), new AllExceptionsFilter());
  await app.init();

  const registerRes = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({ email: 'debug@example.com', password: 'password123', name: 'Debug' });
  console.log('Register status:', registerRes.status);
  console.log('Register body:', JSON.stringify(registerRes.body, null, 2));

  const accessToken = registerRes.body.data?.accessToken || registerRes.body.accessToken;
  console.log('Access token:', accessToken ? 'present' : 'missing');

  const meRes = await request(app.getHttpServer())
    .get('/v1/users/me')
    .set('Authorization', `Bearer ${accessToken}`);
  console.log('Users/me status:', meRes.status);
  console.log('Users/me body:', JSON.stringify(meRes.body, null, 2));

  await app.close();
}

main().catch(console.error);
