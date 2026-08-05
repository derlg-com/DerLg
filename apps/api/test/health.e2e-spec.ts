import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

/**
 * Task 1 acceptance: the app boots, /v1/health reports both dependencies, and
 * the response is wrapped in the project envelope.
 * Requires `npm run db:up` (Postgres + Redis reachable).
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health returns an ok envelope with dependency statuses', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: {
        status: 'ok',
        dependencies: { database: 'up', redis: 'up' },
        uptimeSeconds: expect.any(Number),
      },
    });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('echoes a caller-supplied request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/health')
      .set('x-request-id', 'trace-me-123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('trace-me-123');
    expect(response.body.requestId).toBe('trace-me-123');
  });
});
