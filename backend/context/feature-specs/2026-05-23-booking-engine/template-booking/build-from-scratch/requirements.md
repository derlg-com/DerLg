# Requirements: M3 — Build From Scratch

> **Method:** M3 (Multi-Resource — Build From Scratch)
> **Source workflow:** `docs/workflows/customize-package/02-build-from-scratch.md`
> **Branch:** TBD (not this branch — Phase 5c follow-up)
> **Phase:** 5c — Build From Scratch
> **Date:** 2026-05-25

This spec covers the **most complex** customization flow: a traveler starts with a blank slate, fills a basics form, the system auto-generates a day-by-day skeleton, the user customizes each day, then commits a booking. M3 produces a `JourneyConfiguration` (shared with M1 and M2) and ultimately delegates to the same `commit-booking.use-case.ts` as M4.

> **Why M3 first (after M4):** M3 is the broadest customization surface. If its primitives (skeleton generator, per-day wizard, journey assembly, draft persistence) work, M1 (public-package customize) and M2 (private-prebuilt customize) become subsets — they can reuse skeleton generation logic by feeding it a pre-existing trip template instead of a blank canvas.

---

## Scope

### In scope (Phase 5c)

- **`POST /v1/trips/build-from-scratch/basics`** — submit basics form, receive auto-generated skeleton + `sessionId`
- **`GET /v1/trips/build-from-scratch/sessions/:sessionId`** — re-fetch a skeleton (e.g., user reopened the page)
- **`POST /v1/availability/check`** — cached per-resource availability probe (used during customization)
- **`POST /v1/journey-drafts`** — save in-progress draft
- **`GET /v1/journey-drafts`** — list user's drafts
- **`GET /v1/journey-drafts/:draftId`** — load a specific draft
- **`DELETE /v1/journey-drafts/:draftId`** — discard a draft
- **`POST /v1/trips/build-from-scratch/configurations`** — finalize day-by-day customization into a `JourneyConfiguration` (status `DRAFT`)
- **`POST /v1/availability/confirm`** — fresh check across all days; freezes configuration to status `CONFIRMED` with 15-minute TTL
- **`POST /v1/bookings`** — unified booking commit (accepts `{ configurationId, idempotencyKey }`) — shared with M1/M2
- Skeleton generator algorithm (deterministic, rule-based — see § "Skeleton Generation")
- Validators: budget cap, travel-time-between-activities, opening hours, group-size enforcement
- `JourneyConfiguration` writes for M3 source

### Out of scope (handled elsewhere)

- The `commit-booking` atomic primitive — `../shared-foundation/`
- `JourneyConfiguration` model + the `journey-configurations/` shared module — `../journey-configurations/` (Phase 5b prerequisite)
- M1 — public-package customize — `../package-booking/` (Phase 5b)
- M2 — private-prebuilt customize — `../package-booking/` (Phase 5b)
- M4 — single-resource quick-book — `../specific-booking/` (Phase 5a, complete)
- AI-assisted skeleton generation — Phase 9 (Vibe Booking agent uses these endpoints as tools)
- Journey sharing (`POST /v1/journeys/share`, public discovery) — Phase 7
- Location reviews — Phase 7
- Stripe payment integration — Phase 6
- Notification emails / push — Phase 8
- Multi-city flight booking integration (currently treated as a "transport" line item only)

---

## User Flow

```
Phase 1: Basics Form
   POST /v1/trips/build-from-scratch/basics
   → returns { sessionId, generatedSkeleton }

Phase 2: Per-Day Customization (frontend-driven, backend-supported)
   POST /v1/availability/check  (cached, called on every change)
   POST /v1/journey-drafts      (save anytime)
   GET  /v1/journey-drafts      (resume later)

Phase 3: Final Assembly
   POST /v1/trips/build-from-scratch/configurations
   → returns JourneyConfiguration (DRAFT)

Phase 4: Confirmation Lock
   POST /v1/availability/confirm
   → JourneyConfiguration becomes CONFIRMED, 15-min TTL

Phase 5: Booking Commit
   POST /v1/bookings { configurationId }
   → shared-foundation's commit-booking writes Booking + N BookingItem rows
```

---

## Endpoints

### `POST /v1/trips/build-from-scratch/basics`

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT |
| Idempotency-Key | Optional (sessionId is the natural dedup key) |
| Response status | `200` with `{ sessionId, generatedSkeleton }` |

#### Request — `BuildFromScratchBasicsDto`

```ts
{
  startDate: string;             // ISO date, ≥ tomorrow (UTC)
  endDate: string;               // ISO date, ≤ startDate + 30 days
  travelers: {
    adults: number;              // ≥ 1, total ≤ 20
    children?: number;           // ≥ 0
    childrenAges?: number[];     // 0–17, length === children
  };
  tripStyle: 'ADVENTURE' | 'CULTURAL' | 'RELAXATION' | 'FAMILY' | 'MIXED';
  budgetUsd: number;             // ≥ 100
  languages: string[];           // ISO codes ('en', 'zh', 'km', etc.) min 1
  mobilityNeeds?: ('WHEELCHAIR' | 'ELDERLY')[];
  dietaryRestrictions?: ('HALAL' | 'VEGAN' | 'GLUTEN_FREE')[];
  destinations: string[];        // 1–5 province names
  mustSee?: string[];            // free text, max 10 entries
}
```

#### Response

```ts
{
  sessionId: string;             // uuid — used to resume customization
  generatedSkeleton: {
    durationDays: number;
    days: Array<{
      dayNumber: number;
      date: string;              // computed startDate + dayNumber - 1
      destination: string;
      theme: string;             // e.g. "Arrival & Temples"
      suggestedActivities: Array<{ id, name, type, durationMin, priceUsd }>;
      suggestedHotel: { id, name, pricePerNightUsd } | null;
      suggestedTransport: { id, type, priceUsd } | null;
      mealsIncluded: ('BREAKFAST' | 'LUNCH' | 'DINNER')[];
      estimatedDayPriceUsd: number;
    }>;
    estimatedTotalUsd: number;
    estimatedBreakdown: {
      activitiesUsd: number;
      hotelsUsd: number;
      transportUsd: number;
      guidesUsd: number;
      mealsUsd: number;
    };
  };
}
```

The skeleton is **suggested**, not committed. The user is free to swap any of it before confirming. Persisted in Redis under `bfs_session:{sessionId}` with TTL 24h.

### `GET /v1/trips/build-from-scratch/sessions/:sessionId`

Returns the same `{ sessionId, generatedSkeleton }` shape. `404 BFS_SESSION_NOT_FOUND` if the Redis key has expired.

### `POST /v1/availability/check`

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT |
| Cache TTL | 120 s (per `CONSTITUTION.md` § 3.4) |
| Response status | `200` with `{ checks: [...] }` |

#### Request

```ts
{
  checks: Array<{
    type: 'HOTEL' | 'TRANSPORTATION' | 'ACTIVITY' | 'GUIDE';
    resourceId: string;
    startDate: string;
    endDate: string;
    quantity?: number;           // hotel rooms, vehicle seats, activity slots
  }>;
}
```

#### Response

```ts
{
  checks: Array<{
    type, resourceId, startDate, endDate,
    available: boolean,
    capacity: number | null,
    bookedNow: number | null,
    priceUsd: number,
    reason?: 'CAPACITY_REACHED' | 'OUTSIDE_OPENING_HOURS' | 'CLOSED_DATE' | 'GUIDE_SUSPENDED' | 'INVENTORY_INACTIVE'
  }>;
  cachedAt: string;              // ISO timestamp — frontend can show "checked X seconds ago"
}
```

This endpoint is **shared** with M1/M2 (per `booking-methods.md` § 5). M3 just consumes it — it does not own the implementation.

### `POST /v1/journey-drafts`

Persists in-progress customization. Used for "save and continue later."

```ts
// Request
{
  sessionId?: string;            // optional link back to the BFS session
  source: 'BUILD_FROM_SCRATCH';  // M3-only for this spec; M1/M2 add their own
  title: string;                 // user-supplied, max 120 chars
  startDate: string;
  endDate: string;
  travelers: { adults, children?, childrenAges? };
  budgetUsd: number;
  totalPriceUsd: number;
  days: Array<{
    dayNumber, date, destination, theme,
    activities: Array<{ resourceId, name, startTime, durationMin, priceUsd }>,
    hotel?: { resourceId, pricePerNightUsd },
    transport?: { resourceId, type, priceUsd },
    guide?: { resourceId, pricePerDayUsd },
    mealsIncluded: string[],
    notes?: string,
  }>;
}

// Response
{ draftId: string, createdAt, updatedAt }
```

Drafts are **owned by `user.sub`** — no cross-user access. Stored in Postgres `journey_drafts` table (see § "Schema additions"). Soft-deleted on `DELETE`.

### `GET /v1/journey-drafts`

Paginated list scoped to `user.sub`. Filters: `source` (`BUILD_FROM_SCRATCH | PUBLIC_PACKAGE | PRIVATE_PREBUILT`), `status` (`OPEN | EXPIRED | BOOKED | DISCARDED`).

### `GET /v1/journey-drafts/:draftId` / `DELETE /v1/journey-drafts/:draftId`

Standard ownership check (`403 DRAFT_NOT_AUTHOR`), `404 DRAFT_NOT_FOUND`.

### `POST /v1/trips/build-from-scratch/configurations`

Finalizes the customization into a `JourneyConfiguration` row.

```ts
// Request — same shape as journey-draft, plus
{
  sessionId: string;             // required — must match an active bfs_session
  draftId?: string;              // optional — if user was working from a saved draft
  // ... rest of the shape (days[], travelers, totalPriceUsd, etc.)
}

// Response
{
  configurationId: string,
  status: 'DRAFT',
  expiresAt: string,             // 1h from creation
  totalPriceUsd: number,
  itemBreakdown: { ... }
}
```

Validations run here (budget cap, travel-time, opening hours, group-size — see § "Validators"). On any failure, `400 BFS_VALIDATION_FAILED` with details.

### `POST /v1/availability/confirm`

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT |
| Idempotency-Key | Required |
| Response status | `200` on freeze, `409` on inventory drift |

```ts
// Request
{ configurationId: string }

// Response — success
{
  configurationId: string,
  status: 'CONFIRMED',
  expiresAt: string,             // 15 min TTL
  totalPriceUsd: number
}

// Response — drift (409)
{
  unavailable: Array<{
    type, resourceId, dayNumber, reason,
    alternatives: Array<{ resourceId, name, priceUsd, priceDeltaUsd }>
  }>
}
```

If at least one item drifted, the configuration **does not freeze**. Frontend shows alternatives; user accepts or goes back to edit. The `configurationId` remains valid for retries until its `expiresAt`.

### `POST /v1/bookings`

Unified atomic commit endpoint **shared with M1/M2** (per `booking-methods.md` § 5).

```ts
// Request
{ configurationId: string }

// Response
Booking (status: HOLD, reference: 'CSM-XXXXXX', items: BookingItem[N])
```

This endpoint lives in `bookings.controller.ts` (shared foundation), not in this module. M3's role ends at producing a `CONFIRMED` `JourneyConfiguration`. The unified commit endpoint reads the configuration, builds `CommitInput` with N `BookingItem` entries (one per leaf resource per day), and delegates to `commit-booking.use-case.ts`.

---

## Skeleton Generation

The generator is **deterministic, rule-based** — no AI/LLM. It must be fast (< 500 ms p95), reproducible (same input → same skeleton), and testable.

### Algorithm

Given the basics form input:

1. **Compute trip duration** — `durationDays = endDate - startDate + 1` (clamped to 1–30).
2. **Allocate days to destinations** — proportional to the user's `destinations` order, with a minimum of 1 day per destination. If `destinations.length > durationDays`, drop the lowest-priority ones (last in array).
3. **Pick a theme per day** based on `tripStyle`:
   - Day 1 of any destination = `"Arrival & Orientation"` if traveling from another destination, else `"Discovery"`
   - Last day = `"Farewell & Departure"` if it's the trip's last day
   - Middle days = themes from a hard-coded `theme_pool[tripStyle]` (e.g., `FAMILY` → `["Family Fun", "Cultural Immersion", "Nature Day", ...]`)
4. **Suggest activities per day** — query the `activities` catalog filtered by:
   - `destination` matches
   - `kidFriendly = true` if `children > 0`
   - `wheelchairAccessible = true` if `mobilityNeeds.includes('WHEELCHAIR')`
   - Sort by `ratingAverage DESC, ratingCount DESC`
   - Take top 3 (must include any from `mustSee` if they match the destination)
   - Respect time budget: ~6 hours of activity per day max
5. **Suggest hotel** — query `hotels` filtered by destination, `pricePerNightUsd ≤ (budgetUsd / durationDays / 2)`, then pick top-rated within the budget band. Stay at the same hotel for consecutive same-destination days.
6. **Suggest transport** — pick `PRIVATE_VAN` if `adults + children ≥ 4`, else `PRIVATE_CAR`. Inter-city day adds a `BUS` or `PRIVATE_VAN` line item with route distance.
7. **Compute estimated total** — sum of all suggestions + 10% buffer for guides and meals.

The skeleton output is a **suggestion object**, not a `JourneyConfiguration` row. It does not lock inventory.

### Determinism

Given identical input, the algorithm must return identical output. This is enforced by:
- Sorting catalog query results by `(rating, id)` to break ties consistently
- No random selection
- No timestamp-dependent logic (date math uses input dates only)

### Performance budget

- < 500 ms p95 for a typical 4-day, 2-destination trip
- The catalog queries are the bottleneck — each destination triggers up to 3 queries (activities, hotels, transport). Total ≤ ~15 queries per skeleton. Acceptable.

---

## Validators (run during `POST .../configurations`)

| # | Validator | Rule | Error code |
|---|-----------|------|------------|
| 1 | `BudgetCapValidator` | `sum(day.totalPriceUsd) ≤ budgetUsd` | `BFS_BUDGET_EXCEEDED` |
| 2 | `TravelTimeValidator` | Between consecutive activities on the same day, distance / 50 km/h ≤ gap between `activity.startTime` values | `BFS_TRAVEL_TIME_INVALID` |
| 3 | `OpeningHoursValidator` | Each activity's `startTime` falls within the venue's `openingHours[dayOfWeek]` | `BFS_OUTSIDE_OPENING_HOURS` |
| 4 | `GroupSizeValidator` | `transport.capacity ≥ adults + children`; `hotel.room.maxOccupancy ≥ adults + children` per night | `BFS_GROUP_TOO_LARGE` |
| 5 | `DestinationReachableValidator` | Between consecutive destinations (different cities on consecutive days), at least one transport option exists | `BFS_DESTINATION_UNREACHABLE` |
| 6 | `DurationValidator` | `endDate - startDate ≤ 30 days, ≥ 1 day` | `BFS_INVALID_DURATION` |
| 7 | `ActivityKidFriendlyValidator` | If `children > 0` and any activity is `kidFriendly = false`, warn (not blocking) | informational |
| 8 | `MealCoverageValidator` | At least one meal per day is included or marked self-arranged | informational |

Validators 1–6 are **gating** — `400 BFS_VALIDATION_FAILED` aggregates them with per-rule details. Validators 7–8 surface as warnings in the response but do not block.

---

## Schema additions

### `journey_drafts` table (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users, NOT NULL |
| `sessionId` | UUID | nullable, links back to bfs_session if applicable |
| `source` | enum | `BUILD_FROM_SCRATCH | PUBLIC_PACKAGE | PRIVATE_PREBUILT` |
| `title` | varchar(120) | user-supplied |
| `status` | enum | `OPEN | EXPIRED | BOOKED | DISCARDED` |
| `startDate` | date | |
| `endDate` | date | |
| `travelers` | jsonb | `{ adults, children, childrenAges }` |
| `budgetUsd` | decimal(10,2) | |
| `totalPriceUsd` | decimal(10,2) | snapshot |
| `days` | jsonb | full day-by-day structure |
| `createdAt` | timestamptz | |
| `updatedAt` | timestamptz | |
| `deletedAt` | timestamptz | nullable (soft delete) |
| `expiresAt` | timestamptz | 30 days from `updatedAt` (auto-cleanup) |

Indexes: `(userId, status, deletedAt)`, `(expiresAt)` for cleanup cron.

### `JourneyConfiguration` extensions (in `../journey-configurations/`)

This spec **adds** `source: 'BUILD_FROM_SCRATCH'` to the configuration's source enum. The base `JourneyConfiguration` model is owned by `journey-configurations/`.

### Redis keys

| Key | TTL | Purpose |
|-----|-----|---------|
| `bfs_session:{sessionId}` | 86 400 s (24h) | Cached basics + skeleton — survives page reloads |
| `availability_check:{hash}` | 120 s | Per-resource availability cache |
| `journey_config:{configurationId}:hold` | 900 s | After `availability/confirm` succeeds |

---

## Validation Errors (new)

| Code | HTTP | Trigger |
|------|------|---------|
| `BFS_INVALID_DURATION` | 400 | duration < 1 or > 30 days |
| `BFS_INVALID_BASICS` | 400 | DTO validation fails |
| `BFS_SESSION_NOT_FOUND` | 404 | Session expired or never existed |
| `BFS_BUDGET_EXCEEDED` | 400 | Configuration total > budget |
| `BFS_TRAVEL_TIME_INVALID` | 400 | Activities too far apart on same day |
| `BFS_OUTSIDE_OPENING_HOURS` | 400 | Activity scheduled outside venue hours |
| `BFS_GROUP_TOO_LARGE` | 400 | Transport or hotel can't fit group |
| `BFS_DESTINATION_UNREACHABLE` | 400 | No transport option between consecutive destinations |
| `BFS_VALIDATION_FAILED` | 400 | Aggregate wrapper (response includes per-rule failures) |
| `DRAFT_NOT_FOUND` | 404 | Draft missing or soft-deleted |
| `DRAFT_NOT_AUTHOR` | 403 | Cross-user draft access |
| `CONFIG_NOT_FOUND` | 404 | Configuration missing |
| `CONFIG_EXPIRED` | 410 | Configuration past `expiresAt` |
| `CONFIG_INVENTORY_DRIFT` | 409 | One or more items unavailable at confirm time |

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Skeleton generator is rule-based, not AI.** | Determinism + < 500 ms p95 + testability. AI-assisted skeleton is a Vibe Booking concern (Phase 9) that calls these endpoints as tools — not core M3. |
| 2 | **Session stored in Redis, not Postgres.** | Skeletons are throwaway — most users will customize within 30 minutes. Postgres `journey_drafts` is for explicit "save my work" intent, not auto-save. |
| 3 | **`bfs_session` TTL = 24h.** | Covers users who close the app and resume the next morning. Beyond 24h, regeneration is cheap — re-run the algorithm. |
| 4 | **Drafts stored in Postgres, soft-deleted, 30-day expiry.** | Users expect "saved drafts" to persist longer than a day. 30 days is the industry default. |
| 5 | **`POST /v1/availability/check` is shared with M1/M2 — owned by `journey-configurations/`.** | Single implementation, single cache. M3 just consumes. |
| 6 | **`JourneyConfiguration` has TWO statuses M3 cares about: DRAFT (1h TTL) and CONFIRMED (15 min TTL).** | DRAFT is a workspace; CONFIRMED is the inventory lock. Promotion is via `availability/confirm`. |
| 7 | **Validators run at config creation, not at availability/confirm.** | Catch errors as early as possible. `availability/confirm` only re-checks **inventory**, not business rules — those are stable once the configuration is saved. |
| 8 | **Reference prefix `CSM-`** (not `M3-` or `BFS-`). | Per `booking-methods.md` § 6 — `CSM` for "Custom" matches the user-facing terminology. |
| 9 | **No cross-day activity reordering at the API level.** | Frontend handles drag-and-drop within a day; the API receives the final ordered `activities[]`. Server validates time constraints on submission. |
| 10 | **Budget cap is enforced server-side at `configurations` POST, not at every `availability/check`.** | Frontend can show a running budget tracker (responsive UX) but the server is the source of truth at lock-in. |
| 11 | **`destinations` max = 5.** | Beyond 5 destinations in a 30-day trip, travel time eats more than activity time. Prevents pathological inputs. |
| 12 | **`mustSee` is advisory, not gating.** | If a must-see venue is closed on the trip dates or not in the chosen destinations, the skeleton omits it silently and surfaces a warning. Hard-rejecting would frustrate users. |
| 13 | **Children ages captured in basics, propagated to validators.** | Activity `kidFriendly` filtering uses children-present (boolean), but transport seats and pricing differentiate by age (e.g., car seats for under-5). |
| 14 | **Skeleton hotel persists across consecutive same-destination days.** | A user spending Day 1–3 in Siem Reap should stay at the same hotel by default. Manual override is per-day. |
| 15 | **Inter-city days have a "transit" line item.** | If Day 2 is in Siem Reap and Day 3 in Phnom Penh, Day 3 morning gets a `TRANSPORT` activity (bus/van/flight) as the first item. The user picks the mode. |
| 16 | **`availability/confirm` does NOT lock individual resources — only the `JourneyConfiguration`.** | The actual inventory lock happens at `POST /v1/bookings` (commit-booking). Confirm just freezes prices and inventory snapshot for 15 minutes. |
| 17 | **Reuses M4's atomic commit primitive verbatim.** | Per `booking-methods.md` § 4: only `commit-booking.use-case.ts` writes to `Booking`. M3's role is to produce a `CommitInput` with N items via the unified `POST /v1/bookings` endpoint. |
| 18 | **No journey sharing or public discovery in this branch.** | Phase 7. Spec mentions the post-trip flow for context but excludes implementation. |

---

## Use case skeleton (basics endpoint)

```ts
@Injectable()
export class SubmitBuildFromScratchBasicsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly skeletonGenerator: SkeletonGeneratorUtil,
  ) {}

  async execute(
    user: JwtPayload,
    dto: BuildFromScratchBasicsDto,
  ): Promise<{ sessionId: string; generatedSkeleton: GeneratedSkeleton }> {
    // 1. DTO validation already done by class-validator + ValidationPipe
    // 2. Generate skeleton (deterministic, ~15 catalog queries)
    const skeleton = await this.skeletonGenerator.generate(dto);

    // 3. Persist session in Redis (24h TTL)
    const sessionId = crypto.randomUUID();
    await this.redis.setex(
      `bfs_session:${sessionId}`,
      86_400,
      JSON.stringify({ userId: user.sub, basics: dto, skeleton }),
    );

    return { sessionId, generatedSkeleton: skeleton };
  }
}
```

---

## Dependencies

| Prerequisite | Status | Used for |
|--------------|--------|----------|
| `../shared-foundation/` | Required (must land first) | `commit-booking.use-case.ts`, hold/idempotency/refund utils, `BookingItem` schema |
| `../journey-configurations/` | Required (must land first) | `JourneyConfiguration` model, `availability/check` + `availability/confirm` endpoints |
| Phase 4 — catalog modules | 🟢 Complete | `Trip`, `Hotel`, `HotelRoom`, `TransportationVehicle`, `Guide`, `Activity` (if separate) |
| `ERROR-REGISTRY.md` update | This spec | All `BFS_*`, `DRAFT_*`, `CONFIG_*` codes |
| `EVENT-CATALOG.md` update | This spec | `journey_draft.created`, `configuration.created`, `configuration.confirmed` events (informational) |

---

## Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | **Skeleton query bursts on traffic spikes.** ~15 catalog queries per basics submission could overwhelm Postgres if many users hit "Build Your Own Trip" simultaneously. | Per-destination catalog query results cached in Redis (TTL 5 min). Skeleton generator reads from cache first, hits DB only on miss. |
| R2 | **Inventory drift between skeleton generation and configuration confirmation.** A user spends 20 min customizing; the suggested hotel sells out. | This is the **whole point** of `availability/confirm`. The drift is detected, alternatives surface, user re-customizes. Documented behaviour, not a bug. |
| R3 | **Determinism breaks if the catalog changes between calls.** Two identical basics submissions a day apart return different skeletons because the catalog has new rows. | Acceptable — determinism is **per-snapshot of the catalog**, not eternal. The session caches the skeleton for 24h, so within a session the skeleton is stable. |
| R4 | **Validators are slow.** Travel-time and opening-hours checks may need geocoding or external API calls. | MVP uses pre-computed `distanceKm` and `openingHours` columns on the catalog rows (added in Phase 4). No external API calls. Future enhancement: integrate Mapbox Matrix API. |
| R5 | **`JourneyConfiguration` row count grows unbounded.** Every user who confirms creates a row, even if they never book. | Cron in Phase 8 sweeps `JourneyConfiguration` where `status = CONFIRMED AND expiresAt < now()` → status `EXPIRED`. Hard-delete after 30 days. |
| R6 | **Group size validation is per-resource — same group splits across multiple vehicles is not handled.** A 12-person group needs 2 vans; the API treats them as one transport line. | Phase 5b enhancement: `transport.assignments[]` allowing N vehicles per day. MVP supports up to one vehicle per day, max capacity 20. |
| R7 | **Children ages affect pricing in real life (car seats, kid-pricing tiers).** MVP charges per-person same as M4d. | Same as M4d — defer to Phase 6 pricing tiers. Snapshot the children ages so refund math can adapt later. |

---

## NFR Targets

| Concern | Target | Notes |
|---------|--------|-------|
| Basics → skeleton latency | < 500 ms p95 | Cached catalog reads make this realistic |
| Availability check (cached) | < 100 ms p95 | Redis only |
| Availability confirm (fresh) | < 800 ms p95 | One DB query per resource |
| Configuration POST | < 1 s p95 | Includes all 6 gating validators |
| `POST /v1/bookings` (commit) | < 500 ms p95 | Inherits shared-foundation NFR |

---

## References

- Source workflow: `docs/workflows/customize-package/02-build-from-scratch.md`
- Method definition: `../booking-methods.md` § 1 (M3), § 5 (URL shape)
- Foundation: `../shared-foundation/requirements.md` *(to be drafted)*
- Configuration store: `../journey-configurations/requirements.md` *(to be drafted)*
- Sibling: `../specific-booking/` (M4 — completed pattern reference)
- Architecture: `docs/workflows/booking-transaction-methods.md` § "Method 3: Backend Orchestrated"
- `CONSTITUTION.md` § 9 — Booking & Payment Rules
- `SCHEMA.md` — `JourneyConfiguration` (to be added in Phase 5b)
