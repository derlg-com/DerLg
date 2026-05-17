# DerLg Backend Constitution

> The immutable rules, patterns, and constraints that all backend code MUST follow. This document is law. If existing code violates it, the code is wrong. If a requirement conflicts with it, the requirement is wrong.

---

## 1. Module Architecture

### 1.1 Module Structure
Every feature module MUST follow this exact structure:

```
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  <feature>.dto.ts
```

Optional additions (only when needed):

```
  <feature>.repository.ts   # Only if query complexity justifies abstraction
  <feature>.guard.ts        # Only if feature-specific auth logic
  <feature>.scheduler.ts    # Only if feature has background jobs
```

### 1.2 Dependency Rules
The dependency graph is a DAG. Cycles are forbidden.

**Feature modules MAY import:**
- `CommonModule` — guards, interceptors, filters, decorators, pipes
- `PrismaModule` — database access
- `RedisModule` — caching and holds
- `AuthModule` — JWT validation, `@CurrentUser()`
- `UsersModule` — user data lookups
- `NotificationsModule` — event publishing

**Feature modules MUST NOT import each other directly.**
Cross-feature coordination happens through:
1. Domain events (NestJS EventEmitter) for loose coupling
2. Prisma foreign keys for data relationships
3. The `BookingOrchestratorService` (planned) for transaction sagas

**Enforcement:** ESLint rule `no-restricted-imports` with a deny-list for cross-feature imports.

### 1.3 Controller Conventions
- All routes under `/v1/` prefix (configured once in `main.ts`)
- One controller per module, no sub-routers
- `@Controller('v1/<plural-noun>')` — plural, kebab-case
- Public endpoints: `@Public()` decorator
- Auth endpoints: `@UseGuards(JwtAuthGuard)`
- Admin endpoints: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`

---

## 2. API Contract

### 2.1 Response Envelope
Every response body MUST be:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

- `200`/`201`: `{ success: true, data: T }`
- `400`: `{ success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }`
- `401`: `{ success: false, error: { code: 'UNAUTHORIZED', message: '...' } }`
- `403`: `{ success: false, error: { code: 'FORBIDDEN', message: '...' } }`
- `404`: `{ success: false, error: { code: 'NOT_FOUND', message: '...' } }`
- `409`: `{ success: false, error: { code: 'CONFLICT', message: '...' } }`
- `500`: `{ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }`

### 2.2 Error Codes
Error codes are `SCREAMING_SNAKE_CASE`, domain-prefixed:

| Domain | Prefix | Example |
|--------|--------|---------|
| Auth | `AUTH_` | `AUTH_INVALID_CREDENTIALS` |
| Booking | `BKNG_` | `BKNG_UNAVAILABLE` |
| Payment | `PAY_` | `PAY_INTENT_FAILED` |
| Validation | `VAL_` | `VAL_INVALID_DATE_RANGE` |
| Generic | none | `NOT_FOUND`, `UNAUTHORIZED` |

New error codes MUST be added to `src/common/errors/error-codes.ts`.

### 2.3 HTTP Status Mapping
- `400` — validation failure, bad query params, malformed request
- `401` — missing or invalid JWT
- `403` — valid JWT but insufficient permissions
- `404` — resource not found (idempotent: calling again yields same result)
- `409` — resource conflict (double booking, duplicate key)
- `422` — semantically valid but business rule violation (cancel too late)
- `429` — rate limit exceeded
- `500` — unexpected server error (log and alert, generic message to client)

### 2.4 Pagination
All list endpoints MUST accept and return:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

Defaults: `page=1`, `limit=20`. Maximum `limit=50`.

### 2.5 Idempotency
Mutating endpoints MUST support idempotency:
- Client generates `Idempotency-Key: <uuid>` header
- Server stores `idempotency:{key}` in Redis with 24h TTL
- On duplicate key within TTL, replay the stored response
- Endpoints requiring idempotency: booking creation, payment intent, cancellation, review submit

---

## 3. Data Layer

### 3.1 Prisma Conventions
- Table names: `snake_case`, plural: `hotel_rooms`, `booking_payments`
- Model names: `PascalCase`, singular: `HotelRoom`, `BookingPayment`
- Field names: `camelCase` in Prisma schema, mapped to `snake_case` in DB via `@map`
- UUID primary keys: `id String @id @default(uuid())`
- Money: `Decimal @db.Decimal(10, 2)` — never `Float`
- Timestamps: `DateTime @db.Timestamptz(6)`
- Soft delete: `deletedAt DateTime?` on every table
- JSONB for flexible structures: `Json? @db.JsonB`
- All enums defined in Prisma schema, mapped to DB enums

### 3.2 Database Query Rules
1. **Never SELECT *** — always specify fields
2. **Never N+1** — use `include` or raw query with joins
3. **Transaction boundaries** — use Prisma `$transaction` for multi-write ops
4. **No raw SQL for writes** — raw queries are read-only except migrations
5. **Connection pooling** — Prisma connection limit set to `5` in serverless, `20` in containerized

### 3.3 Redis Key Conventions
All Redis keys use `colon` namespacing:

```
session:{userId}              # Active JWT session metadata
booking_hold:{bookingId}      # TTL = hold duration (900s)
idempotency:{key}             # TTL = 86400
rate_limit:{ip}:{endpoint}    # TTL = window duration
cache:{entity}:{id}           # TTL = domain-specific
search:{hash}                 # Cached search results
```

---

## 4. Authentication & Authorization

### 4.1 Token Strategy
- Custom JWTs, backend-issued. Supabase Auth is NOT the source of truth.
- Access token: 15 minutes, Bearer header
- Refresh token: 7 days, httpOnly Secure SameSite=Strict cookie
- Refresh tokens stored in Redis with user-scoped prefix for "logout all devices"

### 4.2 Authorization Matrix
| Role | Capabilities |
|------|-------------|
| `user` | Own bookings, own reviews, own favorites, own profile |
| `student` | All `user` + student discount eligibility |
| `guide` | Own guide profile, own bookings as service provider |
| `admin` | All resources, admin endpoints, user management |

### 4.3 Security Rules
- Never log JWTs, passwords, or payment tokens
- All secrets in environment variables, never committed
- Passwords: bcrypt with cost factor 12
- CORS whitelist enforced in production
- Helmet headers on all responses
- Rate limiting: auth endpoints 5/5min/IP, payments 3/min/user
- Webhook signatures verified before processing

---

## 5. Naming Conventions

### 5.1 Files
| Category | Pattern | Example |
|----------|---------|---------|
| Module | `feature.module.ts` | `auth.module.ts` |
| Controller | `feature.controller.ts` | `auth.controller.ts` |
| Service | `feature.service.ts` | `auth.service.ts` |
| DTO (create) | `create-feature.dto.ts` | `create-booking.dto.ts` |
| DTO (update) | `update-feature.dto.ts` | `update-booking.dto.ts` |
| Guard | `feature.guard.ts` | `roles.guard.ts` |
| Interceptor | `feature.interceptor.ts` | `logging.interceptor.ts` |
| Test (unit) | `*.spec.ts` | `auth.service.spec.ts` |
| Test (E2E) | `*.e2e-spec.ts` | `auth.e2e-spec.ts` |

### 5.2 Code
| Category | Convention | Example |
|----------|-----------|---------|
| Classes | PascalCase | `AuthService` |
| Functions / variables | camelCase | `getUserProfile` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enums | PascalCase, members UPPER_SNAKE_CASE | `BookingStatus.HOLD` |
| Interfaces | PascalCase, no `I` prefix | `UserProfile` |
| Type aliases | PascalCase | `UserId = string` |

---

## 6. Testing Requirements

### 6.1 Coverage Gates
- Unit tests: **80% minimum** line coverage
- Critical paths (booking, payment, auth): **90% minimum**
- E2E tests for: auth flow, booking creation, payment completion, cancellation

### 6.2 Test Structure
- Unit tests colocated or alongside source: `*.spec.ts`
- E2E tests in `test/`: `*.e2e-spec.ts`
- Property-based tests with `fast-check` for validation logic
- Mock external services (Stripe, Resend, FCM); never hit real APIs in tests
- Database: use a separate test database, wipe between E2E suites

### 6.3 Required Test Types
1. **Unit** — services, utilities, DTO validation
2. **Integration** — controller + service + Prisma (in-memory or test DB)
3. **Property-based** — input validation, state transitions, idempotency
4. **E2E** — full request/response cycle for critical flows

---

## 7. Async & Background Processing

### 7.1 Events
- Use NestJS `EventEmitter` for intra-process events
- Event names: `domain.action` — e.g., `booking.created`, `payment.completed`
- Event payload: plain objects, serializable
- No awaiting event handlers in the request path

### 7.2 Background Jobs
- Implemented as NestJS `@Cron()` or `@Interval()` decorators
- Jobs MUST be idempotent (safe to run multiple times)
- Jobs MUST handle their own errors (try/catch + log)
- Scheduled jobs:
  - `cleanupExpiredBookings` — every 5 minutes
  - `sendTravelReminders` — daily at 9 AM Asia/Phnom_Penh
  - `sendFestivalAlerts` — daily at 8 AM Asia/Phnom_Penh

### 7.3 Notification Plumbing
- Notifications are fire-and-forget from the request path
- Supported channels: email (Resend), push (FCM), in-app
- Channel selection based on user preference + urgency

---

## 8. AI Integration Rules

### 8.1 Service Boundary
- The AI agent (Python/LangGraph) NEVER writes directly to the database
- AI calls backend via `/v1/ai-tools/*` endpoints with `X-Service-Key` header
- Backend validates `X-Service-Key` against `AI_SERVICE_KEY` env var
- AI tool endpoints are rate-limited separately from public API

### 8.2 Tool Endpoints
All AI tool endpoints:
- Accept `POST` with structured request body
- Return `{ success, data }` envelope
- Support idempotency key for mutating operations
- Timeout: 10 seconds, 3 retries with exponential backoff
- Circuit breaker: open after 5 failures in 60 seconds

---

## 9. Booking & Payment Rules

### 9.1 Booking Hold
- All bookings start in `HOLD` status
- Redis key `booking_hold:{bookingId}` with TTL = 900 seconds (15 minutes)
- If TTL expires before payment → status becomes `EXPIRED`, inventory released
- Overbooking protection: overlap check against `CONFIRMED`, `PENDING_PAYMENT`, `HOLD`

### 9.2 Payment Flow
1. Client creates booking → `HOLD`
2. Client creates payment intent → `PENDING_PAYMENT`
3. Stripe confirms → `CONFIRMED`
4. Webhook updates booking, releases hold, triggers notifications

### 9.3 Refunds
- Tiered by cancellation proximity to start date:
  - > 7 days: 100%
  - 3–7 days: 50%
  - < 3 days: 0%
- Refund processed via Stripe; record in `refunds` table
- Idempotency via `stripe_event_id` on webhook processing

---

## 10. Operational Rules

### 10.1 Logging
- Use Pino structured logging only
- Log levels: `debug` (dev), `info` (normal), `warn` (degraded), `error` (alert)
- Never log PII, tokens, or card numbers
- Correlation ID via `X-Request-ID` header, propagated to all services

### 10.2 Health Checks
- `/health` endpoint: DB connection + Redis connection
- Failures return `503` with details
- Used by load balancer and monitoring

### 10.3 Graceful Shutdown
- On `SIGTERM`: stop accepting new requests, finish in-flight requests, close DB/Redis connections
- NestJS `onApplicationShutdown` hook

### 10.4 Environment Validation
- All env vars validated at startup via `ConfigModule` + `Zod` or `class-validator`
- Missing required vars → process exits with code 1 and clear error message
- No fallback defaults for secrets or database URLs

---

## 11. Change Process

This constitution changes by **explicit amendment only**:

1. Propose change with rationale
2. Review against existing modules for impact
3. Update this document
4. Update affected modules
5. Record amendment in decision log (see `context/plans/roadmap.md`)

**What requires amendment:**
- Adding a new module dependency rule
- Changing the API envelope shape
- Changing auth token strategy
- Changing database conventions
- Changing testing coverage gates

**What does NOT require amendment:**
- Adding a new feature module (follow existing patterns)
- Adding a new endpoint to an existing module
- Adding a new DTO field
- Adding a new error code

---

## 12. References

- Module API specs: `docs/modules/*/api.yaml`
- Backend architecture: `docs/platform/backend/index.md`
- Security design: `docs/platform/backend/security.md`
- Async architecture: `docs/platform/backend/async-architecture.md`
- AI integration: `docs/platform/backend/ai-integration.md`
- Operations: `docs/platform/backend/operations.md`
- Full requirements: `.kiro/specs/backend-nestjs-supabase/requirements.md`
- Design details: `.kiro/specs/backend-nestjs-supabase/design.md`
