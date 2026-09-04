import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';

import { ServiceKeyGuard } from './service-key.guard';

const VALID_KEY = 'a'.repeat(48);

function contextWith(headers: Record<string, string | undefined>) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

function guardWith(expected: string | undefined) {
  const config = {
    get: (key: string) => (key === 'AI_SERVICE_KEY' ? expected : undefined),
  } as unknown as ConfigService;
  return new ServiceKeyGuard(config);
}

describe('ServiceKeyGuard', () => {
  it('admits a request carrying the configured key', () => {
    const guard = guardWith(VALID_KEY);

    expect(guard.canActivate(contextWith({ 'x-service-key': VALID_KEY }))).toBe(
      true,
    );
  });

  it('rejects a wrong key', () => {
    const guard = guardWith(VALID_KEY);

    expect(() =>
      guard.canActivate(contextWith({ 'x-service-key': 'b'.repeat(48) })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing header', () => {
    const guard = guardWith(VALID_KEY);

    expect(() => guard.canActivate(contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when AI_SERVICE_KEY is unset', () => {
    // An unset secret must never mean "allow anyone" — /v1/ai-tools/* can create
    // booking holds and read account data.
    const guard = guardWith(undefined);
    jest.spyOn(guard['logger'], 'error').mockImplementation(() => undefined);

    expect(() =>
      guard.canActivate(contextWith({ 'x-service-key': 'anything' })),
    ).toThrow(UnauthorizedException);
  });

  it('fails closed when AI_SERVICE_KEY is an empty string', () => {
    const guard = guardWith('');
    jest.spyOn(guard['logger'], 'error').mockImplementation(() => undefined);

    // Notably also rejects a request that sends the same empty value, which a
    // plain `key !== expected` comparison would have admitted.
    expect(() =>
      guard.canActivate(contextWith({ 'x-service-key': '' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a correct prefix of the key', () => {
    // Guards against the timing-attack shape: a naive comparison returns faster
    // the earlier it finds a mismatch, letting an attacker extend a known prefix
    // one character at a time.
    const guard = guardWith(VALID_KEY);

    expect(() =>
      guard.canActivate(
        contextWith({ 'x-service-key': VALID_KEY.slice(0, 47) }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a key of different length without throwing on the comparison', () => {
    // Hashing both sides first gives timingSafeEqual two equal-length buffers;
    // passing raw values of unequal length would make it throw a RangeError and
    // surface as a 500 instead of a 401.
    const guard = guardWith(VALID_KEY);

    expect(() =>
      guard.canActivate(contextWith({ 'x-service-key': 'short' })),
    ).toThrow(UnauthorizedException);
  });
});
