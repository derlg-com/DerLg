import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Smoke test for application bootstrap.
 *
 * This previously asserted `GET /` returned "Hello World!" — the Nest scaffold
 * default, which was never updated. `main.ts` applies `setGlobalPrefix('v1')` and
 * no controller serves the root, so the assertion could never have passed.
 *
 * What is genuinely worth pinning here is that the module graph resolves at all.
 * A missing provider makes the whole application refuse to start, and that has
 * happened: `AdminGateway` injects `JwtService` while `AdminModule` does not import
 * `JwtModule`, so the app failed to bootstrap until `AppModule` registered
 * `JwtModule` with `global: true`.
 */
describe('Application bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('should resolve the entire dependency graph', () => {
    // Reaching here means every provider resolved, including AdminGateway's
    // JwtService.
    expect(app).toBeDefined();
  });

  it('should serve routes under the /v1 prefix', async () => {
    await request(app.getHttpServer()).get('/v1/trips').expect(200);
  });

  it('should not serve anything at the unprefixed root', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });
});
