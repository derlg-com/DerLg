# Core Infrastructure

> **Phase 1** — Build the basement every module will stand on. No business logic here.

---

## Configuration

- `ConfigModule` loaded globally with validation schema (Joi or `zod` via `@nestjs/config`).
- `ConfigService` typed so environment access is autocompleted and validated at startup.
- **Fail-fast:** If a required env var is missing or invalid, the process exits on bootstrap with a descriptive error.

---

## Database Access

- `PrismaModule` registered as a **global singleton**.
- **Lifecycle:** `onModuleInit` → `$connect`; `onModuleShutdown` → `$disconnect`.
- **Raw query policy:** Allowed only for performance-critical reads or complex aggregations. Must be reviewed and commented with justification.
- **Transaction rules:** Documented in `Async Architecture` for multi-step flows; simple CRUD uses Prisma implicit transactions.

---

## Global HTTP Pipeline

| Concern | Decision |
|---------|----------|
| API prefix | `/v1/` |
| Response envelope | `{ success: boolean, data: unknown, message: string \| null, error: object \| null }` — enforced globally via `TransformInterceptor` |
| Validation | `ValidationPipe` with `class-validator` + `class-transformer`; `whitelist: true`, `forbidNonWhitelisted: true` |
| Exception mapping | Global filter maps Prisma errors to HTTP codes (`P2002` → 409, `P2025` → 404); unknown errors → 500 with safe message |

---

## Cross-Cutting Behaviors

| Concern | Implementation |
|---------|----------------|
| Request / correlation ID | `X-Request-Id` injected by middleware; propagated to logs and downstream calls |
| Structured logging | Pino (via `nestjs-pino`) — JSON output, configurable redaction for headers/cookies |
| Rate limiting | `@nestjs/throttler` with Redis store; public endpoints default to 5 req / 5 min / IP |
| CORS | Whitelist configured via env vars; reject all non-whitelisted origins in production |

---

## Security Baseline

- **Helmet** middleware enabled for all routes.
- **CSP** only if backend ever serves HTML (unlikely); keep minimal.
- **Secret validation:** All secrets loaded at startup; missing secrets trigger immediate exit.

---

## Error Architecture

### Error Response Structure

All errors follow a consistent format:

```typescript
interface ErrorResponse {
  success: false;
  data: null;
  message: string;
  error: {
    code: string;
    details?: Record<string, any>;
  };
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TOKEN_EXPIRED` | 401 | JWT access token has expired |
| `TOKEN_INVALID` | 401 | JWT token is malformed or invalid |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Request data failed validation |
| `DUPLICATE_RECORD` | 409 | Record with unique constraint already exists |
| `NOT_FOUND` | 404 | Record not found |
| `INVALID_REFERENCE` | 400 | Foreign key constraint failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from this client |
| `SERVICE_UNAVAILABLE` | 503 | External service (Stripe, etc.) unavailable |

### Resilience Patterns

**Retry Logic**

External service calls (Stripe, Resend, exchange rate APIs) use exponential backoff:

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T>;
```

**Circuit Breaker**

Protect against cascading failures with a simple state machine (`CLOSED` → `OPEN` → `HALF_OPEN`):

- Failure threshold: 5 consecutive errors
- Timeout before retry: 60 seconds
- When `OPEN`: fail fast with `SERVICE_UNAVAILABLE`

---

## Redis Integration

### Redis Key Patterns

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `booking_hold:{bookingId}` | Temporary inventory hold | 900s (15 min) |
| `refresh_token_version:{userId}` | Current refresh token generation | permanent |
| `session:{sessionId}` | AI conversation state | 604800s (7 days) |
| `currency:rates` | Cached exchange rates | 3600s (1 hour) |
| `weather:{city}` | Cached weather data | 3600s (1 hour) |
| `rate_limit:{endpoint}:{identifier}:{window}` | Rate limit counters | window duration |
| `payment_events:{userId}` | Pub/sub channel for real-time payment updates | N/A |

### Redis Service

`RedisModule` provides a thin wrapper around `ioredis`:

```typescript
@Injectable()
export class RedisService {
  async get(key: string): Promise<string | null>;
  async set(key: string, value: string): Promise<void>;
  async setex(key: string, seconds: number, value: string): Promise<void>;
  async del(key: string): Promise<void>;
  async incr(key: string): Promise<number>;
  async expire(key: string, seconds: number): Promise<void>;
  async publish(channel: string, message: string): Promise<void>;
  async subscribe(channel: string, callback: (message: string) => void): Promise<void>;
}
```

**Rate limiting implementation:** Uses `incr` + `expire` in Redis. Keys are scoped by endpoint + user/IP + time window.

---

## Checklist

- [ ] `ConfigModule` with validation schema
- [ ] `PrismaModule` global + lifecycle hooks
- [ ] `/v1/` prefix confirmed in bootstrap
- [ ] Global `ValidationPipe` with `whitelist: true`
- [ ] Global exception filter mapping Prisma errors
- [ ] Pino logger configured with redaction
- [ ] Throttler with Redis store configured
- [ ] Helmet middleware applied
- [ ] Error codes reference defined and documented
- [ ] Retry helper with exponential backoff
- [ ] Circuit breaker pattern implemented for external services
- [ ] Redis service wrapper with typed key helpers
