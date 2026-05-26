# DerLg Backend Implementation Roadmap

> **What this is:** A sequential, phase-driven task index with detailed deliverables, verification criteria, dependencies, and a week-by-week execution plan. This is the single source of truth for backend implementation.
> **What this is NOT:** File-level implementation plans — you define those yourself per task using the referenced specs.

---

## How to Use

1. **Pick the next unfinished phase** (top to bottom, respect dependencies)
2. **Read the referenced spec docs** — they are your source of truth
3. **Write your own implementation plan** for that phase using the task tables
4. **Implement, test, verify** per the verification criteria
5. **Update `PROGRESS-TRACKER.md`** when done

---

## Project Folder Structure

> NestJS modular architecture with clear separation of concerns. Every file has a predictable location.

### Root Layout

```
backend/
├── src/                          # Application source
│   ├── main.ts                   # Bootstrap: guards, pipes, interceptors, global prefix
│   ├── app.module.ts             # Root module: imports all feature + shared modules
│   ├── common/                   # Shared kernel (Track 1)
│   ├── config/                   # Env validation & typed config service
│   ├── prisma/                   # Prisma client module + service
│   ├── redis/                    # Redis module + typed wrapper
│   ├── auth/                     # Phase 3: JWT, OAuth, password reset
│   ├── users/                    # Phase 3: profile management
│   ├── trips/                    # Phase 4: trip catalog
│   ├── places/                   # Phase 4: place catalog
│   ├── hotels/                   # Phase 4: hotel + room catalog
│   ├── guides/                   # Phase 4: guide catalog
│   ├── transportation/           # Phase 4: vehicle catalog
│   ├── search/                   # Phase 4: global search
│   ├── bookings/                 # Phase 5: booking engine
│   ├── payments/                 # Phase 6: Stripe, QR, webhooks, refunds
│   ├── reviews/                  # Phase 7: reviews + verified badge
│   ├── favorites/                # Phase 7: wishlist
│   ├── student-discount/         # Phase 7: verification flow
│   ├── loyalty/                  # Phase 7: points + redemption
│   ├── notifications/            # Phase 8: email, push, in-app
│   ├── ai-tools/                 # Phase 9: AI agent endpoints
│   ├── emergency/                # Phase 10: alerts, location sharing
│   └── admin/                    # Phase 11: admin-only ops
├── prisma/
│   ├── schema.prisma             # Generator + datasource + shared enums
│   ├── models/                   # Domain-split model files (Phase 2)
│   │   ├── user.prisma
│   │   ├── trip.prisma
│   │   ├── inventory.prisma
│   │   ├── booking.prisma
│   │   ├── payment.prisma
│   │   ├── review.prisma
│   │   ├── engagement.prisma
│   │   ├── emergency.prisma
│   │   ├── notification.prisma
│   │   └── system.prisma
│   ├── migrations/               # Generated migration files
│   └── seed.ts                   # Seed script
├── test/                         # E2E tests (*.e2e-spec.ts)
├── docker-compose.yml            # Redis 8.6 (dev; Supabase provides PG)
├── docker-compose.prod.yml       # Postgres 15 + Redis 8.6 + backend
├── Dockerfile                    # Multi-stage production build (Phase 13)
├── .env.example                  # All required env vars documented
├── nest-cli.json
├── tsconfig.json
├── package.json
└── README.md
```

### Module File Convention (Every Feature Module)

Each feature module lives in `src/<feature>/` and follows this exact file layout:

```
src/<feature>/
  <feature>.module.ts          # Module declaration + imports/exports/providers
  <feature>.controller.ts      # HTTP routes (one per module, @Controller('v1/<plural>'))
  <feature>.service.ts         # Business logic + Prisma calls
  <feature>.dto.ts             # Request/response DTOs (create, update, query)
```

**Optional additions (only when justified):**

```
  <feature>.repository.ts      # ONLY if query complexity warrants abstraction beyond service
  <feature>.guard.ts           # ONLY if feature-specific auth logic (rare)
  <feature>.scheduler.ts       # ONLY if feature has background cron jobs
```

### Cross-Cutting Modules (`src/common/`)

```
src/common/
  common.module.ts              # Exports: guards, interceptors, filters, decorators, pipes
  decorators/
    current-user.decorator.ts   # @CurrentUser() — inject authenticated user
    public.decorator.ts         # @Public() — bypass auth
    roles.decorator.ts          # @Roles('admin') — RBAC metadata
  dto/
    pagination.dto.ts           # PageQueryDto with defaults + max validation
  errors/
    error-codes.ts              # ~100 domain-prefixed error codes
  filters/
    all-exceptions.filter.ts    # Catch-all → structured 500 envelope
    prisma.filter.ts            # P2002→409, P2025→404, etc.
  guards/
    jwt-auth.guard.ts           # Bearer token validation
    roles.guard.ts              # RBAC enforcement
    throttler.guard.ts          # Rate-limit guard
  interceptors/
    logging.interceptor.ts      # Pino structured request/response logs
    transform.interceptor.ts    # Wrap all responses in { success, data }
  strategies/
    jwt.strategy.ts             # Passport JWT validation
  types/
    api-response.type.ts        # ApiResponse<T> interface
    paginated-response.type.ts  # PaginatedResponse<T> interface
```

### Import Rules (Enforced by ESLint)

**Feature modules MAY import:**
- `CommonModule` — guards, interceptors, filters, decorators, pipes
- `PrismaModule` — database access
- `RedisModule` — caching and holds
- `AuthModule` — JWT validation, `@CurrentUser()`
- `UsersModule` — user data lookups
- `NotificationsModule` — event publishing

**Feature modules MUST NOT import each other directly.**
Cross-feature coordination happens through:
1. Domain events (`EventEmitter`) for loose coupling
2. Prisma foreign keys for data relationships
3. `BookingOrchestratorService` (planned) for transaction sagas

**Enforcement:** ESLint `no-restricted-imports` with a deny-list for cross-feature imports.

### Test File Locations

| Test Type | Location | Pattern |
|-----------|----------|---------|
| Unit / Integration | Colocated with source | `*.spec.ts` |
| E2E | `test/` directory | `*.e2e-spec.ts` |
| Property-based | Colocated or `test/property/` | `*.property.spec.ts` |

---

## Current State

| What Exists | Status |
|-------------|--------|
| NestJS 11 scaffold (`src/`) | Customized with shared kernel |
| Phase 0: Bootstrap & Tooling | Complete (CI deferred) |
| Phase 1: Foundation & Shared Kernel | Complete (all 13 tasks) |
| Prisma schema (`prisma/schema.prisma`) | Written (38KB, all models — monolithic, needs multi-file split) |
| Prisma migrations dir | Exists (empty — pending init) |
| Prisma seeds dir | Exists (script pending) |
| Context docs (`backend/context/`) | Complete spec suite |
| Feature module code (`src/<feature>/`) | None created yet |
| Docker Compose | `docker-compose.yml` + `docker-compose.prod.yml` created |
| CI/CD pipeline | Deferred to follow-up branch |

---

## Dependency Graph

```
Phase 0 (Bootstrap & Tooling)
  └── Phase 1 (Foundation & Shared Kernel)
        ├── Phase 2 (Database Schema)
        │     └── Phase 3 (Auth & Users)
        │           ├── Phase 7 (User Features)
        │           └── Phase 10 (Emergency & Safety)
        │     └── Phase 4 (Core Inventory)
        │           ├── Phase 5 (Booking Engine)
        │           │     ├── Phase 6 (Payments)
        │           │     │     └── Phase 8 (Async & Background)
        │           │     │           └── Phase 11 (Admin & Operations)
        │           │     └── Phase 9 (AI Integration)
        │           └── Phase 12 (Testing Hardening)
        │                 └── Phase 13 (Production Readiness)
```

---

## Milestone Summary

| Milestone | Phase | Definition of Done | Week |
|-----------|-------|-------------------|------|
| **M0: Bootstrap** | 0 | `docker-compose up` brings up backend + DB + Redis | 1 |
| **M1: Foundation** | 1 | Any team member can create a new module following existing patterns | 1-2 |
| **M2: Schema** | 2 | Database migrated, seeded, all models visible in Prisma Studio | 2 |
| **M3: Auth** | 3 | Full auth flow works end-to-end (register→login→refresh→logout) | 3 |
| **M4: Catalog** | 4 | Frontend can browse all inventory types with Redis caching | 4-5 |
| **M5: Booking** | 5 | Booking creation + hold + expiry + overbooking protection works | 5-6 |
| **M6: Payments** | 6 | Test payment completes, webhook confirms booking, refunds work | 6-7 |
| **M7: User** | 7 | Reviews, favorites, loyalty, student discount functional | 7-8 |
| **M8: Async** | 8 | Background jobs run, notifications sent, cron jobs active | 8 |
| **M9: AI** | 9 | AI agent can call all tool endpoints with service key auth | 9 |
| **M10: Safety** | 10 | Emergency alerts, location sharing, contacts functional | 10 |
| **M11: Admin** | 11 | Admin dashboard APIs, analytics, audit logs ready | 10 |
| **M12: Quality** | 12 | Coverage gates met, E2E green, load tests pass | 11 |
| **M13: Live** | 13 | Deployed to production with monitoring and runbooks | 12 |

---

## Phase 0: Bootstrap & Tooling (Week 1)

> **Goal:** A runnable NestJS project with dev environment, database connection, and CI skeleton. Nothing else starts until this works.

### Folder Impact
- Root: `docker-compose.yml`, `.env.example`, `.github/workflows/`
- `src/main.ts` — port 3001, `/health`, global prefix `/v1`

### Tasks

| # | Task | Spec Reference | Verification |
|---|------|----------------|-------------|
| 0.1 | Configure TypeScript per project standards | `TECH-STACK.md` Runtime, Language | `npm run build` succeeds |
| 0.2 | Configure ESLint + Prettier | `CODE-STANDARD.md` 1, `.prettierrc` | `npm run lint && npm run format` clean |
| 0.3 | Create `docker-compose.yml` (Redis 8.6, dev) + `docker-compose.prod.yml` (Postgres 15, Redis 8.6, backend) | `TECH-STACK.md` Docker | `docker-compose up` all healthy |
| 0.4 | Create `.env.example` with all required vars | `TECH-STACK.md` Environment Variables | All vars documented |
| 0.5 | Set backend port to 3001, add `/health` endpoint | `MISSION.md` Target State | `GET /health` 200 |
| 0.6 | GitHub Actions CI (lint, test, build on PR) | `TEST-PLAN.md` 9 | PR triggers pipeline |

### Deliverables
- `backend/` directory with NestJS 11 project
- TypeScript configured per `TECH-STACK.md`
- ESLint + Prettier configured per `CONSTITUTION.md`
- `docker-compose.yml` (dev): Redis 8.6 only (Supabase provides PG in dev)
- `docker-compose.prod.yml`: Postgres 15, Redis 8.6, backend with hot reload
- `.env.example` with all required variables
- GitHub Actions workflow: lint, test, build on PR (deferred)
- `README.md` with setup instructions

### Verification
```bash
cd backend && npm run start:dev
# Server starts on :3001
# Health check responds at GET /health
docker-compose up redis
# Redis healthy
docker-compose -f docker-compose.prod.yml up
# Postgres + Redis + backend healthy
```

### Depends On
Nothing

---

## Phase 1: Foundation & Shared Kernel (Week 1-2)

> **Goal:** The infrastructure layer that all feature modules depend on. Nothing ships without this.

### Folder Impact
- `src/common/` — guards, interceptors, filters, decorators, DTOs, types
- `src/config/` — env validation module
- `src/prisma/` — Prisma module + service
- `src/redis/` — Redis module + service

### Tasks

| # | Task | Spec Reference | Verification |
|---|------|----------------|-------------|
| 1.1 | `ConfigModule` env validation with Zod, fail-fast | `TECH-STACK.md` Runtime, `CONSTITUTION.md` 10.4 | Missing var process exit 1 |
| 1.2 | `PrismaModule` global singleton + lifecycle | `TECH-STACK.md` Database, `CONSTITUTION.md` 3 | DB connects on startup |
| 1.3 | `RedisModule` + `RedisService` ioredis, typed wrapper | `TECH-STACK.md` Caching, `CONSTITUTION.md` 3.3 | Redis connects, key ops work |
| 1.4 | Global `ValidationPipe` | `TECH-STACK.md` Validation | Invalid DTO 400 |
| 1.5 | Global exception filters (Prisma errors + catch-all) | `ERROR-REGISTRY.md`, `CONSTITUTION.md` 2 | P2002 409, P2025 404, unknown 500 |
| 1.6 | `TransformInterceptor` `{ success, data }` envelope | `API-CONTRACT.md` Global Types | All responses wrapped |
| 1.7 | `LoggingInterceptor` Pino structured logging | `CODE-STANDARD.md` 7, `TECH-STACK.md` Observability | Request logs in stdout |
| 1.8 | `JwtAuthGuard` + `RolesGuard` | `CONSTITUTION.md` 4, `TECH-STACK.md` Auth | Protected route 401 without token |
| 1.9 | Decorators: `@CurrentUser()`, `@Public()`, `@Roles()` | `CONSTITUTION.md` 4, `CODE-STANDARD.md` 3.2 | Decorators injectable |
| 1.10 | Pagination DTO + `ApiResponse<T>` + `PaginatedResponse<T>` | `API-CONTRACT.md` Global Types | Types compile |
| 1.11 | `ErrorCodes` enum full registry | `ERROR-REGISTRY.md` (all ~100 codes) | Enum matches registry |
| 1.12 | Throttler setup Redis store | `TECH-STACK.md` Security, `CONSTITUTION.md` 4.3 | Exceed rate 429 |
| 1.13 | Helmet + CORS configuration | `TECH-STACK.md` Security | Headers present |

### Deliverables
- `ConfigModule` env validation with Zod, fail-fast on missing vars
- `PrismaModule` global singleton, connection management
- `PrismaService` extends `PrismaClient`, handles `$on('beforeExit')`
- `RedisModule` `ioredis` provider, connection health check
- `RedisService` typed wrapper with key namespacing
- Global `ValidationPipe` `whitelist: true`, `forbidNonWhitelisted: true`
- Global exception filter Prisma errors (`P2002` 409, `P2025` 404)
- `AllExceptionsFilter` catch-all, structured error response
- `LoggingInterceptor` request/response logging with Pino
- `TransformInterceptor` wrap responses in `{ success, data }` envelope
- `JwtAuthGuard` Bearer token validation
- `RolesGuard` RBAC enforcement
- `@CurrentUser()` decorator inject authenticated user
- `@Public()` decorator bypass auth
- `@Roles()` decorator specify required roles
- Pagination DTO `page`, `limit` with defaults and max validation
- `ApiResponse<T>` and `PaginatedResponse<T>` interfaces
- `ErrorCodes` enum canonical error code registry
- Throttler setup Redis store, default 10 req/min
- Helmet + CORS configuration

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

> **Goal:** Complete Prisma schema for all 18+ models, first migration, seed data.

### Folder Impact
- `prisma/schema.prisma` — generator block, datasource, shared enums
- `prisma/models/` — domain-split model files (user, trip, booking, payment, etc.)
- `prisma/migrations/` — initial migration
- `prisma/seed.ts` — seed data script

### Prisma Multi-File Schema (New in Prisma 6+)

Prisma now supports splitting the schema across multiple files organized by domain. This replaces the single `schema.prisma` monolith.

**Required structure:**

```
prisma/
├── schema.prisma              # generator + datasource + shared enums
├── models/
│   ├── user.prisma            # User, RefreshToken
│   ├── trip.prisma            # Trip, Place
│   ├── inventory.prisma       # Hotel, HotelRoom, Guide, TransportationVehicle
│   ├── booking.prisma         # Booking, BookingItem
│   ├── payment.prisma         # Payment, Refund, DiscountCode
│   ├── review.prisma          # Review, Favorite
│   ├── engagement.prisma      # StudentVerification, LoyaltyTransaction
│   ├── emergency.prisma       # EmergencyAlert, LocationShare
│   ├── notification.prisma    # Notification
│   └── system.prisma          # AiSession, AuditLog, Festival
└── migrations/
```

**Configuration:**
- Set `schema = "prisma/"` in `package.json` prisma config or pass `--schema ./prisma` to CLI commands
- `schema.prisma` must contain the `generator` block and live in the configured directory root
- `migrations/` must sit at the same level as `schema.prisma`

**Reference:** [Prisma Docs — Schema File Location](https://www.prisma.io/docs/orm/prisma-schema/overview/location)

### Tasks

| # | Task | Spec Reference | Verification |
|---|------|----------------|-------------|
| 2.1 | Split `schema.prisma` into multi-file schema under `prisma/models/` | `SCHEMA.md` (20 models, 18 enums) | `prisma validate --schema ./prisma` succeeds |
| 2.2 | Wire multi-file config in `package.json` or CLI | Prisma docs | `npx prisma migrate dev --schema ./prisma` works |
| 2.3 | Run first migration `prisma migrate dev --name init` | `SCHEMA.md` Conventions | Migration succeeds |
| 2.4 | Create seed script per `SEED-SPEC.md` | `SEED-SPEC.md` (5 users, 5 guides, 3 hotels, 8 places, 5 trips) | `npx prisma db seed` populates data |

### Deliverables
- `prisma/schema.prisma` with `generator` + `datasource` + shared enums only
- `prisma/models/*.prisma` files organized by domain:
  - `user.prisma` — `User`, `RefreshToken`
  - `trip.prisma` — `Trip`, `Place`
  - `inventory.prisma` — `Hotel`, `HotelRoom`, `Guide`, `TransportationVehicle`
  - `booking.prisma` — `Booking` + related
  - `payment.prisma` — `Payment`, `Refund`, `DiscountCode`
  - `review.prisma` — `Review`, `Favorite`
  - `engagement.prisma` — `StudentVerification`, `LoyaltyTransaction`
  - `emergency.prisma` — `EmergencyAlert`, `LocationShare`
  - `notification.prisma` — `Notification`
  - `system.prisma` — `AiSession`, `AuditLog`, `Festival`
- All enums defined (`BookingStatus`, `PaymentStatus`, `UserRole`, etc.)
- All conventions applied: UUID PKs, `Decimal(10,2)`, `Timestamptz`, `deletedAt`, `@map`
- First migration: `prisma migrate dev --name init`
- Seed script: minimal data for local dev (1 admin, 1 trip, 1 hotel, 1 guide, 1 place)
- `prisma/seed.ts` wired into `package.json`

### Verification
```bash
npx prisma validate --schema ./prisma
npx prisma migrate dev --schema ./prisma --name init
npx prisma db seed
npx prisma studio
# All models visible, seed data present
```

### Depends On
- Phase 1

---

## Phase 3: Auth & Users (Week 3)

> **Goal:** Registration, login, JWT refresh, logout, password reset, Google OAuth. These block every feature module.

### Folder Impact
- `src/auth/` — `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.dto.ts`
- `src/users/` — `users.module.ts`, `users.controller.ts`, `users.service.ts`, `users.dto.ts`

### Tasks

| # | Task | Spec Reference | Verification |
|---|------|----------------|-------------|
| 3.1 | `AuthModule` register, login, refresh, logout | `API-CONTRACT.md` 1 Auth, `CONSTITUTION.md` 4 | E2E: register login refresh logout |
| 3.2 | Google OAuth flow | `API-CONTRACT.md` 1 (POST /auth/google, GET callback) | OAuth redirect works |
| 3.3 | Password reset flow (Resend email) | `API-CONTRACT.md` 1 (forgot + reset password) | Reset email sent, token validates |
| 3.4 | `UsersModule` GET/PATCH `/users/me` | `API-CONTRACT.md` 2 Users | Profile read + update works |
| 3.5 | Refresh token rotation + logout-all-devices | `CONSTITUTION.md` 4.1 | Old refresh token rejected after rotation |

### Deliverables
- `AuthModule` service, controller, DTOs
- `POST /v1/auth/register` bcrypt password, create user, return tokens
- `POST /v1/auth/login` validate credentials, return tokens
- `POST /v1/auth/google` initiate OAuth flow
- `GET /v1/auth/google/callback` handle callback, create/link user
- `POST /v1/auth/refresh` validate refresh token, issue new access token
- `POST /v1/auth/logout` invalidate refresh token
- `POST /v1/auth/forgot-password` send reset email (Resend)
- `POST /v1/auth/reset-password` validate token, update password
- `UsersModule` profile management
- `GET /v1/users/me` current user profile
- `PATCH /v1/users/me` update profile
- Refresh token rotation new refresh token on each use
- `logout-all-devices` invalidate all user refresh tokens in Redis

### Verification
- Unit tests: auth service (90% coverage)
- E2E tests: full auth flow
- Manual: register login access protected endpoint refresh logout

### Depends On
- Phase 1, Phase 2

---

## Phase 4: Core Inventory (Week 4-5)

> **Goal:** Read-only catalog APIs for trips, places, hotels, guides, transportation. Can run in parallel across modules.

### Folder Impact
- `src/trips/` — trip catalog endpoints
- `src/places/` — place catalog endpoints
- `src/hotels/` — hotel + room endpoints
- `src/guides/` — guide catalog endpoints
- `src/transportation/` — vehicle catalog endpoints
- `src/search/` — global search endpoint

### Tasks

| # | Task | Module Spec | API Contract | Verification |
|---|------|-------------|--------------|-------------|
| 4.1 | `TripsModule` list, detail, related, share | `docs/modules/trip-discovery/api.yaml` | `API-CONTRACT.md` 3 | GET /v1/trips returns paginated list |
| 4.2 | `PlacesModule` list, detail, related, nearby | `docs/modules/explore-places/api.yaml` | `API-CONTRACT.md` 7 | GET /v1/places returns paginated list |
| 4.3 | `HotelsModule` list, detail, room availability | `docs/modules/hotel-booking/api.yaml` | `API-CONTRACT.md` 8 | GET /v1/hotels returns paginated list |
| 4.4 | `GuidesModule` list, detail, availability | `docs/modules/tour-guide/api.yaml` | `API-CONTRACT.md` 9 | GET /v1/guides returns paginated list |
| 4.5 | `TransportationModule` list, detail, availability | `docs/modules/transportation/api.yaml` | `API-CONTRACT.md` 10 | GET /v1/transportation/vehicles works |
| 4.6 | `SearchModule` global search (DB stub) | `docs/modules/trip-discovery/api.yaml` | `API-CONTRACT.md` 6 | GET /v1/search?q=angkor returns results |
| 4.7 | Redis caching for all public GET endpoints | `CONSTITUTION.md` 3.3 | Cache hit returns faster |

### Deliverables
- `TripsModule` list, detail, related trips, share, reviews, favorites
- `PlacesModule` list, detail, related, nearby trips, nearby places
- `HotelsModule` list, detail, room availability check
- `GuidesModule` list, detail, availability check
- `TransportationModule` list vehicles, detail, availability
- `SearchModule` global search endpoint (Meilisearch integration planned, stub with DB search)
- All endpoints follow `api.yaml` specs exactly
- Redis caching for public GET endpoints (TTL per `api.yaml` `x-nfr-cache-ttl`)

### Verification
- All `api.yaml` endpoints return correct shapes
- E2E tests for each module (list + detail)
- Performance: list endpoints < 300ms with 1000 records

### Depends On
- Phase 1, Phase 2

---

## Phase 5: Booking Engine (Week 5-6)

> **Goal:** Create, read, update, cancel bookings across all inventory types.

### Folder Impact
- `src/bookings/` — unified booking module (may later add `bookings.repository.ts` for complex queries)

### Tasks

| # | Task | Spec Reference | Verification |
|---|------|----------------|-------------|
| 5.1 | `BookingsModule` unified booking management | `API-CONTRACT.md` 11, `CONSTITUTION.md` 9 | Module scaffolded |
| 5.2 | Guide booking: `POST /v1/guides/{id}/bookings` | `API-CONTRACT.md` 11, `docs/modules/tour-guide/api.yaml` | Creates booking HOLD |
| 5.3 | Hotel booking: `POST /v1/hotels/{id}/bookings` | `API-CONTRACT.md` 11, `docs/modules/hotel-booking/api.yaml` | Creates booking HOLD |
| 5.4 | Transportation booking | `API-CONTRACT.md` 11, `docs/modules/transportation/api.yaml` | Creates booking HOLD |
| 5.5 | Unified booking CRUD: list, detail, update, cancel, QR, iCal | `API-CONTRACT.md` 11, `docs/modules/my-trip/` | All CRUD endpoints work |
| 5.6 | Overbooking protection (Prisma tx + overlap check) | `CONSTITUTION.md` 9.1, `EVENT-CATALOG.md` | Double-book 409 |
| 5.7 | Redis hold mechanism (15-min TTL, auto-expire) | `CONSTITUTION.md` 9.1 | Hold expires EXPIRED |
| 5.8 | Booking status state machine | `SCHEMA.md` BookingStatus enum | Valid transitions only |

### Deliverables
- `BookingsModule` unified booking management
- Guide booking: `POST /v1/guides/{id}/bookings`
- Hotel booking: `POST /v1/hotels/{id}/bookings`
- Transportation booking: `POST /v1/transportation/bookings`
- `GET /v1/bookings` my bookings (unified)
- `GET /v1/bookings/{id}` booking detail
- `PATCH /v1/bookings/{id}` update before confirmation
- `POST /v1/bookings/{id}/cancel` cancellation with refund calculation
- `GET /v1/bookings/{id}/qr` booking QR code
- `GET /v1/bookings/{id}/ical` iCalendar export
- Overbooking protection: overlap check in Prisma transaction
- Redis hold mechanism: 15-minute TTL, auto-expire via cron
- Booking status machine: `HOLD` `PENDING_PAYMENT` `CONFIRMED`/`CANCELLED`/`EXPIRED`

### Verification
- E2E: create booking check hold in Redis wait for expiry verify `EXPIRED`
- E2E: double-book same dates expect `409`
- Unit: refund calculation logic (100%/50%/0% tiers)

### Depends On
- Phase 3, Phase 4

---

## Phase 6: Payments (Week 6-7)

> **Goal:** Stripe integration, payment intents, QR codes, webhooks, refunds.

### Folder Impact
- `src/payments/` — payment intent, QR, refund, discount code endpoints

### Tasks

| # | Task | Spec Reference | Verification |
|---|------|----------------|-------------|
| 6.1 | `PaymentsModule` Stripe integration | `API-CONTRACT.md` 12, `docs/modules/payments/api.yaml` | Intent created |
| 6.2 | QR code generation (Bakong/ABA) | `API-CONTRACT.md` 12, `CONSTITUTION.md` 9.2 | QR code returned |
| 6.3 | Stripe webhook handler (idempotent) | `API-CONTRACT.md` 12, `CONSTITUTION.md` 9.2 | Webhook confirmed |
| 6.4 | Refund processing (tiered: 100%/50%/0%) | `CONSTITUTION.md` 9.3, `ERROR-REGISTRY.md` PAY_* | Correct refund % |
| 6.5 | Discount code validation | `API-CONTRACT.md` 12, `ERROR-REGISTRY.md` DSC_* | Valid code applied |

### Deliverables
- `PaymentsModule`
- `POST /v1/payments/intent` create Stripe PaymentIntent
- `POST /v1/payments/qr` generate Bakong/ABA QR code
- `GET /v1/payments/{id}/status` check payment status
- `POST /v1/payments/{id}/refund` process refund
- `POST /v1/discount-codes/validate` validate and return discount info
- `POST /v1/webhooks/stripe` handle Stripe webhooks
- Webhook idempotency: `stripe_event_id` deduplication
- Payment booking confirmation flow (webhook handler)
- Tiered refund logic in cancellation flow

### Verification
- Unit: webhook signature verification
- E2E: full payment flow with Stripe test keys
- E2E: duplicate webhook idempotent (no double charge/booking)

### Depends On
- Phase 5

---

## Phase 7: User Features (Week 7-8)

> **Goal:** Reviews, favorites, student discount, loyalty, profile enhancements.

### Folder Impact
- `src/reviews/` — review CRUD + verified badge logic
- `src/favorites/` — wishlist add/remove/list
- `src/student-discount/` — verification submission flow
- `src/loyalty/` — points balance, history, redemption
- `src/users/` — extended profile (adds to existing module)

### Tasks

| # | Task | Spec Reference | Verification |
|---|------|----------------|-------------|
| 5.1 | `ReviewsModule` CRUD with 7-day edit window | `API-CONTRACT.md` 4, `ERROR-REGISTRY.md` REV_* | Edit blocked after 7d |
| 5.2 | Verified booking badge on reviews | `EVENT-CATALOG.md` review.created | Badge for verified bookings |
| 5.3 | `FavoritesModule` add/remove/list (100 max) | `API-CONTRACT.md` 5, `ERROR-REGISTRY.md` FAV_* | Limit enforced |
| 5.4 | `StudentDiscountModule` verification submission | `docs/modules/student-discount/`, `ERROR-REGISTRY.md` STD_* | Submit PENDING |
| 5.5 | `LoyaltyModule` points balance, history, redemption | `docs/modules/loyalty/`, `ERROR-REGISTRY.md` LYL_* | Points accrue |
| 5.6 | `ProfileModule` extended user profile | `API-CONTRACT.md` 2 Users | Fields update |

### Deliverables
- `ReviewsModule` create, update (7-day window), delete, list
- Verified booking badge on reviews
- `FavoritesModule` add/remove/list, 100 max per user
- `StudentDiscountModule` verification submission, admin approval
- `LoyaltyModule` points balance, transaction history, redemption
- 50 points for first verified review per booking
- `ProfileModule` extended user profile, preferences

### Verification
- E2E: submit review check loyalty points
- E2E: student verification flow (submit admin approve discount active)

### Depends On
- Phase 3, Phase 4

---

## Phase 8: Async & Background (Week 8)

> **Goal:** Event-driven architecture, background jobs, notification plumbing.

### Folder Impact
- `src/notifications/` — email, push, in-app notification module
- Feature modules emit events; `notifications/` handles delivery

### Tasks

| # | Task | Spec Reference |
|---|------|----------------|
| 6.2.1 | EventEmitter global config + domain events | `EVENT-CATALOG.md` (18 events) |
| 6.2.2 | `NotificationsModule` email, push, in-app | `roadmap.md` Phase 8 |
| 6.2.3 | Cron jobs: expired bookings, reminders, festival alerts | `CONSTITUTION.md` 7.2 |

### Deliverables
- `EventEmitter` configured globally
- Domain events: `booking.created`, `payment.completed`, `booking.cancelled`, `review.created`
- Event handlers: non-blocking, error-isolated
- `NotificationsModule` email (Resend), push (FCM), in-app
- `booking.created` send confirmation email
- `payment.completed` send receipt email + push notification
- `booking.cancelled` send cancellation email
- Cron: `cleanupExpiredBookings` every 5 minutes
- Cron: `sendTravelReminders` daily at 9 AM Asia/Phnom_Penh
- Cron: `sendFestivalAlerts` daily at 8 AM Asia/Phnom_Penh

### Verification
- Unit: event handler isolation (one handler failure doesn't break others)
- E2E: create booking email sent (Mailpit catch in dev)

### Depends On
- Phase 5, Phase 6

---

## Phase 9: AI Integration (Week 9)

> **Goal:** AI tool endpoints for the Python LangGraph agent.

### Folder Impact
- `src/ai-tools/` — all `/v1/ai-tools/*` endpoints with `X-Service-Key` middleware

### Tasks

| # | Task | Spec Reference |
|---|------|----------------|
| 6.1.1 | `AiToolsModule` + `X-Service-Key` middleware | `CONSTITUTION.md` 8, `docs/modules/vibe-booking/api.yaml` |
| 6.1.2 | AI search, booking, payment QR, budget endpoints | `API-CONTRACT.md` 14, `roadmap.md` Phase 9 |
| 6.1.3 | Separate rate limiting + idempotency + circuit breaker | `CONSTITUTION.md` 8.2 |

### Deliverables
- `AiToolsModule`
- `X-Service-Key` middleware validation
- `POST /v1/ai-tools/search/trips` search trips by criteria
- `POST /v1/ai-tools/bookings` create booking from AI context
- `POST /v1/ai-tools/payments/qr` generate payment QR
- `POST /v1/ai-tools/budget/estimate` calculate trip budget
- Rate limiting separate from public API
- Idempotency key support for mutating AI tools
- 10s timeout, 3 retries, circuit breaker

### Verification
- E2E: call with valid `X-Service-Key` success
- E2E: call without key `401`
- E2E: call with invalid key `403`

### Depends On
- Phase 4, Phase 5, Phase 6

---

## Phase 10: Emergency & Safety (Week 10)

> **Goal:** Emergency alerts, location sharing, emergency contacts.

### Folder Impact
- `src/emergency/` — alerts, location shares, contacts endpoints

### Tasks

| # | Task | Spec Reference |
|---|------|----------------|
| 6.3.1 | `EmergencyModule` alerts, location sharing, contacts | `docs/modules/emergency/api.yaml`, `API-CONTRACT.md` 13 |

### Deliverables
- `EmergencyModule`
- `POST /v1/emergency/alerts` create emergency alert
- `PATCH /v1/emergency/alerts/{id}/status` update status
- `POST /v1/emergency/alerts/{id}/acknowledge` acknowledge alert
- `POST /v1/emergency/alerts/{id}/resolve` resolve alert
- `POST /v1/location-shares` create shareable location link
- `GET /v1/location-shares/{token}` view shared location
- `POST /v1/location-shares/{token}/revoke` revoke share
- `GET /v1/emergency/contacts` get emergency contact list

### Verification
- E2E: create alert acknowledge resolve
- E2E: location share view revoke 404

### Depends On
- Phase 3

---

## Phase 11: Admin & Operations (Week 10)

> **Goal:** Admin endpoints, analytics, audit logs, health checks.

### Folder Impact
- `src/admin/` — admin-only endpoints, analytics, audit log queries
- `src/common/interceptors/` — audit interceptor added

### Tasks

| # | Task | Spec Reference |
|---|------|----------------|
| 6.4.1 | `AdminModule` verifications, analytics, audit logs | `docs/modules/admin/api.yaml`, `roadmap.md` Phase 11 |
| 6.4.2 | Health check endpoints (basic + detailed) | `CONSTITUTION.md` 10.2 |
| 6.4.3 | Audit interceptor log all mutations | `CONSTITUTION.md` 10.1, `SCHEMA.md` AuditLog |

### Deliverables
- `AdminModule` admin-only endpoints
- `GET /v1/admin/student-verifications` pending list
- `POST /v1/admin/student-verifications/{id}/approve`
- `POST /v1/admin/student-verifications/{id}/reject`
- `GET /v1/admin/analytics` key metrics
- `GET /v1/admin/audit-logs` activity log
- `GET /v1/health` DB + Redis health checks
- `GET /v1/health/detailed` extended diagnostics (admin only)
- Audit interceptor log all mutations with user ID, timestamp

### Verification
- E2E: admin endpoint without admin role `403`
- E2E: create booking audit log entry exists

### Depends On
- Phase 3, Phase 7, Phase 8

---

## Phase 12: Testing Hardening (Week 11)

> **Goal:** Achieve coverage gates, property-based tests, performance baseline.

### Folder Impact
- `test/` — E2E test suites for all critical flows
- `src/**/*.spec.ts` — unit + integration tests colocated with source

### Tasks

| # | Task | Spec Reference |
|---|------|----------------|
| 6.5.1 | Coverage: 80% unit, 90% critical paths | `TEST-PLAN.md` 2 |
| 6.5.2 | Property-based tests (fast-check) | `TEST-PLAN.md` 4.3 |
| 6.5.3 | All 9 critical E2E flows | `TEST-PLAN.md` 3 |
| 6.5.4 | Load test: 100 concurrent bookings | `TEST-PLAN.md` 11 |
| 6.5.5 | Security scan | `TEST-PLAN.md` 12 |

### Deliverables
- Unit test coverage 80% (90% for auth, booking, payment)
- Property-based tests: input validation, state transitions, idempotency
- E2E tests for all critical flows
- Load test: 100 concurrent booking creations, < 1% failure rate
- Performance benchmark: list endpoints < 300ms, detail endpoints < 200ms
- Security scan: no hardcoded secrets, no SQL injection vectors
- Fix all critical and high severity issues

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

## Phase 13: Production Readiness (Week 12)

> **Goal:** Deployment configuration, monitoring, documentation.

### Folder Impact
- Root: `Dockerfile`, `docker-compose.prod.yml`
- `src/main.ts` — Swagger setup, graceful shutdown hooks

### Tasks

| # | Task | Spec Reference |
|---|------|----------------|
| 6.6.1 | Production Dockerfile (multi-stage) | `TECH-STACK.md` Docker |
| 6.6.2 | Swagger/OpenAPI at `/api/docs` | `TECH-STACK.md` Runtime |
| 6.6.3 | Sentry integration | `docs/product/feature-decisions.md` F112 |
| 6.6.4 | Graceful shutdown | `CONSTITUTION.md` 10.3 |

### Deliverables
- Production Dockerfile (multi-stage)
- `docker-compose.prod.yml`
- Environment-specific config: dev, staging, production
- Sentry integration for error tracking
- API documentation with Swagger (auto-generated)
- OpenAPI spec export for frontend consumption
- Graceful shutdown handling
- Database backup strategy documented
- Runbook: common incidents and resolution steps

### Verification
- Deploy to staging: all health checks pass
- E2E suite passes against staging
- Security scan passes

### Depends On
- Phase 12

---

## Recommended Week-by-Week Execution

| Week | Phases | Tasks | What You Ship |
|------|--------|-------|---------------|
| 1 | 0 + 1.1-1.5 | 0.1-0.6 + 1.1-1.5 | Runnable project, Docker, DB connected |
| 2 | 1.6-1.13 + 2 | 1.6-1.13 + 2.1-2.4 | Shared kernel complete, DB migrated & seeded |
| 3 | 3 | 3.1-3.5 | Auth flow working end-to-end |
| 4 | 4 (first half) | 4.1-4.4 | Trips, places, hotels, guides browsable |
| 5 | 4 (second half) + 5 (first half) | 4.5-4.7 + 5.1-5.4 | Transport + booking creation |
| 6 | 5 (second half) | 5.5-5.8 | Full booking engine with holds |
| 7 | 6 | 6.1-6.5 | Payments complete |
| 8 | 7 | 7.1-7.6 | Reviews, favorites, loyalty, student |
| 9 | 8 + 9 | 8.1-8.3 + 9.1-9.3 | AI tools + async/notifications |
| 10 | 10 + 11 | 10.1 + 11.1-11.3 | Emergency + admin |
| 11 | 12 | 12.1-12.5 | Testing hardening |
| 12 | 13 | 13.1-13.4 | Production ready |

---

## Spec-Driven Development Workflow (Per Task)

```
1. Read the referenced spec docs
2. Write your implementation plan (what files, what code)
3. Scaffold the module: module controller service dto
4. Implement against the API-CONTRACT.md shapes
5. Write tests per TEST-PLAN.md coverage gates
6. Verify per the task's verification criteria
7. Update PROGRESS-TRACKER.md
```

---

## Source of Truth Index

| What | Where |
|------|-------|
| Why we build this | `context/guides/MISSION.md` |
| Rules all code follows | `context/guides/CONSTITUTION.md` |
| How we write code | `context/guides/CODE-STANDARD.md` |
| Package versions & config | `context/guides/TECH-STACK.md` |
| Database schema | `context/specs/SCHEMA.md` + `prisma/schema.prisma` |
| All endpoint contracts | `context/specs/API-CONTRACT.md` |
| Error codes | `context/specs/ERROR-REGISTRY.md` |
| Domain events | `context/specs/EVENT-CATALOG.md` |
| Seed data | `context/plans/SEED-SPEC.md` |
| Test strategy | `context/plans/TEST-PLAN.md` |
| Feature priorities | `docs/product/feature-decisions.md` |
| Module API specs | `docs/modules/*/api.yaml` |
| Architecture details | `docs/platform/backend/*.md` |
| Detailed requirements | `.kiro/specs/backend-nestjs-supabase/requirements.md` |

---

## Decision Log

| Date | Phase | Decision | Rationale | Status |
|------|-------|----------|-----------|--------|
| - | 0 | NestJS 11 | Team familiarity, decorator-based DI, ecosystem | Decided |
| - | 0 | Docker Compose local | Matches prod, enables integration testing | Decided |
| - | 1 | Custom JWT (not Supabase Auth) | Backend controls token lifecycle, multi-device logout | Decided |
| - | 1 | Prisma ORM | Type safety, migration system, team experience | Decided |
| - | 1 | ioredis over node-redis | Better cluster support, more active maintenance | Decided |
| - | 2 | Soft delete global (`deletedAt`) | GDPR compliance, audit trail, accidental delete recovery | Decided |
| - | 2 | Decimal(10,2) for money | Precision, no floating-point errors | Decided |
| - | 5 | Redis hold (not DB status) | Fast expiry, no DB polling, automatic cleanup | Decided |
| - | 6 | Stripe only (defer Bakong direct) | Stripe supports QR, faster MVP, less compliance | Decided |
| - | 8 | EventEmitter (not message queue) | Sufficient for single-instance, Redis Pub/Sub for scaling | Decided |
| - | 9 | AI tools as REST (not gRPC) | Simpler, existing HTTP stack, no proto overhead | Decided |

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
