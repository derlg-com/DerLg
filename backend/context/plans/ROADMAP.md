# DerLg Backend Implementation Roadmap

> Sequential phases, milestones, deliverables, and dependencies. Each phase builds on the previous. Do not skip phases. Do not start Phase N+1 until Phase N is complete and verified.

---

## Phase 0: Bootstrap & Tooling (Week 1)

**Goal:** A runnable NestJS project with dev environment, database connection, and CI skeleton.

### Deliverables
- [ ] `backend/` directory with NestJS 11 project
- [ ] TypeScript configured per `TECH-STACK.md`
- [ ] ESLint + Prettier configured per `CONSTITUTION.md`
- [ ] `docker-compose.yml` at repo root: Postgres 15, Redis 7, backend with hot reload
- [ ] `.env.example` with all required variables
- [ ] GitHub Actions workflow: lint, test, build on PR
- [ ] `README.md` with setup instructions

### Verification
```bash
cd backend && npm run start:dev
# Server starts on :3001
# Health check responds at GET /health
docker-compose up postgres redis
# Both services healthy
```

### Decision Log
| Date | Decision | Rationale |
|------|----------|-----------|
| — | NestJS 11 over Express/Fastify | DI, module system, decorator-based routing align with team familiarity |
| — | Docker Compose for local dev | Matches production containerization, enables integration testing |

---

## Phase 1: Foundation & Shared Kernel (Week 1–2)

**Goal:** The infrastructure layer that all feature modules depend on. Nothing ships without this.

### Deliverables
- [ ] `ConfigModule` — env validation with Joi, fail-fast on missing vars
- [ ] `PrismaModule` — global singleton, connection management
- [ ] `PrismaService` — extends `PrismaClient`, handles `$on('beforeExit')`
- [ ] `RedisModule` — `ioredis` provider, connection health check
- [ ] `RedisService` — typed wrapper with key namespacing
- [ ] Global `ValidationPipe` — `whitelist: true`, `forbidNonWhitelisted: true`
- [ ] Global exception filter — Prisma errors (`P2002`→409, `P2025`→404)
- [ ] `AllExceptionsFilter` — catch-all, structured error response
- [ ] `LoggingInterceptor` — request/response logging with Pino
- [ ] `TransformInterceptor` — wrap responses in `{ success, data }` envelope
- [ ] `JwtAuthGuard` — Bearer token validation
- [ ] `RolesGuard` — RBAC enforcement
- [ ] `@CurrentUser()` decorator — inject authenticated user
- [ ] `@Public()` decorator — bypass auth
- [ ] `@Roles()` decorator — specify required roles
- [ ] Pagination DTO — `page`, `limit` with defaults and max validation
- [ ] `ApiResponse<T>` and `PaginatedResponse<T>` interfaces
- [ ] `ErrorCodes` enum — canonical error code registry
- [ ] Throttler setup — Redis store, default 10 req/min
- [ ] Helmet + CORS configuration

### Verification
```bash
npm run test:cov
# Coverage > 80% on common/ module
npm run test:e2e
# Health check E2E passes
```

### Depends On
- Phase 0

---

## Phase 2: Database Schema (Week 2)

**Goal:** Complete Prisma schema for all 18 models, first migration, seed data.

### Deliverables
- [ ] `prisma/schema.prisma` with all models:
  - `User`, `RefreshToken`, `Trip`, `Place`, `Hotel`, `HotelRoom`
  - `Guide`, `TransportationVehicle`, `Booking`, `Payment`, `Refund`
  - `Review`, `Favorite`, `DiscountCode`, `LoyaltyTransaction`
  - `StudentVerification`, `EmergencyAlert`, `LocationShare`
  - `Notification`, `AiSession`, `AuditLog`, `Festival`
- [ ] All enums defined (`BookingStatus`, `PaymentStatus`, `UserRole`, etc.)
- [ ] All conventions applied: UUID PKs, `Decimal(10,2)`, `Timestamptz`, `deletedAt`, `@map`
- [ ] First migration: `prisma migrate dev --name init`
- [ ] Seed script: minimal data for local dev (1 admin, 1 trip, 1 hotel, 1 guide, 1 place)
- [ ] `prisma/seed.ts` wired into `package.json`

### Verification
```bash
npx prisma migrate dev
npx prisma db seed
npx prisma studio
# All models visible, seed data present
```

### Depends On
- Phase 1

---

## Phase 3: Auth & Users (Week 3)

**Goal:** Registration, login, JWT refresh, logout, password reset, Google OAuth.

### Deliverables
- [ ] `AuthModule` — service, controller, DTOs
- [ ] `POST /v1/auth/register` — bcrypt password, create user, return tokens
- [ ] `POST /v1/auth/login` — validate credentials, return tokens
- [ ] `POST /v1/auth/google` — initiate OAuth flow
- [ ] `GET /v1/auth/google/callback` — handle callback, create/link user
- [ ] `POST /v1/auth/refresh` — validate refresh token, issue new access token
- [ ] `POST /v1/auth/logout` — invalidate refresh token
- [ ] `POST /v1/auth/forgot-password` — send reset email (Resend)
- [ ] `POST /v1/auth/reset-password` — validate token, update password
- [ ] `UsersModule` — profile management
- [ ] `GET /v1/users/me` — current user profile
- [ ] `PATCH /v1/users/me` — update profile
- [ ] Refresh token rotation — new refresh token on each use
- [ ] `logout-all-devices` — invalidate all user refresh tokens in Redis

### Verification
- [ ] Unit tests: auth service (90% coverage)
- [ ] E2E tests: full auth flow
- [ ] Manual: register → login → access protected endpoint → refresh → logout

### Depends On
- Phase 1, Phase 2

---

## Phase 4: Core Inventory (Week 4–5)

**Goal:** Read-only catalog APIs for trips, places, hotels, guides, transportation.

### Deliverables
- [ ] `TripsModule` — list, detail, related trips, share, reviews, favorites
- [ ] `PlacesModule` — list, detail, related, nearby trips, nearby places
- [ ] `HotelsModule` — list, detail, room availability check
- [ ] `GuidesModule` — list, detail, availability check
- [ ] `TransportationModule` — list vehicles, detail, availability
- [ ] `SearchModule` — global search endpoint (Meilisearch integration planned, stub with DB search)
- [ ] All endpoints follow `api.yaml` specs exactly
- [ ] Redis caching for public GET endpoints (TTL per `api.yaml` `x-nfr-cache-ttl`)

### Verification
- [ ] All `api.yaml` endpoints return correct shapes
- [ ] E2E tests for each module (list + detail)
- [ ] Performance: list endpoints < 300ms with 1000 records

### Depends On
- Phase 1, Phase 2

---

## Phase 5: Booking Engine (Week 5–6)

**Goal:** Create, read, update, cancel bookings across all inventory types.

### Deliverables
- [ ] `BookingsModule` — unified booking management
- [ ] Guide booking: `POST /v1/guides/{id}/bookings`
- [ ] Hotel booking: `POST /v1/hotels/{id}/bookings`
- [ ] Transportation booking: `POST /v1/transportation/bookings`
- [ ] `GET /v1/bookings` — my bookings (unified)
- [ ] `GET /v1/bookings/{id}` — booking detail
- [ ] `PATCH /v1/bookings/{id}` — update before confirmation
- [ ] `POST /v1/bookings/{id}/cancel` — cancellation with refund calculation
- [ ] `GET /v1/bookings/{id}/qr` — booking QR code
- [ ] `GET /v1/bookings/{id}/ical` — iCalendar export
- [ ] Overbooking protection: overlap check in Prisma transaction
- [ ] Redis hold mechanism: 15-minute TTL, auto-expire via cron
- [ ] Booking status machine: `HOLD` → `PENDING_PAYMENT` → `CONFIRMED`/`CANCELLED`/`EXPIRED`

### Verification
- [ ] E2E: create booking → check hold in Redis → wait for expiry → verify `EXPIRED`
- [ ] E2E: double-book same dates → expect `409`
- [ ] Unit: refund calculation logic (100%/50%/0% tiers)

### Depends On
- Phase 3, Phase 4

---

## Phase 6: Payments (Week 6–7)

**Goal:** Stripe integration, payment intents, QR codes, webhooks, refunds.

### Deliverables
- [ ] `PaymentsModule`
- [ ] `POST /v1/payments/intent` — create Stripe PaymentIntent
- [ ] `POST /v1/payments/qr` — generate Bakong/ABA QR code
- [ ] `GET /v1/payments/{id}/status` — check payment status
- [ ] `POST /v1/payments/{id}/refund` — process refund
- [ ] `POST /v1/discount-codes/validate` — validate and return discount info
- [ ] `POST /v1/webhooks/stripe` — handle Stripe webhooks
- [ ] Webhook idempotency: `stripe_event_id` deduplication
- [ ] Payment → booking confirmation flow (webhook handler)
- [ ] Tiered refund logic in cancellation flow

### Verification
- [ ] Unit: webhook signature verification
- [ ] E2E: full payment flow with Stripe test keys
- [ ] E2E: duplicate webhook → idempotent (no double charge/booking)

### Depends On
- Phase 5

---

## Phase 7: User Features (Week 7–8)

**Goal:** Reviews, favorites, student discount, loyalty, profile enhancements.

### Deliverables
- [ ] `ReviewsModule` — create, update (7-day window), delete, list
- [ ] Verified booking badge on reviews
- [ ] `FavoritesModule` — add/remove/list, 100 max per user
- [ ] `StudentDiscountModule` — verification submission, admin approval
- [ ] `LoyaltyModule` — points balance, transaction history, redemption
- [ ] 50 points for first verified review per booking
- [ ] `ProfileModule` — extended user profile, preferences

### Verification
- [ ] E2E: submit review → check loyalty points
- [ ] E2E: student verification flow (submit → admin approve → discount active)

### Depends On
- Phase 3, Phase 4

---

## Phase 8: Async & Background (Week 8)

**Goal:** Event-driven architecture, background jobs, notification plumbing.

### Deliverables
- [ ] `EventEmitter` configured globally
- [ ] Domain events: `booking.created`, `payment.completed`, `booking.cancelled`, `review.created`
- [ ] Event handlers: non-blocking, error-isolated
- [ ] `NotificationsModule` — email (Resend), push (FCM), in-app
- [ ] `booking.created` → send confirmation email
- [ ] `payment.completed` → send receipt email + push notification
- [ ] `booking.cancelled` → send cancellation email
- [ ] Cron: `cleanupExpiredBookings` every 5 minutes
- [ ] Cron: `sendTravelReminders` daily at 9 AM Asia/Phnom_Penh
- [ ] Cron: `sendFestivalAlerts` daily at 8 AM Asia/Phnom_Penh

### Verification
- [ ] Unit: event handler isolation (one handler failure doesn't break others)
- [ ] E2E: create booking → email sent (Mailpit catch in dev)

### Depends On
- Phase 5, Phase 6

---

## Phase 9: AI Integration (Week 9)

**Goal:** AI tool endpoints for the Python LangGraph agent.

### Deliverables
- [ ] `AiToolsModule`
- [ ] `X-Service-Key` middleware validation
- [ ] `POST /v1/ai-tools/search/trips` — search trips by criteria
- [ ] `POST /v1/ai-tools/bookings` — create booking from AI context
- [ ] `POST /v1/ai-tools/payments/qr` — generate payment QR
- [ ] `POST /v1/ai-tools/budget/estimate` — calculate trip budget
- [ ] Rate limiting separate from public API
- [ ] Idempotency key support for mutating AI tools
- [ ] 10s timeout, 3 retries, circuit breaker

### Verification
- [ ] E2E: call with valid `X-Service-Key` → success
- [ ] E2E: call without key → `401`
- [ ] E2E: call with invalid key → `403`

### Depends On
- Phase 4, Phase 5, Phase 6

---

## Phase 10: Emergency & Safety (Week 10)

**Goal:** Emergency alerts, location sharing, emergency contacts.

### Deliverables
- [ ] `EmergencyModule`
- [ ] `POST /v1/emergency/alerts` — create emergency alert
- [ ] `PATCH /v1/emergency/alerts/{id}/status` — update status
- [ ] `POST /v1/emergency/alerts/{id}/acknowledge` — acknowledge alert
- [ ] `POST /v1/emergency/alerts/{id}/resolve` — resolve alert
- [ ] `POST /v1/location-shares` — create shareable location link
- [ ] `GET /v1/location-shares/{token}` — view shared location
- [ ] `POST /v1/location-shares/{token}/revoke` — revoke share
- [ ] `GET /v1/emergency/contacts` — get emergency contact list

### Verification
- [ ] E2E: create alert → acknowledge → resolve
- [ ] E2E: location share → view → revoke → 404

### Depends On
- Phase 3

---

## Phase 11: Admin & Operations (Week 11)

**Goal:** Admin endpoints, analytics, audit logs, health checks.

### Deliverables
- [ ] `AdminModule` — admin-only endpoints
- [ ] `GET /v1/admin/student-verifications` — pending list
- [ ] `POST /v1/admin/student-verifications/{id}/approve`
- [ ] `POST /v1/admin/student-verifications/{id}/reject`
- [ ] `GET /v1/admin/analytics` — key metrics
- [ ] `GET /v1/admin/audit-logs` — activity log
- [ ] `GET /v1/health` — DB + Redis health checks
- [ ] `GET /v1/health/detailed` — extended diagnostics (admin only)
- [ ] Audit interceptor — log all mutations with user ID, timestamp

### Verification
- [ ] E2E: admin endpoint without admin role → `403`
- [ ] E2E: create booking → audit log entry exists

### Depends On
- Phase 3, Phase 7, Phase 8

---

## Phase 12: Testing Hardening (Week 12)

**Goal:** Achieve coverage gates, property-based tests, performance baseline.

### Deliverables
- [ ] Unit test coverage ≥ 80% (90% for auth, booking, payment)
- [ ] Property-based tests: input validation, state transitions, idempotency
- [ ] E2E tests for all critical flows
- [ ] Load test: 100 concurrent booking creations, < 1% failure rate
- [ ] Performance benchmark: list endpoints < 300ms, detail endpoints < 200ms
- [ ] Security scan: no hardcoded secrets, no SQL injection vectors
- [ ] Fix all critical and high severity issues

### Verification
```bash
npm run test:cov
# Coverage report meets gates
npm run test:e2e
# All E2E pass
npm run test:property
# All property tests pass
```

### Depends On
- All previous phases

---

## Phase 13: Production Readiness (Week 13)

**Goal:** Deployment configuration, monitoring, documentation.

### Deliverables
- [ ] Production Dockerfile (multi-stage)
- [ ] `docker-compose.prod.yml`
- [ ] Environment-specific config: dev, staging, production
- [ ] Sentry integration for error tracking
- [ ] API documentation with Swagger (auto-generated)
- [ ] OpenAPI spec export for frontend consumption
- [ ] Graceful shutdown handling
- [ ] Database backup strategy documented
- [ ] Runbook: common incidents and resolution steps

### Verification
- [ ] Deploy to staging: all health checks pass
- [ ] E2E suite passes against staging
- [ ] Security scan passes

### Depends On
- Phase 12

---

## Milestone Summary

| Milestone | Phase | Definition of Done |
|-----------|-------|-------------------|
| **M0: Bootstrap** | 0 | `docker-compose up` brings up backend + DB + Redis |
| **M1: Foundation** | 1–2 | Any team member can create a new module following existing patterns |
| **M2: Auth** | 3 | Full auth flow works end-to-end |
| **M3: Catalog** | 4 | Frontend can browse all inventory types |
| **M4: Booking** | 5 | Booking creation + hold + expiry works |
| **M5: Payments** | 6 | Test payment completes, webhook confirms booking |
| **M6: User** | 7 | Reviews, favorites, loyalty functional |
| **M7: Async** | 8 | Background jobs run, notifications sent |
| **M8: AI** | 9 | AI agent can call all tool endpoints |
| **M9: Safety** | 10 | Emergency features functional |
| **M10: Admin** | 11 | Admin dashboard APIs ready |
| **M11: Quality** | 12 | Coverage gates met, E2E green |
| **M12: Live** | 13 | Deployed to production |

---

## Dependency Graph

```
Phase 0 (Bootstrap)
  └── Phase 1 (Foundation)
        ├── Phase 2 (Schema)
        │     └── Phase 3 (Auth)
        │           └── Phase 7 (User) ──┐
        │     └── Phase 4 (Catalog) ─────┤
        │           └── Phase 5 (Booking) ├── Phase 6 (Payments)
        │                                   │     └── Phase 8 (Async)
        │                                   │           └── Phase 11 (Admin)
        │                                   └── Phase 9 (AI)
        │     └── Phase 10 (Emergency)
        └── Phase 12 (Testing)
              └── Phase 13 (Production)
```

---

## Decision Log

| Date | Phase | Decision | Rationale | Status |
|------|-------|----------|-----------|--------|
| — | 0 | NestJS 11 | Team familiarity, decorator-based DI, ecosystem | Decided |
| — | 0 | Docker Compose local | Matches prod, enables integration testing | Decided |
| — | 1 | Custom JWT (not Supabase Auth) | Backend controls token lifecycle, multi-device logout | Decided |
| — | 1 | Prisma ORM | Type safety, migration system, team experience | Decided |
| — | 1 | ioredis over node-redis | Better cluster support, more active maintenance | Decided |
| — | 2 | Soft delete global (`deletedAt`) | GDPR compliance, audit trail, accidental delete recovery | Decided |
| — | 2 | Decimal(10,2) for money | Precision, no floating-point errors | Decided |
| — | 5 | Redis hold (not DB status) | Fast expiry, no DB polling, automatic cleanup | Decided |
| — | 6 | Stripe only (defer Bakong direct) | Stripe supports QR, faster MVP, less compliance | Decided |
| — | 8 | EventEmitter (not message queue) | Sufficient for single-instance, Redis Pub/Sub for scaling | Decided |
| — | 9 | AI tools as REST (not gRPC) | Simpler, existing HTTP stack, no proto overhead | Decided |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stripe webhook handling complexity | Medium | High | Extensive E2E testing with Stripe CLI, idempotency guards |
| Booking overbooking race condition | Medium | Critical | Prisma transaction with SELECT FOR UPDATE, Redis hold |
| AI service latency | High | Medium | Circuit breaker, timeout, fallback to cached responses |
| Student verification fraud | Medium | Medium | Manual admin review, document upload to Supabase Storage |
| Database performance at scale | Low | High | Connection pooling, query optimization, Redis caching |
| JWT secret rotation | Low | High | Support rotation grace period, dual-secret validation |

---

## References

- Constitution (rules all code must follow): `CONSTITUTION.md`
- Tech stack (exact versions): `TECH-STACK.md`
- Existing backend docs: `docs/platform/backend/`
- Requirements: `.kiro/specs/backend-nestjs-supabase/requirements.md`
- Design: `.kiro/specs/backend-nestjs-supabase/design.md`
- Tasks (detailed): `.kiro/specs/backend-nestjs-supabase/tasks.md`
- Module APIs: `docs/modules/*/api.yaml`
