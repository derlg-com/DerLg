import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedResponse {
  status: number;
  body: Record<string, unknown>;
}

function hostFor(headers: Record<string, string> = {}): {
  host: ArgumentsHost;
  captured: CapturedResponse;
} {
  const captured: CapturedResponse = { status: 0, body: {} };

  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };

  const request = {
    method: 'GET',
    url: '/v1/probe',
    header: (name: string) => headers[name.toLowerCase()],
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders an AppException with its code, status and details', () => {
    const { host, captured } = hostFor({ 'x-request-id': 'req-1' });

    filter.catch(
      new AppException(
        ErrorCode.AVAILABILITY_UNAVAILABLE,
        'Sold out for 2026-09-01.',
        HttpStatus.CONFLICT,
        { itemId: 'abc' },
      ),
      host,
    );

    expect(captured.status).toBe(409);
    expect(captured.body).toEqual({
      success: false,
      data: null,
      message: 'Sold out for 2026-09-01.',
      error: {
        code: ErrorCode.AVAILABILITY_UNAVAILABLE,
        details: { itemId: 'abc' },
      },
      requestId: 'req-1',
    });
  });

  it.each([
    [new NotFoundException('Package not found'), 404, ErrorCode.NOT_FOUND],
    [new UnauthorizedException(), 401, ErrorCode.UNAUTHORIZED],
    [new ForbiddenException(), 403, ErrorCode.FORBIDDEN],
    [new ConflictException(), 409, ErrorCode.CONFLICT],
    [new BadRequestException('Bad input'), 400, ErrorCode.BAD_REQUEST],
  ])('maps %s to the matching envelope code', (exception, status, code) => {
    const { host, captured } = hostFor();

    filter.catch(exception, host);

    expect(captured.status).toBe(status);
    expect(captured.body.success).toBe(false);
    expect(captured.body.error).toMatchObject({ code });
  });

  it('collapses ValidationPipe constraint arrays into error.details.fields', () => {
    const { host, captured } = hostFor();

    filter.catch(
      new BadRequestException({
        message: ['email must be an email', 'password must be longer than 8 characters'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(captured.status).toBe(400);
    expect(captured.body.message).toBe('Request validation failed.');
    expect(captured.body.error).toEqual({
      code: ErrorCode.BAD_REQUEST,
      details: {
        fields: ['email must be an email', 'password must be longer than 8 characters'],
      },
    });
  });

  it('maps a Prisma unique-constraint violation to 409 CONFLICT', () => {
    const { host, captured } = hostFor();

    filter.catch(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
      host,
    );

    expect(captured.status).toBe(409);
    expect(captured.body.error).toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('maps a Prisma missing-record error to 404 NOT_FOUND', () => {
    const { host, captured } = hostFor();

    filter.catch(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.19.3',
      }),
      host,
    );

    expect(captured.status).toBe(404);
    expect(captured.body.error).toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('never leaks internals for an unexpected error', () => {
    const { host, captured } = hostFor();

    filter.catch(new Error('connect ECONNREFUSED 127.0.0.1:55433 password=hunter2'), host);

    expect(captured.status).toBe(500);
    expect(captured.body).toMatchObject({
      success: false,
      data: null,
      message: 'An unexpected error occurred.',
      error: { code: ErrorCode.INTERNAL_ERROR },
    });
    expect(JSON.stringify(captured.body)).not.toContain('hunter2');
    expect(JSON.stringify(captured.body)).not.toContain('ECONNREFUSED');
  });
});
