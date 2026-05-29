# Requirements: M2 — Private Package (Prebuilt + Customize / Book As-Is)

> **Method:** M2 (Multi-Resource — Private Prebuilt Package)
> **Source workflow:** `docs/workflows/customize-package/01-prebuilt-private-package.md`
> **Branch:** TBD (Phase 5b follow-up — NOT this branch)
> **Phase:** 5b — Private Package
> **Date:** 2026-05-25

This spec covers the **private tour template** flow: an admin creates a prebuilt private tour template (e.g., "Siem Reap Family 3-Day"), and a traveler either books it unchanged ("as-is") or fully customizes it (reorder, add, remove days; swap activities/hotels/transport/guides within the template's pools). M2 produces a `JourneyConfiguration` (shared with M1 and M3) and ultimately delegates to the same `commit-booking.use-case.ts` as M4.

> **Why M2 lands in 5b (not before M3):** M3 (build-from-scratch) is the broadest customization surface. Once M3's primitives — `JourneyConfiguration` model, `availability/check`/`confirm`, `journey-drafts`, line-item commit — work, M2 becomes a constrained subset: it starts from a template instead of a blank canvas, and its day-mutation surface is bounded by the template's pools. Building M3 first proves the foundation; M2 then plugs into it.

---

## Scope

### In scope (Phase 5b)

- **`POST /v1/private-packages/:tripId/configurations`** — finalize a customization (or accept defaults) into a `JourneyConfiguration` (status `DRAFT`). Single endpoint with `asIs: boolean` flag.
- **`GET /v1/private-packages/:tripId/template`** — fetch the pool-expanded template view (read-side helper for the customizer; `GET /v1/trips/:slug` returns the catalog summary, this returns the customization-ready template with all pools resolved).
- M2-specific validators: group-size bounds, kid-friendly warning, day-mutation rules, pool membership, template scope, per-group pricing reconciliation.
- `JourneyConfiguration` writes for `source: 'PRIVATE_PREBUILT'`.
- Reference prefix `PRV-` for committed bookings (per `../booking-methods.md` § 6).
- Error codes `PP_*` for all M2-specific failures.

### Out of scope (handled elsewhere)

- The `commit-booking` atomic primitive — `../shared-foundation/`
- `JourneyConfiguration` model + the `journey-configurations/` shared module — `../journey-configurations/` (Phase 5b prerequisite, lands first)
- `POST /v1/availability/check` — `../journey-configurations/`
- `POST /v1/availability/confirm` — `../journey-configurations/`
- `POST /v1/journey-drafts` and the journey-drafts CRUD surface — `../journey-configurations/` (shared by M1/M2/M3)
- `POST /v1/bookings` (unified commit) — `../shared-foundation/`
- M1 — public-package customize — `../public-package/` (Phase 5b sibling, separate spec)
- M3 — build-from-scratch — `../build-from-scratch/` (Phase 5c)
- M4 — single-resource quick-book — `../specific-booking/` (Phase 5a, complete)
- Admin CRUD for private tour templates (`POST /v1/admin/private-packages` and pool authoring tools) — `../admin-inventory/`
- `GET /v1/trips/:slug` and `GET /v1/trips?type=private` (catalog discovery) — Phase 4 trips module (already complete)
- Multi-package combined checkout (a single booking that spans two private packages) — Phase 5b+ enhancement (deferred)
- AI-assisted customization (Vibe Booking calls these endpoints as tools) — Phase 9
- Stripe payment integration — Phase 6
- Notification emails / push — Phase 8
- Journey sharing / public discovery of customized itineraries — Phase 7

---

## User Flow

```
Phase 1: Discovery (owned by trips module — out of scope here)
   GET /v1/trips?type=private&featured=true
   GET /v1/trips/:slug                  ← summary + journey_map.template_id

Phase 2: Path Choice
   ┌─ "Book This Package" (as-is) ──────────────────┐
   │                                                │
   └─ "Customize My Journey" ─┐                     │
                              │                     │
Phase 3a: Customize (frontend-driven)               │
   GET  /v1/private-packages/:tripId/template       │
   POST /v1/availability/check  (cached, on every change)
   POST /v1/journey-drafts      (save anytime — shared, owned by journey-configurations/)
   GET  /v1/journey-drafts      (resume later — shared)
                              │                     │
Phase 3b: Final Assembly      │                     │
   POST /v1/private-packages/:tripId/configurations
        body: { asIs: false, days[], travelers, startDate, ... }   (Customize path)
        body: { asIs: true,  travelers, startDate }                (As-is path)
   → returns JourneyConfiguration (DRAFT, source: 'PRIVATE_PREBUILT')

Phase 4: Confirmation Lock
   POST /v1/availability/confirm
   → JourneyConfiguration becomes CONFIRMED, 15-min TTL

Phase 5: Booking Commit
   POST /v1/bookings { configurationId }
   → shared-foundation's commit-booking writes Booking (PRV-XXXXXX) + N BookingItem rows
```

---

## Endpoints

### `GET /v1/private-packages/:tripId/template`

Returns the pool-expanded template — the journey map plus every pool resolved to full catalog rows so the frontend can render the customizer without a follow-up burst of `GET /v1/activities/:id`, `GET /v1/hotels/:id`, etc.

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT |
| Cache | CDN/edge-cacheable for ~5 min (template content rarely changes; pool rows are catalog reads) |
| Response status | `200` with the template, or `404 PP_TEMPLATE_NOT_FOUND` if `tripId` is invalid or `tripType !== 'PRIVATE'` |

#### Response

```ts
{
  templateId: string;
  tripId: string;
  slug: string;
  name: string;                            // e.g. "Siem Reap Family Private Tour - 3 Days"
  durationDays: number;
  basePriceUsd: number;                    // template's per-group price (used as as-is shortcut)
  priceType: 'PER_GROUP';                  // M2 is always per-group
  minGroupSize: number;
  maxGroupSize: number;
  isKidFriendly: boolean;
  includedItems: string[];
  excludedItems: string[];
  benefits: string[];
  cancellationPolicy: string;
  meetingPoint: { description, latitude, longitude };

  defaultJourneyMap: Array<{               // the as-is itinerary
    dayNumber: number;
    title: string;
    destination: string;
    defaultActivities: Array<ActivityRow>;
    defaultHotel: HotelRoomRow | null;
    defaultTransport: TransportRow | null;
    defaultGuide: GuideRow | null;
    mealsIncluded: ('BREAKFAST' | 'LUNCH' | 'DINNER')[];
  }>;

  pools: {                                 // pool-expanded catalog rows
    activities: Record<string /* dayNumber */, ActivityRow[]>;
    hotels: Record<string /* destination */, HotelRoomRow[]>;
    transport: Record<string /* dayNumber */, TransportRow[]>;
    guides: GuideRow[] | null;             // null = no pool, customer can pick any catalog guide for the destination
  };
}
```

This endpoint is **read-only**; it does not mutate state. Frontend uses the response to render the day-by-day customizer with swap dropdowns prefilled from `pools`.

### `POST /v1/private-packages/:tripId/configurations`

The single endpoint that finalizes either path (as-is or customized) into a `JourneyConfiguration` row.

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT |
| Idempotency-Key | Required (frontend generates per attempt; same key returns existing config) |
| Response status | `200` with `{ configurationId, status: 'DRAFT', expiresAt, totalPriceUsd, itemBreakdown }` |

#### Request — `FinalizePrivatePackageDto` (discriminated union on `asIs`)

```ts
// As-is path
{
  asIs: true;
  startDate: string;                   // ISO date, ≥ tomorrow
  travelers: {
    adults: number;
    children?: number;
    childrenAges?: number[];
  };
  draftId?: string;                    // optional — if user resumed a draft (rarely set on as-is)
}

// Customize path
{
  asIs: false;
  startDate: string;
  travelers: { adults, children?, childrenAges? };
  draftId?: string;                    // optional — if user was working from a saved draft
  days: Array<{
    dayNumber: number;                 // 1..N — sequential after reorder/add/remove
    date: string;                      // computed startDate + dayNumber - 1
    destination: string;
    title: string;                     // user-editable per day (defaults to template's day title)
    sourceDayNumber?: number;          // the template day this row was derived from (null = added day)
    activities: Array<{
      resourceId: string;              // must be in template.pools.activities[dayNumber] OR a sourceDay's pool
      startTime: string;               // HH:mm
      durationMin: number;
      priceUsd: number;                // unit price snapshot
    }>;
    hotel?: {
      hotelId: string;
      roomId: string;
      pricePerNightUsd: number;
    };
    transport?: {
      vehicleId: string;
      type: 'PRIVATE_VAN' | 'PRIVATE_CAR' | 'BUS' | 'TUKTUK' | 'TAXI';
      priceUsd: number;
    };
    guide?: {
      guideId: string;
      pricePerDayUsd: number;
    };
    mealsIncluded: ('BREAKFAST' | 'LUNCH' | 'DINNER')[];
    notes?: string;
  }>;
}
```

#### Response

```ts
{
  configurationId: string;
  status: 'DRAFT';
  source: 'PRIVATE_PREBUILT';
  expiresAt: string;                   // 1 h from creation
  templateId: string;                  // snapshot of which template was used
  templateBasePriceUsd: number;        // for refund/audit
  totalPriceUsd: number;               // recomputed server-side, sum of line items
  asIs: boolean;                       // echoed
  itemBreakdown: {
    activitiesUsd: number;
    hotelsUsd: number;
    transportUsd: number;
    guidesUsd: number;
    mealsUsd: number;
    daysAdded: number;
    daysRemoved: number;
  };
  warnings: Array<{ code: string; message: string; dayNumber?: number }>;  // non-blocking
}
```

Validators (see § "Validators") run here. On any **gating** failure: `400 PP_VALIDATION_FAILED` with aggregated `failures[]`.

---

## Validators (run during `POST .../configurations`)

| # | Validator | Path | Rule | Error code |
|---|-----------|------|------|------------|
| 1 | `GroupSizeBoundsValidator` | both | `template.minGroupSize ≤ adults + children ≤ template.maxGroupSize` | `PP_GROUP_SIZE_OUT_OF_BOUNDS` |
| 2 | `KidFriendlyValidator` | both | If `children > 0` and `template.isKidFriendly === false`, surface a warning. **Not gating** unless DTO sets `acknowledgeKidUnfriendly: false` (default true). | informational warning |
| 3 | `PoolMembershipValidator` | customize | Each `activities[].resourceId` must be in `template.pools.activities[sourceDayNumber || dayNumber]`. Each `guide.guideId` must be in `template.pools.guides` when that pool is non-null. | `PP_OUTSIDE_POOL` |
| 4 | `TemplateScopeValidator` | customize | `hotel.hotelId` and `transport.vehicleId` must serve `day.destination` (catalog-wide check, not pool-bound). | `PP_OUT_OF_DESTINATION_SCOPE` |
| 5 | `DayMutationValidator` | customize | Day numbers are sequential (1..N), no gaps, no duplicates. `daysAdded ≤ template.durationDays` (cap doubling). `daysRemoved ≤ template.durationDays - 1` (must keep at least one day). | `PP_DAY_MUTATION_INVALID` |
| 6 | `TravelTimeValidator` | customize | Within a single day, `(distance / 50 km/h) ≤ gap between consecutive `activity.startTime` values. Reuses M3's pre-computed `distanceKmTo[neighborId]`. | `PP_TRAVEL_TIME_INVALID` |
| 7 | `OpeningHoursValidator` | customize | Each activity's `startTime` falls within the venue's `openingHours[dayOfWeek]`. | `PP_OUTSIDE_OPENING_HOURS` |
| 8 | `GroupCapacityValidator` | both | `transport.capacity ≥ adults + children` per day; `hotel.room.maxOccupancy ≥ adults + children` per night. | `PP_GROUP_TOO_LARGE` |
| 9 | `DestinationReachableValidator` | customize | Between consecutive days with different destinations, at least one transport route exists in `transport_routes` (shared with M3). | `PP_DESTINATION_UNREACHABLE` |
| 10 | `PriceReconciliationValidator` | both | Server-computed `sum(line items)` matches `± 1¢` of the client-supplied `totalPriceUsd`. Mismatch → reject (catches stale-price client). | `PP_PRICE_MISMATCH` |
| 11 | `MealCoverageValidator` | both | At least one meal per day is included or marked self-arranged. Informational warning, not gating. | informational warning |
| 12 | `MinimumActivityValidator` | customize | Every day has ≥ 1 activity OR is explicitly flagged `restDay: true`. Prevents empty-day shells. | `PP_DAY_EMPTY` |

Validators 1, 3–10, 12 are **gating** — `400 PP_VALIDATION_FAILED` aggregates failures. Validators 2, 11 surface in `warnings[]`.

For **as-is** path: only validators 1, 2, 8, 10, 11 run (no day mutations, no pool swaps to check). All others are no-ops by definition.

---

## Schema additions

This spec adds **no new tables**. It extends two enums owned by `../journey-configurations/`:

### `JourneyConfigurationSource` enum (extension)

Adds `'PRIVATE_PREBUILT'` to the existing source enum. Other values: `BUILD_FROM_SCRATCH`, `PUBLIC_PACKAGE`.

### `JourneyConfiguration` extensions

The existing `JourneyConfiguration` model carries the customized journey. M2 sets:

| Column | M2 value |
|--------|----------|
| `source` | `'PRIVATE_PREBUILT'` |
| `templateId` | the `Trip.id` of the private template (FK) |
| `templateBasePriceUsd` | snapshot of `Trip.priceUsd` at config time (per-group base) |
| `asIs` | `true` if the user took the as-is path |
| `daysSnapshot` | `JSONB` — full `days[]` (for as-is, materialized from template defaults) |

`templateId`, `templateBasePriceUsd`, and `asIs` are **new columns** added to the `JourneyConfiguration` model when M2 lands. They are nullable for non-template-driven sources (e.g., M3 which has no template).

### Booking model (no new fields beyond what `../shared-foundation/` already adds)

`Booking.method = 'PRIVATE_PREBUILT'`, `Booking.configurationId = <the config>`, `Booking.singleResourceKind = null`. Reference prefix `PRV-`.

### Redis keys

| Key | TTL | Purpose | Owner |
|-----|-----|---------|-------|
| `availability_check:{hash}` | 120 s | Per-resource availability cache | `journey-configurations/` (shared) |
| `journey_config:{configurationId}:hold` | 900 s | Set after `availability/confirm` succeeds | `journey-configurations/` (shared) |
| `pp_template:{tripId}` | 300 s | Pool-expanded template cache (catalog reads are slow under traffic) | `private-package/` (this spec) |

**No new session-style keys.** M2 does not need a server-side intermediate between template fetch and configuration POST — see Decision #6.

---

## Validation Errors (new)

| Code | HTTP | Trigger |
|------|------|---------|
| `PP_TEMPLATE_NOT_FOUND` | 404 | `:tripId` is invalid, soft-deleted, or `tripType !== 'PRIVATE'` |
| `PP_GROUP_SIZE_OUT_OF_BOUNDS` | 400 | `adults + children` outside `[minGroupSize, maxGroupSize]` |
| `PP_OUTSIDE_POOL` | 400 | Activity or guide id not in the template's pool |
| `PP_OUT_OF_DESTINATION_SCOPE` | 400 | Hotel or transport doesn't serve the day's destination |
| `PP_DAY_MUTATION_INVALID` | 400 | Day numbers non-sequential / cap exceeded / all days removed |
| `PP_DAY_EMPTY` | 400 | A day has zero activities and is not marked `restDay: true` |
| `PP_TRAVEL_TIME_INVALID` | 400 | Activities scheduled too close given inter-venue distance |
| `PP_OUTSIDE_OPENING_HOURS` | 400 | Activity scheduled outside venue hours |
| `PP_GROUP_TOO_LARGE` | 400 | Transport or hotel can't fit the group |
| `PP_DESTINATION_UNREACHABLE` | 400 | No transport option between consecutive destinations |
| `PP_PRICE_MISMATCH` | 400 | Client-supplied total disagrees with server-computed sum |
| `PP_VALIDATION_FAILED` | 400 | Aggregate wrapper (response includes `failures[]`) |
| `PP_TEMPLATE_INACTIVE` | 409 | Template was deactivated/soft-deleted between fetch and POST |
| `CONFIG_NOT_FOUND` | 404 | (shared) Configuration missing |
| `CONFIG_EXPIRED` | 410 | (shared) Configuration past `expiresAt` |
| `CONFIG_INVENTORY_DRIFT` | 409 | (shared) One or more items unavailable at confirm time |

All `PP_*` codes are added to `backend/context/specs/ERROR-REGISTRY.md`.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Single endpoint for both as-is and customize paths**, distinguished by `asIs: boolean` flag in the DTO. | Both paths produce the same `JourneyConfiguration` shape; one endpoint, one controller method, one set of integration tests. The DTO is a discriminated union (`@ValidateIf(asIs === false)` for `days[]`). Alternative considered: separate endpoints per path — rejected because it duplicates controller wiring and makes the unified `POST /v1/bookings` consumer think there are two M2 origins when there's really only one. |
| 2 | **Final-state submission, not operations log.** Frontend sends the full `days[]` after customization; server validates the result, doesn't replay user actions. | Replay-style APIs make small frontend bugs into silent server-side wrong bookings — exactly what the configuration store exists to prevent. Audit trail can be reconstructed from `daysSnapshot` vs. `template.defaultJourneyMap` if needed (future enhancement). |
| 3 | **Pool boundary is tiered, not uniform.** Activities and guides (when a guide pool is defined) are strictly pool-bound; hotels and transport are catalog-wide within the day's destination. | Activities define what "Family Tour" *is*. Locking them to the pool preserves the template's promise. Hotels and transport are commodities — customers want their preferred chain or vehicle type without admins curating an exhaustive list. Guides split the difference: when the admin specifies a pool (e.g., language requirements), respect it; otherwise let the customer pick any catalog guide for the destination. |
| 4 | **Pricing is sum-from-line-items, not base + delta.** Server discards `template.basePriceUsd` after fetch and computes `totalPriceUsd` from the final `days[]`. Template base is snapshotted in `JourneyConfiguration.templateBasePriceUsd` for audit. | Consistency with M3 (which has no base price) means the same `commit-booking` line-item logic and the same refund math (`compute-refund.util.ts`) work unchanged. The marketing concern ("$450 fixed") is solved by keeping template prices in sync via a recurring catalog job, not by forking the pricing model. |
| 5 | **For the as-is path, server materializes `days[]` from template defaults — client does not send `days[]`.** | Smaller payload, no risk of client materialization drift. Server is the single source of truth for what "as-is" means. If the template changes mid-customization (rare; soft-deletes blocked by FK), the as-is config still reflects the version snapshotted at POST time. |
| 6 | **No server-side session.** M2 has no equivalent of M3's `bfs_session` Redis key. The template is the skeleton, served via `GET /v1/private-packages/:tripId/template` (cacheable). Customization-in-progress lives in the frontend (or in `POST /v1/journey-drafts` if the user explicitly saves). | M3's session exists because the skeleton is generator output that's expensive to recompute. M2's "skeleton" is the template, which is already cacheable and stable. Adding a session is pure cost (Redis pressure on traffic spikes) for no benefit. |
| 7 | **Reference prefix `PRV-`** (not `M2-` or `PP-`). | Per `../booking-methods.md` § 6 — `PRV` matches the user-facing terminology ("Private Tour"). Customer support routing uses the prefix. |
| 8 | **`templateId` is captured on the configuration but the template is NOT frozen at confirmation time.** Pool changes by the admin between config creation and booking commit are not applied retroactively. | Customers customize against a snapshot. If the admin removes an activity from the pool while a customer is mid-flow, the customer's existing customization stands until the configuration expires (1h DRAFT, 15 min CONFIRMED). New customizations get the new pool. This is a benign trade — the catalog reads happen at customization time, not commit time. |
| 9 | **`KidFriendly` is advisory by default, blocking on opt-in.** Workflow doc says "user can still proceed with acknowledgment" — implemented as a warning unless the DTO explicitly sets `acknowledgeKidUnfriendly: false`. | Matches the workflow doc's "warns when children are in traveler count, user can proceed." A hard block frustrates customers booking grandparents-with-grandchildren mixed groups. Frontend is expected to surface the warning prominently. |
| 10 | **Day-mutation cap: cannot more than double the trip; cannot remove all days.** Concretely: `daysAdded ≤ template.durationDays`, `daysRemoved ≤ template.durationDays - 1`. | Prevents pathological inputs ("3-day template + 27 added days = 30-day trip" — that's M3's job). Customers wanting major restructuring should use M3 from scratch. |
| 11 | **Customers cannot add a day pulling activities from a pool that doesn't exist for that day yet.** When a user adds Day 4 to a 3-day template, the activities pool for Day 4 is empty unless the customer specifies an explicit destination — at which point the customizer falls back to `GET /v1/activities?destination=...` (catalog-wide). The added day's activities pass `PoolMembershipValidator` because there's no pool to be outside of. | Aligns with the workflow doc's "Add Day, picks location/theme. Populates suggested activities for new day." Avoids forcing admins to author "what if the customer adds an extra day" pools — that doesn't scale. |
| 12 | **Per-group pricing is reflected in the configuration, but per-line-item totals are still computed.** `totalPriceUsd = sum(activities + hotel-nights + transport-days + guide-days)`. The "per-group" aspect is purely a marketing/display concept — the engine is per-line. | Enables refund granularity (e.g., refund the unused last day if the trip ends early). Per-group black-box pricing makes refunds impossible to reason about. |
| 13 | **`PriceReconciliationValidator` is hard-fail.** If client total disagrees with server total by > 1¢, reject with `PP_PRICE_MISMATCH`. | Catches stale-price clients (cached pages, out-of-date catalog reads). The client sees "your prices changed; please re-customize" rather than a silent server-side correction at commit time. The 1¢ tolerance absorbs floating-point rounding. |
| 14 | **Drafts are shared infrastructure (`POST /v1/journey-drafts` lives in `journey-configurations/`).** M2 sets `source: 'PRIVATE_PREBUILT'` on draft creation but doesn't own the endpoint. | One drafts table for all three multi-resource methods (M1/M2/M3). Cross-method draft listing ("show me all my saved trips") works out of the box. |
| 15 | **No `PATCH /v1/private-packages/.../configurations/:id` for editing.** A configuration is immutable once created; if the user wants to change something they create a new configuration. | Matches M3's behaviour. Mutating a configuration mid-life invalidates the price snapshot, the `availability/confirm` lock, and the audit trail. Cheap to recreate; expensive to mutate. |
| 16 | **`GET /v1/private-packages/:tripId/template` is a separate endpoint from `GET /v1/trips/:slug`.** The trips endpoint returns marketing-shape data (covers, ratings, descriptions); this returns customizer-shape data (pool-expanded, dropdown-ready). | Separates concerns: marketing pages don't pay the cost of resolving every pool row, and the customizer doesn't pay the cost of fetching review summaries. |
| 17 | **Reuses M3/M4's atomic commit primitive verbatim.** Per `../booking-methods.md` § 4: only `commit-booking.use-case.ts` writes to `Booking`. M2's role ends at producing a `CONFIRMED` `JourneyConfiguration`. | Same boundary rule as every other method module. No per-method copy of overlap, hold, or refund logic. |
| 18 | **`asIs` is recorded on the booking event payload.** `booking.created` includes `method: 'PRIVATE_PREBUILT', asIs: boolean`. | Analytics can tell us how many private bookings are as-is vs customized — important product signal for whether to invest more in pool authoring tooling. |

---

## Use case skeleton (configurations endpoint)

```ts
@Injectable()
export class FinalizePrivatePackageConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly templateLoader: PrivatePackageTemplateLoader,
    private readonly validators: PrivatePackageValidators,
    private readonly journeyConfigurations: JourneyConfigurationsService,
  ) {}

  async execute(
    user: JwtPayload,
    tripId: string,
    dto: FinalizePrivatePackageDto,
    idempotencyKey: string,
  ): Promise<FinalizePrivatePackageResponse> {
    // 1. Idempotency check — if same key + user + tripId, return existing config
    const existing = await this.checkIdempotency(user.sub, tripId, idempotencyKey);
    if (existing) return existing;

    // 2. Load template (Redis cache, 5 min TTL); 404 if not found, 409 if inactive
    const template = await this.templateLoader.load(tripId);

    // 3. If asIs, materialize days[] from template defaults
    const days = dto.asIs
      ? this.templateLoader.materializeDefaults(template, dto.startDate, dto.travelers)
      : dto.days;

    // 4. Run validators (different sets for asIs vs customize per § Validators)
    const result = await this.validators.runAll({
      template,
      asIs: dto.asIs,
      days,
      travelers: dto.travelers,
      clientTotalPriceUsd: dto.totalPriceUsd ?? null,
    });
    if (result.failures.length > 0) {
      throw new BadRequestException({
        code: 'PP_VALIDATION_FAILED',
        failures: result.failures,
      });
    }

    // 5. Persist via journey-configurations/ service (transactional)
    const config = await this.journeyConfigurations.create({
      userId: user.sub,
      source: 'PRIVATE_PREBUILT',
      templateId: template.tripId,
      templateBasePriceUsd: template.basePriceUsd,
      asIs: dto.asIs,
      startDate: dto.startDate,
      endDate: this.computeEndDate(dto.startDate, days.length),
      travelers: dto.travelers,
      totalPriceUsd: result.computedTotalUsd,
      daysSnapshot: days,
      draftId: dto.draftId ?? null,
    });

    // 6. Save idempotency record (24 h)
    await this.saveIdempotency(user.sub, tripId, idempotencyKey, config.id);

    return {
      configurationId: config.id,
      status: 'DRAFT',
      source: 'PRIVATE_PREBUILT',
      expiresAt: config.expiresAt,
      templateId: template.tripId,
      templateBasePriceUsd: template.basePriceUsd,
      totalPriceUsd: result.computedTotalUsd,
      asIs: dto.asIs,
      itemBreakdown: result.itemBreakdown,
      warnings: result.warnings,
    };
  }
}
```

---

## Dependencies

| Prerequisite | Status | Used for |
|--------------|--------|----------|
| `../shared-foundation/` | Required (must land first) | `commit-booking.use-case.ts`, `BookingItem` schema, hold/idempotency/refund utils, reference generator with `PRV-` prefix |
| `../journey-configurations/` | Required (must land first) | `JourneyConfiguration` model, `availability/check` + `availability/confirm` endpoints, `journey-drafts` CRUD |
| `../build-from-scratch/` | Required (must land first) | `transport_routes` lookup table (used by `DestinationReachableValidator`); `distanceKmTo[neighborId]` columns on activity rows (used by `TravelTimeValidator`) — both are added in M3's migration |
| Phase 4 — catalog modules | 🟢 Complete | `Trip` (with `tripType: 'PRIVATE'`), `Hotel`, `HotelRoom`, `TransportationVehicle`, `Guide`, `Activity` |
| Phase 4 — private package template authoring | 🟢 Complete (admin CRUD) | Templates exist with `min_group_size`, `max_group_size`, `is_kid_friendly`, `journey_map`, and pools authored |
| `ERROR-REGISTRY.md` update | This spec | All `PP_*` codes |
| `EVENT-CATALOG.md` update | This spec | `booking.created` payload — add `'PRIVATE_PREBUILT'` to `method` enum, add `asIs: boolean` field |
| `API-CONTRACT.md` update | This spec | New `§ M2 Private Package` section |

---

## Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | **Pool-expanded template payload is large.** A 7-day private tour with 10 activities/day in pool, 5 hotels/destination, 3 transport/day — the response can hit ~150 KB. | Cache the pool-expanded view in Redis (`pp_template:{tripId}`, TTL 300 s). Frontend loads once per session. Beyond that, paginate the largest pool (activities) or lazy-load via `GET /v1/activities?inPool=...&dayNumber=...` (Phase 5b+ optimization). |
| R2 | **Client/server price drift between customize and confirm.** A customer customizes for 20 min; a hotel changes its `pricePerNightUsd`. `PriceReconciliationValidator` rejects on POST. | This is the intended behaviour — surface "prices changed" with the new totals; user accepts and re-submits. The 1¢ tolerance covers float rounding only. Document this UX in the workflow guide. |
| R3 | **Inventory drift between configuration creation and `availability/confirm`.** Same as M3 (R2). | Documented behaviour of `availability/confirm`. Alternatives surfaced; user re-customizes. Not a defect. |
| R4 | **Pool membership check needs the template at validation time, but the template is mutable (admin can edit pools).** | `PrivatePackageTemplateLoader` reads the template snapshot once and passes it to all validators in the same request. Pool changes mid-request are impossible. Pool changes between requests are accepted — the new request gets the new pool. |
| R5 | **`PP_OUTSIDE_POOL` is a frequent error during testing because frontend devs forget to map pool ids correctly.** | DTO includes optional `_debugPoolMatchHint` (stripped in production via `class-transformer.@Exclude()`) to log which pool was checked against. Improve error message to include the failing `resourceId` and the day's expected pool ids. |
| R6 | **Day-mutation interaction with `availability/check` cache.** A user reorders Day 1 ↔ Day 2; the cached availability for the old order is stale. | `availability/check` cache key is `(resourceId, startDate, endDate, quantity)`, not `dayNumber`. Cache stays valid; frontend just re-queries with new dates after reorder. |
| R7 | **As-is path bypasses customization but still inherits the validators (group size, group capacity, price reconciliation).** What if a template was authored with `min_group_size: 4` but a couple wants to book it as-is for two? | Documented as-is constraint: as-is fails fast with `PP_GROUP_SIZE_OUT_OF_BOUNDS`. Frontend should disable the "Book This Package" button when traveler count is out of bounds, but the server enforces it as defense-in-depth. |
| R8 | **`templateId` snapshotted but not frozen — admin deactivates the template after configuration creation.** Customer's CONFIRMED config still works (FK still resolves). But `availability/confirm` would re-read the template and potentially fail. | `availability/confirm` reads inventory from `BookingItem`-equivalent leaf rows (hotels, transport, etc.), not from the template. Template deactivation is a soft-delete (`deletedAt`); the FK remains valid. New configurations against a deactivated template fail with `PP_TEMPLATE_INACTIVE` (409). |
| R9 | **Migration risk — adding `templateId`, `templateBasePriceUsd`, `asIs` columns to `JourneyConfiguration`.** Tables are small early on (low row count), so migration is fast — but order matters when `journey-configurations/` ships first. | These columns are added in M2's migration (`add_private_package_columns_to_journey_configurations`), not in M3's. They're nullable, default null, no backfill needed. M3 rows have all three set to null. |
| R10 | **Per-group pricing on the booking confirmation email.** Customer sees `totalPriceUsd: 487.50` but the marketing said "$450 fixed". | Email template shows both the template base and the customization delta: "Base price: $450 + Customizations: $37.50 = Total: $487.50". Implementation lives in Phase 8 notifications. This spec just produces the data; the email layer formats it. |

---

## NFR Targets

| Concern | Target | Notes |
|---------|--------|-------|
| `GET /v1/private-packages/:tripId/template` (cached) | < 80 ms p95 | Redis-served |
| `GET /v1/private-packages/:tripId/template` (cold) | < 600 ms p95 | ~10–20 catalog reads to expand pools |
| `POST /v1/private-packages/:tripId/configurations` (as-is) | < 400 ms p95 | Materialize defaults + validators 1, 8, 10 |
| `POST /v1/private-packages/:tripId/configurations` (customize) | < 800 ms p95 | All 12 validators, including travel-time and opening-hours |
| `POST /v1/availability/confirm` (M2 source) | < 800 ms p95 | Inherits `journey-configurations/` NFR |
| `POST /v1/bookings { configurationId }` (commit) | < 500 ms p95 | Inherits `shared-foundation/` NFR |

---

## References

- Source workflow: `docs/workflows/customize-package/01-prebuilt-private-package.md`
- Companion workflow: `docs/workflows/customize-package/flow.md`
- Method definition: `../booking-methods.md` § 1 (M2), § 4 (module structure), § 5 (URL shape), § 6 (reference prefix `PRV-`)
- Foundation: `../shared-foundation/requirements.md` *(to be drafted in Phase 5b)*
- Configuration store: `../journey-configurations/requirements.md` *(to be drafted in Phase 5b)*
- Sibling: `../public-package/` (M1 — to be drafted; reuses much of this spec's machinery)
- Sibling: `../build-from-scratch/requirements.md` (M3 — pattern reference)
- Sibling: `../specific-booking/` (M4 — completed pattern reference)
- Architecture: `docs/workflows/booking-transaction-methods.md` § "Method 3: Backend Orchestrated"
- `CONSTITUTION.md` § 9 — Booking & Payment Rules
- `SCHEMA.md` — `JourneyConfiguration` (extended in this phase with `templateId`, `templateBasePriceUsd`, `asIs`)
