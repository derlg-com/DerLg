import { Body, Controller, Get, INestApplication, Module, Post, Query } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, Max, MinLength } from 'class-validator';
import request from 'supertest';

import { configureApp } from '../src/bootstrap/configure-app';
import { ResponseMessage } from '../src/common/decorators/response-message.decorator';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-codes';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { paginate } from '../src/common/interfaces/api-response.interface';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

// The probe controller lives in the test file, not in src/, so no throwaway
// endpoint ever ships in the real API surface.
class ProbeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(50)
  size?: number;
}

class ProbeBodyDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}

@Controller('probe')
class ProbeController {
  @Get('list')
  @ResponseMessage('Probes retrieved')
  list(@Query() query: ProbeQueryDto) {
    return paginate([{ id: 'p1' }, { id: 'p2' }], 41, 1, query.size ?? 20);
  }

  @Post('register')
  register(@Body() body: ProbeBodyDto) {
    return { email: body.email };
  }

  @Get('domain-error')
  domainError() {
    throw new AppException(ErrorCode.AVAILABILITY_UNAVAILABLE, 'No seats left on 2026-09-01.', 409, {
      resource: 'transport',
    });
  }

  @Get('boom')
  boom() {
    throw new Error('secret internal detail password=hunter2');
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
class ProbeModule {}

/**
 * Task 2 acceptance: every response — success, validation failure, domain
 * error, unexpected crash — comes back in the documented envelope with a
 * stable code and no leaked internals.
 */
describe('API contract (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
    configureApp(app, ['http://localhost:3100']);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns data + meta for a paginated handler', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe/list').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: [{ id: 'p1' }, { id: 'p2' }],
      message: 'Probes retrieved',
      meta: { page: 1, limit: 20, total: 41, totalPages: 3 },
      requestId: expect.any(String),
    });
  });

  it('rejects an unknown query parameter (whitelist + forbidNonWhitelisted)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/probe/list?sizes=10')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      message: 'Request validation failed.',
      error: {
        code: ErrorCode.BAD_REQUEST,
        details: { fields: ['property sizes should not exist'] },
      },
    });
  });

  it('reports every failed body constraint in error.details.fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(response.body.error.details.fields).toEqual(
      expect.arrayContaining([
        expect.stringContaining('email'),
        expect.stringContaining('password'),
      ]),
    );
    expect(response.body).not.toHaveProperty('stack');
  });

  it('renders a domain AppException with its stable code and details', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe/domain-error').expect(409);

    expect(response.body).toMatchObject({
      success: false,
      message: 'No seats left on 2026-09-01.',
      error: {
        code: ErrorCode.AVAILABILITY_UNAVAILABLE,
        details: { resource: 'transport' },
      },
    });
  });

  it('never leaks internals or stack traces on an unexpected error', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe/boom').expect(500);

    expect(response.body).toMatchObject({
      success: false,
      data: null,
      message: 'An unexpected error occurred.',
      error: { code: ErrorCode.INTERNAL_ERROR },
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('at ');
  });

  it('returns the NOT_FOUND envelope for an unmatched route', async () => {
    const response = await request(app.getHttpServer()).get('/v1/nowhere').expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.NOT_FOUND },
    });
  });
});
