import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CustomThrottlerGuard } from './throttler.guard';
import { ErrorCode } from '../errors/error-codes';

/** Exposes the protected members under test. */
class TestableGuard extends CustomThrottlerGuard {
  publicShouldSkip(context: ExecutionContext) {
    return this.shouldSkip(context);
  }
  publicGetTracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
  publicThrow(
    context: ExecutionContext,
    detail: { timeToBlockExpire: number },
  ) {
    return this.throwThrottlingException(
      context,
      detail as Parameters<CustomThrottlerGuard['throwThrottlingException']>[1],
    );
  }
}

function buildGuard() {
  return new TestableGuard(
    [{ name: 'default', ttl: 60_000, limit: 10 }],
    { increment: jest.fn() },
    new Reflector(),
  );
}

function contextOfType(type: string) {
  return { getType: () => type } as unknown as ExecutionContext;
}

describe('CustomThrottlerGuard', () => {
  let guard: TestableGuard;

  beforeEach(() => {
    guard = buildGuard();
  });

  describe('shouldSkip', () => {
    const originalWorkerId = process.env.JEST_WORKER_ID;
    const originalFlag = process.env.THROTTLE_IN_TESTS;

    afterEach(() => {
      if (originalWorkerId === undefined) delete process.env.JEST_WORKER_ID;
      else process.env.JEST_WORKER_ID = originalWorkerId;
      if (originalFlag === undefined) delete process.env.THROTTLE_IN_TESTS;
      else process.env.THROTTLE_IN_TESTS = originalFlag;
    });

    it('throttles HTTP requests outside a test run', async () => {
      delete process.env.JEST_WORKER_ID;

      await expect(guard.publicShouldSkip(contextOfType('http'))).resolves.toBe(
        false,
      );
    });

    it.each(['ws', 'rpc'])('skips %s contexts', async (type) => {
      // getRequestResponse() calls switchToHttp(), which yields undefined outside
      // HTTP and would throw when the guard tried to set response headers.
      delete process.env.JEST_WORKER_ID;

      await expect(guard.publicShouldSkip(contextOfType(type))).resolves.toBe(
        true,
      );
    });

    it('skips inside a Jest run so repeated e2e logins are not locked out', async () => {
      process.env.JEST_WORKER_ID = '1';
      delete process.env.THROTTLE_IN_TESTS;

      await expect(guard.publicShouldSkip(contextOfType('http'))).resolves.toBe(
        true,
      );
    });

    it('honours THROTTLE_IN_TESTS so the limiter itself stays testable', async () => {
      process.env.JEST_WORKER_ID = '1';
      process.env.THROTTLE_IN_TESTS = 'true';

      await expect(guard.publicShouldSkip(contextOfType('http'))).resolves.toBe(
        false,
      );
    });
  });

  describe('getTracker', () => {
    it('keys browser traffic by IP', async () => {
      await expect(
        guard.publicGetTracker({ ip: '203.0.113.9', headers: {} }),
      ).resolves.toBe('ip:203.0.113.9');
    });

    it('keys service callers by a hash of their key, not their IP', async () => {
      // The AI agent's tool loop shares an egress IP with browsers behind the same
      // NAT; bucketing them together would let one conversation lock out users.
      const tracker = await guard.publicGetTracker({
        ip: '203.0.113.9',
        headers: { 'x-service-key': 'k'.repeat(48) },
      });

      expect(tracker).toMatch(/^svc:[0-9a-f]{32}$/);
    });

    it('never puts the raw service key in the tracker', async () => {
      // Throttle keys reach Redis and log lines; a credential must not travel there.
      const key = 'super-secret-service-key-value-000000000000';
      const tracker = await guard.publicGetTracker({
        headers: { 'x-service-key': key },
      });

      expect(tracker).not.toContain(key);
    });

    it('gives two different service keys two different buckets', async () => {
      const a = await guard.publicGetTracker({
        headers: { 'x-service-key': 'a'.repeat(48) },
      });
      const b = await guard.publicGetTracker({
        headers: { 'x-service-key': 'b'.repeat(48) },
      });

      expect(a).not.toEqual(b);
    });

    it('falls back to the left-most forwarded address when req.ip is absent', async () => {
      // The right-most hops are appended by our own proxies and are identical for
      // every caller, so keying on them would collapse all users into one bucket.
      await expect(
        guard.publicGetTracker({
          headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1, 10.0.0.2' },
        }),
      ).resolves.toBe('ip:198.51.100.7');
    });

    it('falls back to x-real-ip, then to a constant', async () => {
      await expect(
        guard.publicGetTracker({ headers: { 'x-real-ip': '198.51.100.8' } }),
      ).resolves.toBe('ip:198.51.100.8');
      await expect(guard.publicGetTracker({ headers: {} })).resolves.toBe(
        'ip:unknown',
      );
    });

    it('tolerates a request with no headers object', async () => {
      await expect(guard.publicGetTracker({})).resolves.toBe('ip:unknown');
    });
  });

  describe('throwThrottlingException', () => {
    it('throws a 429 whose payload uses the key AllExceptionsFilter reads', async () => {
      // The filter picks `code` off the response object. Naming the field `error`
      // instead made clients see INTERNAL_ERROR for a rate-limit rejection.
      await expect(
        guard.publicThrow(contextOfType('http'), { timeToBlockExpire: 42 }),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: expect.stringContaining('Too many requests'),
        },
      });
    });

    it('throws an HttpException, not a bare Error', async () => {
      await expect(
        guard.publicThrow(contextOfType('http'), { timeToBlockExpire: 1 }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });
});
