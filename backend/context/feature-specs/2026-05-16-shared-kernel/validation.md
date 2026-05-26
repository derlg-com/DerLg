# Shared Kernel — Validation Criteria

> How we know the shared kernel implementation is complete and can be merged.

---

## Functional Verification

### ConfigModule (1.1)
- [ ] `npm run start:dev` succeeds with all required env vars present
- [ ] Missing required env var → process exits with code 1 and clear error message
- [ ] `ConfigService` returns typed values for `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`

### PrismaModule (1.2)
- [ ] `PrismaService` is injectable across all modules without explicit import
- [ ] `$on('beforeExit')` or `OnModuleDestroy` closes Prisma connection on shutdown
- [ ] `PrismaService` extends `PrismaClient` (not wraps)

### RedisModule (1.3)
- [ ] `RedisService` connects on startup, logs connection success
- [ ] `setex('test_key', 60, 'value')` → `get('test_key')` returns `'value'`
- [ ] Connection failure is logged and retried (does not crash app immediately)

### ValidationPipe (1.4)
- [ ] Invalid DTO (missing required field) → 400 with `success: false`
- [ ] Extra fields in DTO → 400 (`forbidNonWhitelisted`)
- [ ] Valid DTO → transforms strings to numbers/dates correctly

### Exception Filters (1.5)
- [ ] Prisma `P2002` (unique constraint) → 409 with `DUPLICATE_ENTRY`
- [ ] Prisma `P2025` (record not found) → 404 with `RECORD_NOT_FOUND`
- [ ] Unknown error → 500 with `INTERNAL_ERROR`, stack trace in server logs only
- [ ] Unhandled exception does not crash the process

### TransformInterceptor (1.6)
- [ ] Every successful response wraps in `{ success: true, data: ... }`
- [ ] Error responses are NOT double-wrapped
- [ ] Health endpoint (`GET /health`) still returns plain `{ status: 'ok' }` if configured to bypass

### LoggingInterceptor (1.7)
- [ ] Every request logs: method, URL, status code, response time
- [ ] `X-Request-ID` is present in logs when header provided
- [ ] Authorization header is redacted (not logged)
- [ ] Password fields in request body are redacted

### JwtAuthGuard (1.8)
- [ ] Protected route without token → 401 with `AUTH_UNAUTHORIZED`
- [ ] Protected route with invalid token → 401 with `AUTH_INVALID_TOKEN`
- [ ] `@Public()` route without token → 200

### RolesGuard (1.8)
- [ ] `@Roles('admin')` with user role → 403 with `AUTH_FORBIDDEN`
- [ ] `@Roles('admin')` with admin role → 200

### Decorators (1.9)
- [ ] `@CurrentUser()` injects user payload in controller method
- [ ] `@Public()` skips JWT check
- [ ] `@Roles('admin')` sets metadata correctly

### Pagination DTO + Types (1.10)
- [ ] `PaginationDto` validates `page` ≥ 1, `limit` between 1–50
- [ ] `ApiResponse<T>` compiles for any T
- [ ] `PaginatedResponse<T>` includes `items`, `total`, `page`, `limit`, `totalPages`

### ErrorCodes Registry (1.11)
- [ ] Registry contains all ~100 codes from `ERROR-REGISTRY.md`
- [ ] No duplicate values
- [ ] All codes are `SCREAMING_SNAKE_CASE`
- [ ] Tree-shakeable const object pattern (not TS enum)

### Throttler (1.12)
- [ ] Exceeding default limit → 429 with `RATE_LIMIT_EXCEEDED`
- [ ] Auth endpoint limit (5/5min/IP) is stricter than default
- [ ] Rate limit counter resets after TTL

### Helmet + CORS (1.13)
- [ ] `X-Content-Type-Options: nosniff` present on all responses
- [ ] `X-Frame-Options: DENY` present
- [ ] CORS preflight (`OPTIONS`) succeeds for whitelisted origins
- [ ] CORS blocked for non-whitelisted origins

---

## Test Verification

### Unit Tests
- [ ] `ConfigModule` — missing var triggers exit (mock `process.exit`)
- [ ] `PrismaService` — connects and disconnects
- [ ] `RedisService` — set/get/del operations
- [ ] `TransformInterceptor` — wraps and skips correctly
- [ ] `ErrorCodes` — all code values are unique (no duplicates)
- [ ] `JwtAuthGuard` — public decorator bypass

### Integration Tests
- [ ] `GET /health` returns 200
- [ ] Invalid DTO → 400 with correct shape
- [ ] Prisma error simulation → correct status + code
- [ ] Rate limit simulation → 429

### Coverage
- [ ] `src/common/` line coverage ≥ 80%
- [ ] Critical paths (filters, guards, interceptors) ≥ 90%

---

## Lint & Format

- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format:check` passes
- [ ] No `console.log` — all logging via Pino/NestJS Logger

---

## Merge Checklist

- [ ] All tasks 1.1–1.13 implemented
- [ ] All verification items above pass
- [ ] Unit tests pass: `npm run test`
- [ ] No breaking changes to existing `/health` endpoint
- [ ] `backend/context/feature-specs/2026-05-16-shared-kernel/` updated if scope changed
- [ ] `context/plans/PROGRESS-TRACKER.md` updated
