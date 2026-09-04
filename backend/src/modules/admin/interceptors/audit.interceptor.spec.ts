import { of } from 'rxjs';

import { AuditInterceptor } from './audit.interceptor';

import type { CallHandler, ExecutionContext } from '@nestjs/common';

/**
 * Every admin mutation must leave a trace. Two things in the ported version were
 * broken: entity ids were scraped from `route.path`, which contains `:id`
 * placeholders rather than values, so parameterised routes recorded nothing; and
 * request bodies were written verbatim, which would have put driver PINs into the
 * audit table.
 */
describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let prisma: { auditLog: { create: jest.Mock } };

  const context = (over: {
    method?: string;
    path?: string;
    params?: Record<string, string>;
    body?: unknown;
    user?: { sub: string };
  }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: over.method ?? 'PATCH',
          route: { path: over.path ?? '/v1/admin/drivers/:id' },
          originalUrl: over.path ?? '/v1/admin/drivers/abc',
          params: over.params ?? {},
          body: over.body ?? {},
          user: over.user ?? { sub: 'admin-1' },
          ip: '10.0.0.5',
          headers: { 'user-agent': 'jest' },
        }),
      }),
    }) as unknown as ExecutionContext;

  const handler = (value: unknown = { id: 'created-1' }): CallHandler => ({
    handle: () => of(value),
  });

  /** Lets the fire-and-forget write settle. */
  const flush = () => new Promise((r) => setImmediate(r));

  beforeEach(() => {
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    interceptor = new AuditInterceptor(prisma as never);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('should not log %s', async (method) => {
    interceptor.intercept(context({ method }), handler()).subscribe();
    await flush();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
    'should log %s',
    async (method) => {
      interceptor.intercept(context({ method }), handler()).subscribe();
      await flush();
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    },
  );

  it('should record exactly one row per mutation', async () => {
    interceptor.intercept(context({ method: 'POST' }), handler()).subscribe();
    await flush();

    const data = prisma.auditLog.create.mock.calls[0][0].data as {
      userId: string;
      eventType: string;
      entityType: string;
      ipAddress: string;
      userAgent: string;
    };
    expect(data.userId).toBe('admin-1');
    expect(data.eventType).toBe('admin_action');
    expect(data.entityType).toBe('DRIVER');
    expect(data.ipAddress).toBe('10.0.0.5');
    expect(data.userAgent).toBe('jest');
  });

  describe('entity id resolution', () => {
    it('should take the id from route params, not the path template', async () => {
      interceptor
        .intercept(
          context({
            path: '/v1/admin/drivers/:id',
            params: { id: 'driver-42' },
          }),
          handler(),
        )
        .subscribe();
      await flush();

      expect(prisma.auditLog.create.mock.calls[0][0].data.entityId).toBe(
        'driver-42',
      );
    });

    it('should fall back to the response id for creations', async () => {
      interceptor
        .intercept(
          context({ method: 'POST', path: '/v1/admin/drivers', params: {} }),
          handler({ id: 'new-driver' }),
        )
        .subscribe();
      await flush();

      expect(prisma.auditLog.create.mock.calls[0][0].data.entityId).toBe(
        'new-driver',
      );
    });

    it('should unwrap the response envelope when looking for an id', async () => {
      interceptor
        .intercept(
          context({ method: 'POST', path: '/v1/admin/hotels', params: {} }),
          handler({ success: true, data: { id: 'hotel-9' } }),
        )
        .subscribe();
      await flush();

      expect(prisma.auditLog.create.mock.calls[0][0].data.entityId).toBe(
        'hotel-9',
      );
    });

    it('should record null rather than a placeholder when no id exists', async () => {
      interceptor
        .intercept(
          context({
            method: 'POST',
            path: '/v1/admin/analytics/export',
            params: {},
          }),
          handler({ rows: 10 }),
        )
        .subscribe();
      await flush();

      expect(prisma.auditLog.create.mock.calls[0][0].data.entityId).toBeNull();
    });
  });

  describe('changed fields', () => {
    it('should record the submitted body', async () => {
      interceptor
        .intercept(
          context({
            body: { driverName: 'Sok Piseth', phone: '+855120000001' },
          }),
          handler(),
        )
        .subscribe();
      await flush();

      expect(
        prisma.auditLog.create.mock.calls[0][0].data.metadata.changedFields,
      ).toEqual({ driverName: 'Sok Piseth', phone: '+855120000001' });
    });

    it.each(['authPin', 'password', 'token', 'secret', 'refreshToken'])(
      'should redact %s',
      async (key) => {
        interceptor
          .intercept(
            context({ body: { [key]: 'super-secret', name: 'ok' } }),
            handler(),
          )
          .subscribe();
        await flush();

        const changed = prisma.auditLog.create.mock.calls[0][0].data.metadata
          .changedFields as Record<string, string>;
        expect(changed[key]).toBe('[REDACTED]');
        expect(changed.name).toBe('ok');
      },
    );
  });

  describe('action inference', () => {
    it.each([
      ['POST', '/v1/admin/drivers', 'CREATE'],
      ['DELETE', '/v1/admin/drivers/:id', 'DELETE'],
      ['PATCH', '/v1/admin/drivers/:id', 'UPDATE'],
      ['PATCH', '/v1/admin/assignments/:id/complete', 'COMPLETE'],
      ['POST', '/v1/admin/bookings/:id/cancel', 'CANCEL'],
      ['POST', '/v1/admin/loyalty/adjust', 'ADJUST'],
    ])('should infer %s %s as %s', async (method, path, expected) => {
      interceptor.intercept(context({ method, path }), handler()).subscribe();
      await flush();

      expect(prisma.auditLog.create.mock.calls[0][0].data.metadata.action).toBe(
        expected,
      );
    });
  });

  it('should not fail the request when the audit write throws', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('table missing'));
    const seen: unknown[] = [];

    interceptor
      .intercept(context({ method: 'POST' }), handler({ id: 'x' }))
      .subscribe({ next: (v) => seen.push(v) });
    await flush();

    // The handler's result still reaches the client.
    expect(seen).toEqual([{ id: 'x' }]);
  });
});
