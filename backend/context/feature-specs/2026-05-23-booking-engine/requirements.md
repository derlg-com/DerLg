# Requirements: Booking Engine

> **Feature:** Phase 5 — Booking Engine (create / read / update / cancel across guide, hotel, transportation)
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5
> **Date:** 2026-05-23
> **Tests:** **Critical paths only this branch.** Unit tests are required for the high-risk pieces (overlap detection, hold TTL behaviour, refund tier calculation, status state machine). Controller-level and full E2E coverage are deferred to a follow-up branch and remain a hard prerequisite of `TEST-PLAN.md` (Bookings = 90 % unit + integration + E2E + property) before merge to `main`.

---

## Scope

### In scope (full Phase 5 — all 8 ROADMAP tasks 5.1–5.8)

- **`BookingsModule`** — unified booking management module under `src/modules/bookings/` (use-case pattern, mirroring `src/modules/auth/` and the catalog modules)
- **Booking-creation endpoints** (one per inventory type that has a typed booking shape):
  - `POST /v1/guides/:guideId/bookings` — create guide booking (`HOLD`)
  - `POST /v1/hotels/:hotelId/bookings` — create hotel booking (`HOLD`)
  - `POST /v1/transportation/bookings` — create transportation booking (`HOLD`)
- **Unified booking surface** (read + lifecycle):
  - `GET /v1/bookings` — list current user's bookings (paginated, optional `status` filter)
  - `GET /v1/bookings/:id` — booking detail
  - `PATCH /v1/bookings/:id` — update before confirmation (HOLD only)
  - `POST /v1/bookings/:id/cancel` — cancel with tiered refund calculation
  - `GET /v1/bookings/:id/qr` — booking QR code (uses existing reference)
  - `GET /v1/bookings/:id/ical` — iCalendar export (`text/calendar`)
- **Overbooking protection** — Prisma transaction with overlap query against existing `Booking` rows in `HOLD`, `PENDING_PAYMENT`, and `CONFIRMED` statuses (per `CONSTITUTION.md` § 9.1) for the same `guideId` / `hotelRoomId` / `vehicleId` and overlapping `[startDate, endDate]`. Conflict → `409 BKNG_UNAVAILABLE`.
- **Redis hold mechanism** — on creation, set `booking_hold:{bookingId}` with TTL = 900 s (15 min). When the key expires, the booking transitions to `EXPIRED` (cleanup cron handled in Phase 8; this branch must scaffold the cron entrypoint and the use case it calls so Phase 8 only wires the schedule).
- **Booking status state machine** — `HOLD → PENDING_PAYMENT | CANCELLED | EXPIRED`; `PENDING_PAYMENT → CONFIRMED | CANCELLED | EXPIRED`; `CONFIRMED → CANCELLED`. Invalid transitions throw with the corresponding `BKNG_*` code.
- **Tiered refund calculation** — `> 7 days = 100 %`, `3–7 days = 50 %`, `< 3 days = 0 %` (per `CONSTITUTION.md` § 9.3). Pure function in `utils/`, exported and unit-tested.
- **Reference generator** — `<TYPE>-<6CHAR>` prefix per booking kind (`GDE-`, `HTL-`, `TRN-`); base32-uppercase from a UUID for collision resistance, retried on rare DB collision.
- **Idempotency** — booking-creation endpoints honour `Idempotency-Key` header (per `CONSTITUTION.md` § 2.5). The first request creates the booking; identical retry returns the same response (no duplicate row, no second hold). Implemented via a Redis `idem:booking:{userId}:{key}` reservation (TTL 24 h) that stores the resulting booking id.
- **Authorization** — every endpoint resolves the booking via the `userId` claim from the JWT. `BKNG_NOT_AUTHOR` (403) for cross-user access. `@CurrentUser()` from Phase 1 used throughout.
- **Soft delete awareness** — every query filters `deletedAt: null`.
- **Response envelope** — `{ success, data }` via the existing global `TransformInterceptor`.
- **Unit tests for critical paths only** (per user direction):
  - `check-overlap.util.spec.ts` — overlap matrix, edge cases (adjacent dates, zero-day, swapped boundaries)
  - `compute-refund.util.spec.ts` — tier boundaries (exact 3 days, exact 7 days, future-bound dates)
  - `transition-status.util.spec.ts` — every legal transition + every illegal one throws
  - `set-hold.use-case.spec.ts` — hold key written with the correct key + TTL (Redis service mocked)
  - `cancel-booking.use-case.spec.ts` — refund amount, status update, hold release; mock Prisma/Redis
- **Domain event emission stubs** — `booking.created`, `booking.cancelled`, `booking.expired` are emitted via `EventEmitter2` (Phase 8 owns wiring + handlers; this branch only needs to emit the typed payloads from `EVENT-CATALOG.md` so Phase 8 is plug-in only).

### Out of scope

- **Trip bookings** — `Booking.tripId` is in the schema but no `POST /v1/trips/:id/bookings` endpoint is listed in `API-CONTRACT.md` § 11. Defer until a product decision lands. Trip itineraries today aggregate guide/hotel/transport sub-bookings; this branch does not introduce a parent-trip-booking concept.
- **Cron scheduler for hold expiry** — the scheduler itself ships in Phase 8 (`cleanupExpiredBookings` every 5 min, per ROADMAP § 8). This branch ships the use case the cron will call (`expire-hold.use-case.ts`) so Phase 8 only registers `@Cron(CronExpression.EVERY_5_MINUTES)`.
- **Stripe payment intent creation, webhooks, refund processor calls** — Phase 6 (Payments). This branch's `cancel` endpoint calculates the refund **amount and percentage** and persists `Booking.status = CANCELLED`. The actual Stripe `refunds.create` call lands in Phase 6 and consumes the `booking.cancelled` event payload.
- **Notification emails / push** — Phase 8 consumes `booking.created` / `booking.cancelled` / `booking.expired` events. This branch only emits.
- **Loyalty point accrual on confirmation** — Phase 7. `booking.confirmed` is emitted on payment-side; this branch does not handle confirmation transition (that fires from `payment.completed` in Phase 6).
- **Reviews / favourites against bookings** — Phase 7.
- **Admin booking surfaces** — Phase 11.
- **Property-based tests, full E2E (`bookings.e2e-spec.ts`), controller integration tests, and 90 % coverage gate** — deferred to follow-up branch by user direction. `TEST-PLAN.md` § 2 (Bookings = 90 %) and § 3.2 / § 3.3 / § 3.6 (booking E2E flows) are not satisfied by this branch and must be restored before merge to `main`.
- **Multi-file Prisma schema split** — Phase 2 deliverable owned by senior. This branch builds against the current `prisma/schema.prisma`.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Use-case pattern** matching `src/modules/auth/` and `src/modules/<catalog>/` — one `*UseCase` class per endpoint, single `execute()`, **no `<feature>.service.ts`** | User direction. Keeps Phase 5 consistent with Phase 3 + Phase 4. Makes per-use-case unit tests trivial to write for the critical paths the user has scoped in. |
| 2 | **Module path: `src/modules/bookings/`** | Matches the actual layout adopted by Phase 3 and Phase 4 (`src/modules/<feature>/`). The roadmap text says `src/<feature>/` but real code lives under `src/modules/`; staying consistent with deployed code beats re-aligning the roadmap mid-flight. |
| 3 | **One `BookingsModule`, but creation routes live on the inventory paths** (`POST /v1/guides/:id/bookings`, `POST /v1/hotels/:id/bookings`, `POST /v1/transportation/bookings`) | Matches `API-CONTRACT.md` § 11 verbatim. Implemented by registering **two controllers** under `BookingsModule` — `BookingsController` for the unified `/v1/bookings/*` surface and `InventoryBookingsController` for the three inventory-prefixed `POST` routes. Keeps URL shapes correct without reaching into other feature modules. |
| 4 | **Tests for critical paths only this branch** | User direction. The five critical pieces (overlap, refund, status, hold, cancel) are the parts where a bug ships money loss or double-bookings. Controller/E2E coverage and the 90 % gate are deferred to a follow-up branch — explicitly tracked as a pre-merge prerequisite. |
| 5 | **Overlap check inside Prisma `$transaction`** with `findMany({ where: { ...resourceFK, status: { in: [HOLD, PENDING_PAYMENT, CONFIRMED] }, NOT: { endDate: { lte: startDate }, startDate: { gte: endDate } } } })`, then `create` in the same transaction | `CONSTITUTION.md` § 9.1 spec. Prevents TOCTOU between read and write. Postgres default isolation (`READ COMMITTED`) is acceptable because the overlap predicate plus the unique guarantee of `createdAt`-ordered inserts under `(resourceId, status, dateRange)` conflict resolution gives us conflict-on-write; if both transactions race, the second `findMany` sees the first row committed once it reaches `commit`. We do **not** use `SELECT FOR UPDATE` in this branch — see Risk § R1. |
| 6 | **Redis hold key: `booking_hold:{bookingId}` TTL = 900 s** | `CONSTITUTION.md` § 3.3 + § 9.1 verbatim. Single source of truth for "is this hold still alive". |
| 7 | **Refund tiers as a pure function** (`computeRefund(booking, now)`) returning `{ amountUsd, percentage }` | `CONSTITUTION.md` § 9.3 verbatim. Easy to unit-test (boundary cases at exactly 3 / 7 days). No Prisma / Redis dependency. |
| 8 | **Reference format: `<KIND>-<BASE32(6)>`** (e.g. `GDE-7K2QRX`) generated client-side in the use case before insert; uniqueness enforced by the `reference` unique index on `Booking` | `SCHEMA.md` `Booking.reference @unique`; `API-CONTRACT.md` examples use `GDE-ABC123` shape. Retry on `P2002` up to 3 times (collision astronomically unlikely). |
| 9 | **Status transitions enforced by a pure helper** (`assertTransition(from, to)` throws on invalid) called inside every status-changing use case | Centralises the state machine, avoids each use case re-deriving "is this legal". Unit-tested per the test posture above. |
| 10 | **Idempotency via Redis** (`idem:booking:{userId}:{key}` → `bookingId`, TTL 24 h) | `CONSTITUTION.md` § 2.5: idempotency required for booking creation. Redis is already in the stack; introducing a DB table is overkill at this stage. The first response body is also cached at the same key (small payload) so retries return byte-identical envelopes. |
| 11 | **Two controllers, one module** | `InventoryBookingsController` carries `@Controller()` with no prefix and uses fully-qualified `@Post('guides/:guideId/bookings')` style routes so the URL shapes match `API-CONTRACT.md`. `BookingsController` is `@Controller('bookings')`. Both share the same `BookingsModule` providers list. |
| 12 | **Cron entrypoint shipped, schedule deferred** | The use case `expire-hold.use-case.ts` lives here so it can be unit-tested. The `@Cron` registration lands with `BookingCleanupJob` in Phase 8 per ROADMAP § 8. |
| 13 | **No use of `BookingItem` / line-item table** | `SCHEMA.md` shows a single `Booking` row with polymorphic FKs (`tripId / guideId / hotelRoomId / vehicleId`) and a flat `totalPriceUsd`. No itemisation needed for MVP per `API-CONTRACT.md`. |
| 14 | **iCal generation is a pure util** (`build-ical.util.ts`) producing an RFC 5545 string from a `Booking` row | Avoids pulling in `ical-generator` for one endpoint; the format is small and stable. If a future endpoint needs more complex calendar features, swap in the library. |
| 15 | **QR code returns the `qrCodeUrl` field already populated by the create flow** (placeholder URL for now: `${FRONTEND_URL}/bookings/${reference}/qr`); actual rendered QR PNG / SVG is out of scope until Phase 6 hooks Bakong/ABA | Matches `API-CONTRACT.md` § 11 response shape. Ensures the endpoint exists and contracts hold; Phase 6 swaps the URL for a CDN-hosted PNG. |
| 16 | **Domain events emitted now, handlers deferred** | `EVENT-CATALOG.md` payloads are stable; Phase 8 will consume. Emitting now lets Phase 8 plug in without touching this code. |

---

## Context

### Why this matters

Phase 5 turns the read-only catalog of Phase 4 into something a user can actually buy. It is the connective tissue between the inventory (Phase 4) and money movement (Phase 6). Without it:

- Frontend's "Book now" flows have no backend
- Phase 6 has nothing to attach a `PaymentIntent` to (every payment row is keyed by `bookingId`)
- The AI agent (Phase 9) has no `POST /v1/ai-tools/bookings` to wrap (its tool is a thin pass-through to this module's creation use cases)
- TEST-PLAN.md's two highest-risk critical-path E2E flows (§ 3.2 Booking Creation + § 3.3 Double Booking Prevention) cannot be satisfied without this module

The branch is also where the booking **state machine** is encoded for the first time. Every later phase (payments confirming, cron expiring, admin cancelling) reads from and writes to this state machine via the helpers shipped here.

### What already exists (assumptions this branch leans on)

- **Phase 1 shared kernel:** `PrismaService`, `RedisService`, `CachedService`, `TransformInterceptor`, `AllExceptionsFilter`, `JwtAuthGuard` (default-on), `@CurrentUser()`, `@Public()`, `PageQueryDto`, `PaginatedResponse<T>`, `ApiResponse<T>`, `ErrorCode` registry under `src/common/errors/error-codes.ts`. All available.
- **Phase 3 auth:** Bearer JWT validation works, `req.user` carries the typed `JwtPayload`. `@CurrentUser()` returns it.
- **Phase 4 catalog modules:** `Guide`, `Hotel`, `HotelRoom`, `TransportationVehicle` resources are listable / detail-fetchable. The booking-creation use cases here will `findFirst({ where: { id, deletedAt: null, status: ACTIVE } })` against the same models.
- **Schema:** `Booking` model in `prisma/schema.prisma` with polymorphic FKs (`tripId`, `guideId`, `hotelId`, `hotelRoomId`, `vehicleId`), `status: BookingStatus @default(HOLD)`, `holdExpiresAt`, `reference @unique`. All conventions (UUID PK, `Decimal(10,2)`, `Timestamptz`, `deletedAt`) already applied.
- **Error registry:** `BKNG_*` codes (10) already documented in `ERROR-REGISTRY.md`. Adjacent prerequisite codes (`GDE_UNAVAILABLE`, `HTL_EXCEEDS_OCCUPANCY`, `TRNS_UNAVAILABLE`, `TRIP_NO_AVAILABILITY`, etc.) also present.
- **Event catalog:** `booking.created`, `booking.cancelled`, `booking.expired` payload shapes locked in `EVENT-CATALOG.md`. `EventEmitter2` is part of `@nestjs/event-emitter`; this branch imports `EventEmitterModule` at the root.

### NFR targets (from `MISSION.md`)

- Booking creation **< 500 ms p95** (informal smoke; not gated this branch)
- Cancellation **< 300 ms p95** (informal smoke)
- All endpoints return the `{ success, data }` envelope in **< 1 s** even under cold cache

### Token / auth posture

All Phase 5 endpoints are **authenticated** (default-on `JwtAuthGuard` from Phase 1). No `@Public()` anywhere in this branch. `@CurrentUser()` injects the JWT payload; the user's `sub` (uuid) is the single source of authorship.

---

## Dependencies

Per `ROADMAP.md` → Dependency Graph, Phase 5 depends on:

| Prior Phase | Status | What this branch consumes |
|-------------|--------|---------------------------|
| Phase 1 — Foundation & Shared Kernel | 🟢 Complete | `PrismaService`, `RedisService`, `CachedService`, `JwtAuthGuard`, `@CurrentUser()`, `TransformInterceptor`, `AllExceptionsFilter`, `ErrorCode` registry, `PageQueryDto`, `PaginatedResponse<T>` |
| Phase 3 — Auth & Users | 🟢 Complete | `JwtAuthGuard` issues the user identity every booking endpoint requires |
| Phase 4 — Core Inventory | 🟢 Complete | `Guide`, `Hotel`, `HotelRoom`, `TransportationVehicle` rows must exist to be booked. The use cases re-query these directly via `PrismaService` (no cross-module imports). |

> **Note:** Phase 2 (Database Schema, multi-file split) is `🟡 In Progress (Senior)` per `PROGRESS-TRACKER.md`. This branch builds against the current monolithic `prisma/schema.prisma`. When the multi-file split lands, this branch rebases without code changes (the model fields and relations referenced here are stable).

---

## References

- `backend/context/plans/ROADMAP.md` — Phase 5 (tasks 5.1 – 5.8)
- `backend/context/guides/MISSION.md` — § Target State, NFR budgets
- `backend/context/guides/CONSTITUTION.md` — § 1 Module structure, § 2.5 Idempotency, § 3.3 Redis key conventions, § 9 Booking & Payment Rules
- `backend/context/guides/CODE-STANDARD.md` — DTO rules, NestJS patterns
- `backend/context/guides/TECH-STACK.md` — Prisma 6, ioredis, EventEmitter2 versions
- `backend/context/specs/SCHEMA.md` — `Booking` model (lines 458–507), `BookingStatus` enum (lines 54–60)
- `backend/context/specs/API-CONTRACT.md` — § 11 Bookings (lines 726–900)
- `backend/context/specs/ERROR-REGISTRY.md` — `BKNG_*` codes (10), `GDE_*` / `HTL_*` / `TRNS_*` adjacent codes
- `backend/context/specs/EVENT-CATALOG.md` — `booking.created` / `booking.cancelled` / `booking.expired` payloads
- `backend/context/plans/TEST-PLAN.md` — § 2 Coverage Gates (Bookings = 90 %), § 3.2 / § 3.3 / § 3.6 critical E2E flows (deferred this branch)
- `backend/context/feature-specs/2026-05-20-core-inventory/` — pattern reference for plan/requirements/validation triplet (use-case template, barrel conventions, per-module gate)
- `backend/context/feature-specs/2026-05-17-auth-users/` — pattern reference for an authenticated module
