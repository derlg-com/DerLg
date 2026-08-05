import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import { RawResponse } from '../decorators/raw-response.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { paginate } from '../interfaces/api-response.interface';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

class ProbeController {
  plain() {
    return { id: 1 };
  }

  @ResponseMessage('Packages retrieved')
  listed() {
    return paginate([{ id: 1 }], 42, 2, 20);
  }

  @RawResponse()
  stream() {
    return 'data: raw\n\n';
  }
}

function contextFor(methodName: keyof ProbeController, headers: Record<string, string> = {}) {
  const controller = ProbeController.prototype;
  return {
    getType: () => 'http',
    getHandler: () => controller[methodName],
    getClass: () => ProbeController,
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => headers[name.toLowerCase()],
      }),
    }),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('ResponseEnvelopeInterceptor', () => {
  let interceptor: ResponseEnvelopeInterceptor;

  beforeEach(() => {
    interceptor = new ResponseEnvelopeInterceptor(new Reflector());
  });

  it('wraps a plain payload in the success envelope', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(contextFor('plain'), handlerReturning({ id: 1 })),
    );

    expect(result).toEqual({
      success: true,
      data: { id: 1 },
      message: 'OK',
      requestId: undefined,
    });
  });

  it('propagates the request id when present', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        contextFor('plain', { 'x-request-id': 'req-7' }),
        handlerReturning({ id: 1 }),
      ),
    );

    expect(result).toMatchObject({ requestId: 'req-7' });
  });

  it('flattens a paginated payload into data + meta and honours @ResponseMessage', async () => {
    const payload = paginate([{ id: 1 }], 42, 2, 20);

    const result = await firstValueFrom(
      interceptor.intercept(contextFor('listed'), handlerReturning(payload)),
    );

    expect(result).toEqual({
      success: true,
      data: [{ id: 1 }],
      message: 'Packages retrieved',
      meta: { page: 2, limit: 20, total: 42, totalPages: 3 },
      requestId: undefined,
    });
  });

  it('normalises undefined handler results to null data', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(contextFor('plain'), handlerReturning(undefined)),
    );

    expect(result).toMatchObject({ success: true, data: null });
  });

  it('leaves @RawResponse handlers untouched so SSE and webhooks stay verbatim', async () => {
    const raw = 'data: raw\n\n';

    const result = await firstValueFrom(
      interceptor.intercept(contextFor('stream'), handlerReturning(raw)),
    );

    expect(result).toBe(raw);
  });
});

describe('paginate', () => {
  it('computes totalPages by ceiling', () => {
    expect(paginate([], 41, 1, 20).meta).toEqual({
      page: 1,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('reports zero pages for an empty result set', () => {
    expect(paginate([], 0, 1, 20).meta.totalPages).toBe(0);
  });
});
