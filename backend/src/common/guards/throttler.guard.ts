import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { createHash } from 'crypto';

import { ErrorCode } from '../errors/error-codes';

/**
 * Global rate-limit guard.
 *
 * Registered as the **first** `APP_GUARD` on purpose. Guards run in
 * registration order and a rejection short-circuits the rest, so a throttler
 * placed after `JwtAuthGuard` never counts requests that fail authentication —
 * which is exactly the traffic worth counting. Token-guessing and credential
 * stuffing both produce a stream of 401s, and those must consume quota.
 *
 * Because it runs before authentication, `request.user` is not yet populated,
 * so buckets are keyed on transport identity rather than user identity. That is
 * also the safer choice: anything the client supplies (including an unverified
 * JWT `sub`) could be varied to mint a fresh bucket per request.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = ErrorCode.RATE_LIMIT_EXCEEDED;

  /**
   * Decides whether to bypass the limiter for this request.
   *
   * Two cases:
   *
   * 1. **Non-HTTP contexts.** `getRequestResponse` calls
   *    `context.switchToHttp()`, which yields undefined for WebSocket and RPC
   *    contexts and would then throw on `res.header(...)`. The admin gateway
   *    authenticates and rate-limits at the handshake instead.
   *
   * 2. **Test runs.** An e2e suite signs in once per spec file, which legitimately
   *    exceeds the 5-logins-per-5-minutes rule that exists to stop credential
   *    stuffing — and because the counter lives in Redis it survives between runs,
   *    so the whole suite starts failing on the second invocation. Detected via
   *    `JEST_WORKER_ID` rather than `NODE_ENV`, which `.env` files routinely pin to
   *    something else.
   *
   *    Set `THROTTLE_IN_TESTS=true` to keep the limiter on — `test/rate-limit.e2e-spec.ts`
   *    does exactly that so the protection itself stays covered.
   */
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return Promise.resolve(true);

    const underTest = process.env.JEST_WORKER_ID !== undefined;
    if (underTest && process.env.THROTTLE_IN_TESTS !== 'true') {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  /**
   * Bucket key for the caller.
   *
   * - Service-to-service callers are identified by a hash of their service key.
   *   Keying them by IP would put the AI agent's tool loop in the same bucket as
   *   every browser sharing that egress address, and one busy conversation would
   *   lock everyone out.
   * - Everyone else is keyed by client IP.
   *
   * The service key is hashed, never stored raw: throttle keys end up in Redis
   * and in log lines, and a credential must not travel there.
   */
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | undefined>;

    const serviceKey = headers['x-service-key'];
    if (serviceKey) {
      const digest = createHash('sha256')
        .update(serviceKey)
        .digest('hex')
        .slice(0, 32);
      return Promise.resolve(`svc:${digest}`);
    }

    return Promise.resolve(`ip:${this.clientIp(req, headers)}`);
  }

  /**
   * Resolves the client IP.
   *
   * Prefers Express's `req.ip`, which honours the `trust proxy` setting
   * configured in `main.ts`. Falls back to the forwarded headers only if it is
   * absent, and takes the left-most entry — the right-most hops are added by our
   * own proxies and are identical for every caller.
   */
  private clientIp(
    req: Record<string, unknown>,
    headers: Record<string, string | undefined>,
  ): string {
    const ip = req.ip;
    if (typeof ip === 'string' && ip !== '') return ip;

    const forwarded = headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();

    return headers['x-real-ip'] ?? 'unknown';
  }

  /**
   * Rejects in the shape `AllExceptionsFilter` expects, so a 429 comes back in
   * the same `{ success, data, message, error }` envelope as every other error
   * instead of the throttler's bare string body.
   *
   * The filter reads `code` off the response object — naming the field `error`
   * here would leave clients seeing `INTERNAL_ERROR` for a rate-limit rejection.
   * `Retry-After` is set as a header by the base guard.
   *
   * Returns a rejected promise rather than throwing synchronously: the declared
   * return type is `Promise<void>`, and the base class awaits the result. A
   * synchronous throw behaves the same at runtime but makes the signature a lie
   * and breaks callers that expect a promise.
   */
  protected throwThrottlingException(
    _context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(
      new HttpException(
        {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests. Please slow down and try again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  }
}
