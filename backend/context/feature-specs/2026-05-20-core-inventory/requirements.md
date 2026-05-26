# Requirements: Core Inventory

> **Feature:** Phase 4 — Core Inventory (read-only catalog APIs)
> **Branch:** `feature/2026-05-20-core-inventory`
> **Phase:** 4
> **Date:** 2026-05-20
> **Tests:** **Skipped in this branch by user direction.** No unit, E2E, property-based, or coverage tasks. Focus is functional implementation only. Tests will be authored in a separate follow-up branch and are a hard prerequisite before merge to `main`.

---

## Scope

### In scope
- **`TripsModule`** — list, detail, related trips, share endpoint
- **`PlacesModule`** — list, detail, related places, nearby trips/places
- **`HotelsModule`** — list, detail, room availability check
- **`GuidesModule`** — list, detail, availability check
- **`TransportationModule`** — list vehicles, detail, availability check
- **`SearchModule`** — global search (DB-backed `ILIKE` stub across trip/place/hotel/guide title + tags; Meilisearch deferred)
- **Redis caching** — public GET endpoints wrapped with TTL-aware cache; per-endpoint TTL pulled from `docs/modules/*/api.yaml` (`x-nfr-cache-ttl`) where documented; 300s default for trips/places/transport, 3600s for hotel detail/rooms (per spec)
- **Pagination** — every list endpoint uses the existing `PageQueryDto` from the shared kernel, returns `PaginatedResponse<T>`
- **i18n** — list/detail responses respect the `Accept-Language` header (`en` | `zh` | `km`); fall back to `en` row when translation missing
- **Soft delete awareness** — every query filters `deletedAt IS NULL`
- **Response envelope** — every endpoint returns `{ success, data }` via the global `TransformInterceptor` (already in place from Phase 1)

### Out of scope
- **Tests** — explicitly removed per user direction. No unit, E2E, or property-based tests in this branch. Test coverage will be added in a follow-up branch before merge.
- **Mutations** — no create/update/delete on catalog resources. Inventory administration ships in Phase 11 (Admin & Operations).
- **Bookings** — booking creation against any of these resources is Phase 5 (`BookingsModule`).
- **Reviews / favorites on inventory** — Phase 7 (User Features).
- **Meilisearch** — search is a DB-backed stub for this branch.
- **Geospatial PostGIS queries** — "nearby" uses naive bounding-box / Haversine in TypeScript until PostGIS is enabled (Phase 12+).
- **Multi-file Prisma schema split** — Phase 2 deliverable owned by senior; this branch builds against the current monolithic `prisma/schema.prisma` and will adapt when the split lands.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Use-case pattern** matching `backend/src/modules/auth/` — one `*UseCase` class per endpoint, single `execute()` method, **no `<feature>.service.ts`** | User direction. Aligns Phase 4 with the rest of the codebase, isolates per-endpoint logic for future test work, and keeps controllers thin. See `plan.md` § "Code Standard — Use-Case Pattern" for the canonical layout. |
| 2 | **Module path: `src/modules/<feature>/`** | Matches the actual layout adopted by Phase 3 (`src/modules/auth/`, `src/modules/users/`). The roadmap text says `src/<feature>/` but Phase 3 deviated; staying consistent with deployed code beats re-aligning the roadmap mid-flight. |
| 3 | **Build against current monolithic `prisma/schema.prisma`** | Senior owns the multi-file split (Phase 2). Model fields and relations are stable; the split is structural only. When senior merges, this branch rebases without code changes. |
| 4 | **DB-stub search via Prisma `contains` + `mode: 'insensitive'`** across `Trip.title`, `Place.title`, `Hotel.name`, `Guide.fullName`, plus their `tags` arrays | Roadmap §4.6 explicitly calls for a stub. Meilisearch is a separate project. |
| 5 | **Redis caching layer = lightweight method-level wrapper** (`this.cache.getOrSet(key, ttl, () => prismaQuery())`) — not `@Cacheable` decorator | The Phase 1 `RedisService` already exposes `get`/`setex`/`del`. A decorator would require module reflection plumbing we do not yet have. The wrapper is 10 lines and explicit. |
| 6 | **Per-endpoint TTL** — read from `api.yaml` `x-nfr-cache-ttl` where present; otherwise apply defaults | Documented values: `tour-guide` list/availability = 300s; `hotel-booking` rooms = 3600s. Defaults: trip/place/transport list = 300s, detail = 600s, search = 60s. |
| 7 | **No `<feature>.repository.ts` files** unless query complexity warrants | Per `roadmap.md` "Module File Convention". Adding a repo for `findMany({ where: { deletedAt: null } })` is overkill. |
| 8 | **No `BookingItem` / availability cross-checks** in this branch | "Availability check" endpoints (guides/hotels/transport) compare requested dates against existing `Booking` rows in `CONFIRMED` status. Hold-aware availability ships with Phase 5. This branch returns the simpler "is the resource active and dates not already booked" answer. |
| 9 | **`Accept-Language` header pattern** — `parseAcceptLanguage(req)` returns `'en' \| 'zh' \| 'km'`, default `'en'`. Service joins the matching `*Translation` row | Matches the schema; keeps logic in one helper inside `src/common/i18n/`. |
| 10 | **Tests deliberately omitted** | User direction: "make this work first, test later." Validation gate covers manual smoke + build/lint only. Follow-up branch must restore the 80% coverage gate from `TEST-PLAN.md` before this code is allowed in main. |

---

## Context

### Why this matters
Phase 4 is the first user-facing read path. Without it, the frontend has nothing to render, the AI agent has nothing to search over, and Phase 5 (Booking Engine) cannot start — every booking endpoint takes a `tripId` / `hotelId` / `guideId` / `vehicleId` that must resolve to a real, listable resource.

### What already exists (assumptions this branch leans on)
- **Phase 1 shared kernel:** `PrismaService`, `RedisService`, `TransformInterceptor`, `AllExceptionsFilter`, `JwtAuthGuard` (so we can mark these endpoints `@Public()`), `PageQueryDto`, `PaginatedResponse<T>`, `ErrorCodes` registry. All available under `src/common/`.
- **Phase 3 auth:** `@Public()` decorator works; `@CurrentUser()` available for endpoints that personalise responses (e.g., favorited flag — out of scope here, noted for Phase 7).
- **Schema:** all 13 inventory-related models live in `prisma/schema.prisma`:
  `Trip`, `TripTranslation`, `TripItineraryItem`, `TripItineraryItemTranslation`,
  `Place`, `PlaceTranslation`,
  `Hotel`, `HotelTranslation`, `HotelRoom`,
  `Guide`, `GuideLanguage`, `GuideSpeciality`,
  `TransportationVehicle`.

### What this branch does NOT depend on
- Phase 2 multi-file schema split (we use the monolithic file as-is)
- Seed data — endpoints work against an empty DB; lists return `[]` cleanly. Manual smoke needs at least one row per table; documented in `validation.md`.

### Token / auth posture
All endpoints in this branch are **`@Public()`**. Catalog browsing must work without a logged-in user (matches `MISSION.md` § Target State: "Traveler opens app → search trips/places…"). When a future task adds personalisation (favorites flag, recently-viewed), it will switch to `@OptionalAuth()` (a decorator we do not need to add yet).

### NFR targets (from `MISSION.md`)
- List endpoints **< 300 ms p95** with 1000 records
- Detail endpoints **< 200 ms p95**
- Both are budget targets in the DoD; no perf test gate in this branch (deferred to Phase 12).

---

## References

- `backend/context/plans/roadmap.md` — Phase 4 (tasks 4.1 – 4.7)
- `backend/context/guides/MISSION.md` — § Target State, NFR budgets
- `backend/context/guides/TECH-STACK.md` — Prisma 6, ioredis, Pino
- `backend/context/guides/CONSTITUTION.md` — § 1 Module structure, § 3.3 Caching, § Naming
- `backend/context/guides/CODE-STANDARD.md` — DTO rules, NestJS patterns
- `backend/context/specs/SCHEMA.md` — Trip / Place / Hotel / Guide / TransportationVehicle models
- `backend/context/specs/API-CONTRACT.md` — § 3 Trips, § 6 Search, § 7 Places, § 8 Hotels, § 9 Guides, § 10 Transportation
- `backend/context/specs/ERROR-REGISTRY.md` — `TRP_*`, `PLC_*`, `HTL_*`, `GUI_*`, `TRN_*`, `SRC_*` codes
- `docs/modules/trip-discovery/api.yaml` — list/detail/related shapes
- `docs/modules/explore-places/api.yaml` — list/detail/nearby shapes
- `docs/modules/hotel-booking/api.yaml` — list/detail/rooms (+ `x-nfr-cache-ttl: 3600`)
- `docs/modules/tour-guide/api.yaml` — list/detail/availability (+ `x-nfr-cache-ttl: 300`)
- `docs/modules/transportation/api.yaml` — vehicles list/detail/availability
- `backend/context/feature-specs/2026-05-17-auth-users/` — pattern reference for plan/requirements/validation triplet
- `backend/context/feature-specs/2026-05-20-core-inventory/progress-tracker.md` — **living progress doc; AI must update after every file/gate** (see "How to Use This Tracker")
