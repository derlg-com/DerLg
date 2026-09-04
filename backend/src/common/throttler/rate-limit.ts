import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Rate-limit presets, declared once.
 *
 * ## Why a single `default` throttler
 *
 * `ThrottlerGuard.canActivate` iterates **every** throttler registered in
 * `ThrottlerModule` and requires all of them to pass. Registering named
 * `auth` (5/5min) and `payment` (3/min) limiters globally therefore capped the
 * whole API at 3 requests/minute — the strictest limiter wins everywhere, not
 * just on the routes it was named for.
 *
 * So exactly one throttler (`default`) is registered, and per-route intent is
 * expressed by overriding it with one of the presets below. Same effect, no
 * cross-talk, and the numbers live in one file instead of being scattered as
 * magic values across 20 controllers.
 *
 * ## Choosing a preset
 *
 * | Preset      | Use for                                                  |
 * |-------------|----------------------------------------------------------|
 * | `AUTH`      | Credential endpoints. Brute-force is the threat.         |
 * | `PAYMENT`   | Money movement / QR minting.                             |
 * | `SENSITIVE` | Account recovery, password resets, invite sends.          |
 * | `WRITE`     | Ordinary authenticated mutations.                        |
 * | `ADMIN`     | Admin panel reads and writes (dashboards poll).          |
 * | `UPLOAD`    | Presigned-URL minting — each one is a write capability.  |
 * | `BROADCAST` | Fan-out to many external recipients.                     |
 * | `SERVICE`   | Trusted service-to-service (AI agent tool loops).        |
 * | `PUBLIC`    | Unauthenticated catalogue browsing.                      |
 *
 * TTLs are in milliseconds, matching `@nestjs/throttler`.
 */
export const RATE_LIMITS = {
  /** Global fallback. Generous: a single page can fan out several requests. */
  DEFAULT: { limit: 120, ttl: 60_000 },
  AUTH: { limit: 5, ttl: 300_000 },
  SENSITIVE: { limit: 3, ttl: 900_000 },
  PAYMENT: { limit: 3, ttl: 60_000 },
  WRITE: { limit: 30, ttl: 60_000 },
  ADMIN: { limit: 60, ttl: 60_000 },
  UPLOAD: { limit: 30, ttl: 60_000 },
  BROADCAST: { limit: 5, ttl: 60_000 },
  SERVICE: { limit: 600, ttl: 60_000 },
  PUBLIC: { limit: 120, ttl: 60_000 },
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMITS;

/**
 * Applies a named preset to a controller or handler.
 *
 * ```ts
 * @RateLimit('AUTH')
 * @Post('login')
 * login() {}
 * ```
 *
 * Overrides the `default` throttler for that route only, so the global limit
 * still applies to everything else.
 */
export const RateLimit = (
  preset: RateLimitPreset,
): MethodDecorator & ClassDecorator =>
  Throttle({ default: RATE_LIMITS[preset] });

/**
 * Opts a route out of rate limiting entirely.
 *
 * Reserved for endpoints an external system retries on our behalf and where a
 * 429 would cause data loss — e.g. the Telegram webhook, which drops updates it
 * cannot deliver. Such routes must be protected by a secret instead.
 */
export const NoRateLimit = (): MethodDecorator & ClassDecorator =>
  SkipThrottle();
