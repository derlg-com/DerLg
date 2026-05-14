# Backend Implementation Roadmap — Spec-Driven Task Index

> **What this is:** A sequential task index telling you WHERE to start, WHAT order to follow, and WHICH docs to reference.
> **What this is NOT:** Detailed implementation plans — you define those yourself per task using the referenced specs.

---

## How to Use

1. **Pick the next unfinished task** (top to bottom, respect dependencies)
2. **Read the referenced spec docs** — they are your source of truth
3. **Write your own implementation plan** for that task
4. **Implement, test, verify** per the verification criteria
5. **Update `PROGRESS-TRACKER.md`** when done

---

## Current State

| What Exists | Status |
|-------------|--------|
| NestJS 11 scaffold (`src/`) | ✅ Default boilerplate only |
| Prisma schema (`prisma/schema.prisma`) | ✅ Written (38KB, all models) |
| Prisma migrations dir | ✅ Exists (empty or initial) |
| Prisma seeds dir | ✅ Exists |
| Context docs (`backend/context/`) | ✅ Complete spec suite |
| Feature module code (`src/<feature>/`) | ❌ None created yet |
| Docker Compose | ❌ Not created |
| CI/CD pipeline | ❌ Not created |

---

## Dependency Graph

```
T0 Bootstrap
 └─► T1 Shared Kernel
      └─► T2 Database & Auth
           ├─► T3 Inventory Catalog ─────┐
           │                              ├─► T4 Booking & Payments
           │                              │    └─► T6.2 Async & Notifications
           │                              │         └─► T6.4 Admin
           ├─► T5 User & Engagement ─────┘
           ├─► T6.1 AI Tools (after T3+T4)
           └─► T6.3 Emergency (after T2)
                                    T6.5 Testing Hardening (after all)
                                     └─► T6.6 Production Readiness
```

---

## Track 0: Bootstrap & DevEx

> **Goal:** Runnable project with local infra. Nothing else starts until this works.

| # | Task | Spec Reference | Verify |
|---|------|----------------|--------|
| 0.1 | Configure TypeScript per project standards | `context/guides/TECH-STACK.md` §Runtime, §Language | `npm run build` succeeds |
| 0.2 | Configure ESLint + Prettier | `context/guides/CODE-STANDARD.md` §1, `.prettierrc` | `npm run lint && npm run format` clean |
| 0.3 | Create `docker-compose.yml` (Postgres 15, Redis 7, backend hot-reload) | `context/guides/TECH-STACK.md` §Docker | `docker-compose up` → all healthy |
| 0.4 | Create `.env.example` with all required vars | `context/guides/TECH-STACK.md` §Environment Variables | All vars documented |
| 0.5 | Set backend port to 3001, add `/health` endpoint | `context/guides/MISSION.md` §Target State | `GET /health` → 200 |
| 0.6 | GitHub Actions CI (lint, test, build on PR) | `context/plans/TEST-PLAN.md` §9 | PR triggers pipeline |

**Depends on:** Nothing
**Milestone:** M0 — `docker-compose up` brings up backend + DB + Redis

---

## Track 1: Shared Kernel (`src/common/`)

> **Goal:** The infrastructure layer all feature modules depend on. This is your foundation.

| # | Task | Spec Reference | Verify |
|---|------|----------------|--------|
| 1.1 | `ConfigModule` — env validation with Joi, fail-fast | `TECH-STACK.md` §Runtime, `CONSTITUTION.md` §10.4 | Missing var → process exit 1 |
| 1.2 | `PrismaModule` — global singleton + lifecycle | `TECH-STACK.md` §Database, `CONSTITUTION.md` §3 | DB connects on startup |
| 1.3 | `RedisModule` + `RedisService` — ioredis, typed wrapper | `TECH-STACK.md` §Caching, `CONSTITUTION.md` §3.3 | Redis connects, key ops work |
| 1.4 | Global `ValidationPipe` | `TECH-STACK.md` §Validation | Invalid DTO → 400 |
| 1.5 | Global exception filters (Prisma errors + catch-all) | `ERROR-REGISTRY.md`, `CONSTITUTION.md` §2 | P2002→409, P2025→404, unknown→500 |
| 1.6 | `TransformInterceptor` — `{ success, data }` envelope | `API-CONTRACT.md` §Global Types | All responses wrapped |
| 1.7 | `LoggingInterceptor` — Pino structured logging | `CODE-STANDARD.md` §7, `TECH-STACK.md` §Observability | Request logs in stdout |
| 1.8 | `JwtAuthGuard` + `RolesGuard` | `CONSTITUTION.md` §4, `TECH-STACK.md` §Auth | Protected route → 401 without token |
| 1.9 | Decorators: `@CurrentUser()`, `@Public()`, `@Roles()` | `CONSTITUTION.md` §4, `CODE-STANDARD.md` §3.2 | Decorators injectable |
| 1.10 | Pagination DTO + `ApiResponse<T>` + `PaginatedResponse<T>` | `API-CONTRACT.md` §Global Types | Types compile |
| 1.11 | `ErrorCodes` enum — full registry | `ERROR-REGISTRY.md` (all ~100 codes) | Enum matches registry |
| 1.12 | Throttler setup — Redis store | `TECH-STACK.md` §Security, `CONSTITUTION.md` §4.3 | Exceed rate → 429 |
| 1.13 | Helmet + CORS configuration | `TECH-STACK.md` §Security | Headers present |

**Depends on:** Track 0
**Milestone:** M1 — Any developer can create a new module following existing patterns

---

## Track 2: Database Schema & Auth

> **Goal:** Database ready + auth working. These block every feature module.

### 2A: Database Schema

| # | Task | Spec Reference | Verify |
|---|------|----------------|--------|
| 2.1 | Validate `prisma/schema.prisma` against `SCHEMA.md` | `context/specs/SCHEMA.md` (20 models, 18 enums) | Schema matches spec |
| 2.2 | Run first migration (`prisma migrate dev --name init`) | `SCHEMA.md` §Conventions | Migration succeeds |
| 2.3 | Create seed script per `SEED-SPEC.md` | `plans/SEED-SPEC.md` (5 users, 5 guides, 3 hotels, 8 places, 5 trips) | `npx prisma db seed` populates data |

### 2B: Auth & Users

| # | Task | Spec Reference | Verify |
|---|------|----------------|--------|
| 2.4 | `AuthModule` — register, login, refresh, logout | `API-CONTRACT.md` §1 Auth, `CONSTITUTION.md` §4 | E2E: register→login→refresh→logout |
| 2.5 | Google OAuth flow | `API-CONTRACT.md` §1 (POST /auth/google, GET callback) | OAuth redirect works |
| 2.6 | Password reset flow (Resend email) | `API-CONTRACT.md` §1 (forgot + reset password) | Reset email sent, token validates |
| 2.7 | `UsersModule` — GET/PATCH `/users/me` | `API-CONTRACT.md` §2 Users | Profile read + update works |
| 2.8 | Refresh token rotation + logout-all-devices | `CONSTITUTION.md` §4.1, `ROADMAP.md` Phase 3 | Old refresh token rejected after rotation |

**Depends on:** Track 1
**Milestone:** M2 — Full auth flow works end-to-end

---

## Track 3: Inventory Catalog (Read-Only APIs)

> **Goal:** Browse all inventory types. Can run in parallel across modules.

| # | Task | Module Spec (docs/) | API Contract Ref | Verify |
|---|------|---------------------|-------------------|--------|
| 3.1 | `TripsModule` — list, detail, related, share | `docs/modules/trip-discovery/api.yaml` | `API-CONTRACT.md` §3 | GET /v1/trips returns paginated list |
| 3.2 | `PlacesModule` — list, detail, related, nearby | `docs/modules/explore-places/api.yaml` | `API-CONTRACT.md` §7 | GET /v1/places returns paginated list |
| 3.3 | `HotelsModule` — list, detail, room availability | `docs/modules/hotel-booking/api.yaml` | `API-CONTRACT.md` §8 | GET /v1/hotels returns paginated list |
| 3.4 | `GuidesModule` — list, detail, availability | `docs/modules/tour-guide/api.yaml` | `API-CONTRACT.md` §9 | GET /v1/guides returns paginated list |
| 3.5 | `TransportationModule` — list, detail, availability | `docs/modules/transportation/api.yaml` | `API-CONTRACT.md` §10 | GET /v1/transportation/vehicles works |
| 3.6 | `SearchModule` — global search (DB stub) | `docs/modules/trip-discovery/api.yaml` | `API-CONTRACT.md` §6 | GET /v1/search?q=angkor returns results |
| 3.7 | Redis caching for all public GET endpoints | `CONSTITUTION.md` §3.3 | Cache hit returns faster |

**Depends on:** Track 2A (schema + seed data)
**Milestone:** M3 — Frontend can browse all inventory types

---

## Track 4: Booking Engine & Payments

> **Goal:** Create, hold, pay, confirm, cancel bookings.

### 4A: Booking Engine

| # | Task | Spec Reference | Verify |
|---|------|----------------|--------|
| 4.1 | `BookingsModule` — unified booking management | `API-CONTRACT.md` §11, `CONSTITUTION.md` §9 | Module scaffolded |
| 4.2 | Guide booking: `POST /v1/guides/{id}/bookings` | `API-CONTRACT.md` §11, `docs/modules/tour-guide/api.yaml` | Creates booking HOLD |
| 4.3 | Hotel booking: `POST /v1/hotels/{id}/bookings` | `API-CONTRACT.md` §11, `docs/modules/hotel-booking/api.yaml` | Creates booking HOLD |
| 4.4 | Transportation booking | `API-CONTRACT.md` §11, `docs/modules/transportation/api.yaml` | Creates booking HOLD |
| 4.5 | Unified booking CRUD: list, detail, update, cancel, QR, iCal | `API-CONTRACT.md` §11, `docs/modules/my-trip/` | All CRUD endpoints work |
| 4.6 | Overbooking protection (Prisma tx + overlap check) | `CONSTITUTION.md` §9.1, `EVENT-CATALOG.md` | Double-book → 409 |
| 4.7 | Redis hold mechanism (15-min TTL, auto-expire) | `CONSTITUTION.md` §9.1, `ROADMAP.md` Phase 5 | Hold expires → EXPIRED |
| 4.8 | Booking status state machine | `SCHEMA.md` BookingStatus enum | Valid transitions only |

### 4B: Payments

| # | Task | Spec Reference | Verify |
|---|------|----------------|--------|
| 4.9 | `PaymentsModule` — Stripe integration | `API-CONTRACT.md` §12, `docs/modules/payments/api.yaml` | Intent created |
| 4.10 | QR code generation (Bakong/ABA) | `API-CONTRACT.md` §12, `CONSTITUTION.md` §9.2 | QR code returned |
| 4.11 | Stripe webhook handler (idempotent) | `API-CONTRACT.md` §12, `CONSTITUTION.md` §9.2 | Webhook → confirmed |
| 4.12 | Refund processing (tiered: 100%/50%/0%) | `CONSTITUTION.md` §9.3, `ERROR-REGISTRY.md` PAY_* | Correct refund % |
| 4.13 | Discount code validation | `API-CONTRACT.md` §12, `ERROR-REGISTRY.md` DSC_* | Valid code applied |

**Depends on:** Track 2B (auth) + Track 3 (inventory)
**Milestone:** M4 (Booking) + M5 (Payments)

---

## Track 5: User & Engagement Features

> **Goal:** Reviews, favorites, loyalty, student discount.

| # | Task | Spec Reference | Verify |
|---|------|----------------|--------|
| 5.1 | `ReviewsModule` — CRUD with 7-day edit window | `API-CONTRACT.md` §4, `ERROR-REGISTRY.md` REV_* | Edit blocked after 7d |
| 5.2 | Verified booking badge on reviews | `EVENT-CATALOG.md` review.created | Badge for verified bookings |
| 5.3 | `FavoritesModule` — add/remove/list (100 max) | `API-CONTRACT.md` §5, `ERROR-REGISTRY.md` FAV_* | Limit enforced |
| 5.4 | `StudentDiscountModule` — verification submission | `docs/modules/student-discount/`, `ERROR-REGISTRY.md` STD_* | Submit → PENDING |
| 5.5 | `LoyaltyModule` — points balance, history, redemption | `docs/modules/loyalty/`, `ERROR-REGISTRY.md` LYL_* | Points accrue |
| 5.6 | `ProfileModule` — extended user profile | `API-CONTRACT.md` §2 Users | Fields update |

**Depends on:** Track 2B. Reviews need Track 3.
**Milestone:** M6 — Reviews, favorites, loyalty functional

---

## Track 6: Platform Completion

### 6.1 AI Tool Endpoints (after T3 + T4)

| # | Task | Spec Reference |
|---|------|----------------|
| 6.1.1 | `AiToolsModule` + `X-Service-Key` middleware | `CONSTITUTION.md` §8, `docs/modules/vibe-booking/api.yaml` |
| 6.1.2 | AI search, booking, payment QR, budget endpoints | `API-CONTRACT.md` §14, `ROADMAP.md` Phase 9 |
| 6.1.3 | Separate rate limiting + idempotency + circuit breaker | `CONSTITUTION.md` §8.2 |

### 6.2 Async & Notifications (after T4)

| # | Task | Spec Reference |
|---|------|----------------|
| 6.2.1 | EventEmitter global config + domain events | `EVENT-CATALOG.md` (18 events) |
| 6.2.2 | `NotificationsModule` — email, push, in-app | `ROADMAP.md` Phase 8 |
| 6.2.3 | Cron jobs: expired bookings, reminders, festival alerts | `CONSTITUTION.md` §7.2 |

### 6.3 Emergency & Safety (after T2B)

| # | Task | Spec Reference |
|---|------|----------------|
| 6.3.1 | `EmergencyModule` — alerts, location sharing, contacts | `docs/modules/emergency/api.yaml`, `API-CONTRACT.md` §13 |

### 6.4 Admin & Operations (after T5 + T6.2)

| # | Task | Spec Reference |
|---|------|----------------|
| 6.4.1 | `AdminModule` — verifications, analytics, audit logs | `docs/modules/admin/api.yaml`, `ROADMAP.md` Phase 11 |
| 6.4.2 | Health check endpoints (basic + detailed) | `CONSTITUTION.md` §10.2 |
| 6.4.3 | Audit interceptor — log all mutations | `CONSTITUTION.md` §10.1, `SCHEMA.md` AuditLog |

### 6.5 Testing Hardening (after all features)

| # | Task | Spec Reference |
|---|------|----------------|
| 6.5.1 | Coverage: 80% unit, 90% critical paths | `TEST-PLAN.md` §2 |
| 6.5.2 | Property-based tests (fast-check) | `TEST-PLAN.md` §4.3 |
| 6.5.3 | All 9 critical E2E flows | `TEST-PLAN.md` §3 |
| 6.5.4 | Load test: 100 concurrent bookings | `TEST-PLAN.md` §11 |
| 6.5.5 | Security scan | `TEST-PLAN.md` §12 |

### 6.6 Production Readiness (after T6.5)

| # | Task | Spec Reference |
|---|------|----------------|
| 6.6.1 | Production Dockerfile (multi-stage) | `TECH-STACK.md` §Docker |
| 6.6.2 | Swagger/OpenAPI at `/api/docs` | `TECH-STACK.md` §Runtime |
| 6.6.3 | Sentry integration | `docs/product/feature-decisions.md` F112 |
| 6.6.4 | Graceful shutdown | `CONSTITUTION.md` §10.3 |

---

## Recommended Week-by-Week Execution

| Week | Tasks | What You Ship |
|------|-------|---------------|
| 1 | T0 (all) + T1.1–1.5 | Runnable project, Docker, DB connected |
| 2 | T1.6–1.13 + T2.1–2.3 | Shared kernel complete, DB migrated & seeded |
| 3 | T2.4–2.8 | Auth flow working end-to-end |
| 4 | T3.1–3.4 | Trips, places, hotels, guides browsable |
| 5 | T3.5–3.7 + T4.1–4.4 | Transport + booking creation |
| 6 | T4.5–4.8 | Full booking engine with holds |
| 7 | T4.9–4.13 | Payments complete |
| 8 | T5.1–5.6 | Reviews, favorites, loyalty, student |
| 9 | T6.1 + T6.2 | AI tools + async/notifications |
| 10 | T6.3 + T6.4 | Emergency + admin |
| 11 | T6.5 | Testing hardening |
| 12 | T6.6 | Production ready |

---

## Spec-Driven Development Workflow (Per Task)

```
1. Read the referenced spec docs
2. Write your implementation plan (what files, what code)
3. Scaffold the module: module → controller → service → dto
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

## What This Replaces

This file **consolidates and supersedes** `ROADMAP.md` as the primary task index.
`ROADMAP.md` remains as detailed phase documentation with deliverables, decision log, and risk register.
`PROGRESS-TRACKER.md` remains as the live status tracker — update it as you complete tasks here.
