# Plan: M3 — Build From Scratch

> **Method:** M3
> **Branch:** TBD (Phase 5c follow-up branch — NOT this branch)
> **Phase:** 5c — Build From Scratch
> **Status:** 🟡 Spec drafted, implementation not started
> **Prerequisites:**
>   - `../shared-foundation/` 🟢 Complete (commit-booking primitive, hold key, idempotency)
>   - `../journey-configurations/` 🟢 Complete (`JourneyConfiguration` model, `availability/check`, `availability/confirm`)

This plan implements M3 only. It assumes both prerequisites are landed. M1 and M2 (Phase 5b) reuse the same `JourneyConfiguration` and `availability/*` infrastructure — they are subsets of M3's customization surface and should be plug-and-play once M3 is proven.

---

## Sequential implementation rule

**Implement one group at a time.** Per-group gates must pass before the next group begins. Same gate template as `../specific-booking/transportation/plan.md`:

| # | Check | Command |
|---|-------|---------|
| 1 | Lint | `npm run lint` — zero errors / warnings |
| 2 | Build | `npm run build` succeeds |
| 3 | Type-check | `npx tsc --noEmit` — zero errors |
| 4 | Unit tests | `npm test -- src/modules/build-from-scratch` — relevant specs pass |
| 5 | Smoke | `validation.md` curl commands for this group succeed |
| 6 | Tracker | `PROGRESS-TRACKER.md` row updated |
| 7 | Stop & confirm | Pause for review before next group |

---

## Module structure

```
src/modules/build-from-scratch/
  build-from-scratch.module.ts
  build-from-scratch.controller.ts
  dto/
    build-from-scratch-basics.dto.ts
    finalize-configuration.dto.ts
    create-journey-draft.dto.ts
    list-drafts-query.dto.ts
    index.ts
  use-cases/
    submit-basics.use-case.ts                 ⭐ Group 2
    get-session.use-case.ts                   ⭐ Group 2
    finalize-configuration.use-case.ts        ⭐ Group 4
    create-draft.use-case.ts                  ⭐ Group 5
    list-drafts.use-case.ts                   ⭐ Group 5
    get-draft.use-case.ts                     ⭐ Group 5
    delete-draft.use-case.ts                  ⭐ Group 5
    index.ts
  utils/
    skeleton-generator.util.ts                ⭐ Group 1 (largest pure module)
    skeleton-generator.util.spec.ts           ⭐ Group 1 — critical-path test
    catalog-cache.util.ts                     ⭐ Group 1 — Redis cache for catalog reads
    theme-pool.util.ts                        ⭐ Group 1 — pure (theme_pool[tripStyle])
    index.ts
  validators/
    budget-cap.validator.ts                   ⭐ Group 3
    travel-time.validator.ts                  ⭐ Group 3
    opening-hours.validator.ts                ⭐ Group 3
    group-size.validator.ts                   ⭐ Group 3
    destination-reachable.validator.ts        ⭐ Group 3
    duration.validator.ts                     ⭐ Group 3
    index.ts
  interfaces/
    generated-skeleton.interface.ts
    bfs-session.interface.ts
    journey-draft.interface.ts
    validation-result.interface.ts
    index.ts
```

---

## Group 1 — Skeleton generator (foundation)

> **Goal:** A pure deterministic generator that takes basics and returns a skeleton. This is the largest pure-logic module in M3 — get it right before anything else.

| # | File | Action |
|---|------|--------|
| 1.1 | `utils/theme-pool.util.ts` | Create — hard-coded `THEME_POOL: Record<TripStyle, string[]>`. |
| 1.2 | `utils/catalog-cache.util.ts` | Create — `@Injectable()`. `getActivities(destination, filters)`, `getHotels(...)`, `getTransport(...)`. Reads Redis first (TTL 300 s), falls back to PrismaService. |
| 1.3 | `utils/skeleton-generator.util.ts` | Create — `@Injectable()`. Single public method `generate(basics): GeneratedSkeleton`. Implements the 7-step algorithm in `requirements.md` § "Skeleton Generation". |
| 1.4 | `utils/skeleton-generator.util.spec.ts` | Create — **critical-path test**. Cases:<br>(a) deterministic: same input → same output (run twice, deep-equal)<br>(b) destinations clamped to durationDays when `destinations.length > durationDays`<br>(c) `kidFriendly` filter applied when `children > 0`<br>(d) hotel persists across consecutive same-destination days<br>(e) inter-city day adds a transport line item<br>(f) budget tracking — `estimatedTotalUsd ≤ budgetUsd × 1.1` (10% buffer cap) |
| 1.5 | `interfaces/generated-skeleton.interface.ts` | Create — full type for the response shape. |
| 1.6 | `utils/index.ts`, `interfaces/index.ts` | Create barrels |

### Per-group gate

1. Lint / build / type-check clean
2. `npm test -- src/modules/build-from-scratch/utils/skeleton-generator.util.spec.ts` passes
3. Manual smoke (one-shot ts-node script): construct a basics input, call `generator.generate(...)`, verify output shape matches the interface
4. **Stop here.**

---

## Group 2 — Basics endpoint (Phase 1 of user flow)

> **Goal:** `POST /v1/trips/build-from-scratch/basics` works end-to-end. Skeleton returned + session persisted in Redis.

| # | File | Action |
|---|------|--------|
| 2.1 | `dto/build-from-scratch-basics.dto.ts` | Create — class-validator rules per `requirements.md` § DTO. Nested `TravelersDto`. |
| 2.2 | `use-cases/submit-basics.use-case.ts` | Create — see skeleton in `requirements.md`. |
| 2.3 | `use-cases/get-session.use-case.ts` | Create — `execute(user, sessionId)`. Reads `bfs_session:{sessionId}`. `403 BFS_SESSION_NOT_AUTHOR` if `userId` mismatch. `404 BFS_SESSION_NOT_FOUND` if expired. |
| 2.4 | `interfaces/bfs-session.interface.ts` | Create |
| 2.5 | `build-from-scratch.controller.ts` | Create — `@Controller('trips/build-from-scratch')`. Routes:<br>`@Post('basics')`<br>`@Get('sessions/:sessionId')` |
| 2.6 | `build-from-scratch.module.ts` | Create — register the use cases + utils + validators (validators not used yet but module is set up). |
| 2.7 | `src/app.module.ts` | Modify — import `BuildFromScratchModule`. |

### Per-group gate

1. Lint / build / type-check clean
2. `POST /v1/trips/build-from-scratch/basics` returns `200` with `{ sessionId, generatedSkeleton }`
3. `GET /v1/trips/build-from-scratch/sessions/:sessionId` returns the cached skeleton
4. `redis-cli TTL bfs_session:<id>` returns ~86400
5. `redis-cli GET bfs_session:<id>` shows persisted JSON
6. **Stop here.**

---

## Group 3 — Validators (pure, testable)

> **Goal:** All 6 gating validators implemented as pure functions. Tested independently. Used by Group 4.

| # | File | Action |
|---|------|--------|
| 3.1 | `validators/duration.validator.ts` | Create — `validate(startDate, endDate): ValidationResult`. Returns `{ valid: true }` or `{ valid: false, code: 'BFS_INVALID_DURATION', message }`. |
| 3.2 | `validators/budget-cap.validator.ts` | Create — `validate(days, budgetUsd): ValidationResult`. Sums `day.totalPriceUsd`. |
| 3.3 | `validators/travel-time.validator.ts` | Create — `validate(day): ValidationResult`. Iterates pairs of consecutive activities, checks `(distance / 50 km/h) ≤ (next.startTime - prev.endTime)`. Uses pre-computed `distanceKmTo[neighborId]` on activity rows (Phase 4 added them). |
| 3.4 | `validators/opening-hours.validator.ts` | Create — `validate(day, dayOfWeek): ValidationResult`. Checks `activity.startTime` against venue's `openingHours[dayOfWeek]`. |
| 3.5 | `validators/group-size.validator.ts` | Create — `validate(travelers, day): ValidationResult`. Checks transport capacity + hotel maxOccupancy. |
| 3.6 | `validators/destination-reachable.validator.ts` | Create — `validate(days): ValidationResult`. For consecutive days with different destinations, ensures at least one transport route exists in the `transport_routes` lookup table. |
| 3.7 | `interfaces/validation-result.interface.ts` | Create — `{ valid: boolean, code?, message?, dayNumber?, activityId? }`. |
| 3.8 | `validators/index.ts` | Create barrel — exports a `runAllValidators(input)` aggregator helper. |
| 3.9 | `validators/*.spec.ts` (one per validator) | Create — pure-function tests. Boundary cases: exact-match capacity, zero-duration travel time, midnight opening hours wrap, etc. |

### Per-group gate

1. Lint / build / type-check clean
2. `npm test -- src/modules/build-from-scratch/validators` — all 6 spec files pass
3. **Stop here.**

---

## Group 4 — Configuration finalization (Phase 3 of user flow)

> **Goal:** `POST /v1/trips/build-from-scratch/configurations` writes a `JourneyConfiguration` row (DRAFT status, 1h TTL).

| # | File | Action |
|---|------|--------|
| 4.1 | `dto/finalize-configuration.dto.ts` | Create — full days[] structure, `sessionId`, optional `draftId`. |
| 4.2 | `use-cases/finalize-configuration.use-case.ts` | Create. Steps:<br>1. Verify session exists + belongs to user<br>2. Run `runAllValidators(input)` — aggregate failures into `400 BFS_VALIDATION_FAILED` with detailed `failures[]`<br>3. Inside `prisma.$transaction`:<br>&nbsp;&nbsp;a. Insert `JourneyConfiguration` row with `source: 'BUILD_FROM_SCRATCH', status: 'DRAFT', expiresAt: now() + 1h`<br>&nbsp;&nbsp;b. Insert per-day breakdown into related tables (per `journey-configurations/` schema)<br>4. If `draftId` provided, mark draft `status: BOOKED` (best-effort, not gating)<br>5. Return `{ configurationId, status: 'DRAFT', expiresAt, totalPriceUsd, itemBreakdown }` |
| 4.3 | `build-from-scratch.controller.ts` | Modify — add `@Post('configurations')` handler |
| 4.4 | `build-from-scratch.module.ts` | Modify — register `FinalizeConfigurationUseCase`. Import `JourneyConfigurationsModule` for the persistence side. |

### Per-group gate

1. Lint / build / type-check clean
2. Smoke: full happy path → `200` with configurationId
3. Smoke: budget exceeded → `400 BFS_VALIDATION_FAILED` with `failures: [{ code: 'BFS_BUDGET_EXCEEDED', ... }]`
4. Smoke: travel time invalid → same shape with `BFS_TRAVEL_TIME_INVALID`
5. Postgres: `SELECT * FROM journey_configurations WHERE source = 'BUILD_FROM_SCRATCH'` shows the new row
6. **Stop here.**

---

## Group 5 — Journey drafts (Phase 2 support)

> **Goal:** Save / list / load / delete drafts. Used by frontend "save and continue later."

| # | File | Action |
|---|------|--------|
| 5.1 | `dto/create-journey-draft.dto.ts` | Create — same shape as the configuration DTO but no validators run. |
| 5.2 | `dto/list-drafts-query.dto.ts` | Create — extends `PageQueryDto`. Optional `status?`, `source?`. |
| 5.3 | `use-cases/create-draft.use-case.ts` | Create. Inserts `journey_drafts` row scoped to `user.sub`. Auto-sets `expiresAt = now() + 30 days`. Idempotency-Key honored — same key returns existing row. |
| 5.4 | `use-cases/list-drafts.use-case.ts` | Create. `findMany` paginated, scoped to `user.sub, deletedAt: null`, default sort `updatedAt DESC`. |
| 5.5 | `use-cases/get-draft.use-case.ts` | Create. Ownership check → `403 DRAFT_NOT_AUTHOR`. `404 DRAFT_NOT_FOUND`. |
| 5.6 | `use-cases/delete-draft.use-case.ts` | Create. Soft delete (`deletedAt = now()`). Returns `204`. |
| 5.7 | `prisma/schema.prisma` | Modify — add `JourneyDraft` model per `requirements.md` § "Schema additions". |
| 5.8 | `npx prisma migrate dev --name add_journey_drafts` | Run migration |
| 5.9 | `interfaces/journey-draft.interface.ts` | Create |
| 5.10 | `build-from-scratch.controller.ts` | Modify — add 4 routes:<br>`@Post('/journey-drafts')`<br>`@Get('/journey-drafts')`<br>`@Get('/journey-drafts/:draftId')`<br>`@Delete('/journey-drafts/:draftId')`<br><br>**Note:** these routes are NOT under `/trips/build-from-scratch/...` — they're under `/v1/journey-drafts` per `booking-methods.md` § 5. Either restructure the controller into two (one per URL prefix) or carry both prefixes — recommended: split into `BuildFromScratchController` and `JourneyDraftsController` (the latter shared with M1/M2 in Phase 5b). |
| 5.11 | Decide: split controllers or not | If split, `JourneyDraftsController` lives in `journey-configurations/` (foundation for M1/M2/M3) — defer to that module. M3's controller only handles `/trips/build-from-scratch/*`. |

### Per-group gate

1. Lint / build / type-check clean
2. `POST /v1/journey-drafts` returns `201`
3. `GET /v1/journey-drafts` lists own drafts, paginated
4. `GET /v1/journey-drafts/:id` of another user's draft returns `403`
5. `DELETE /v1/journey-drafts/:id` returns `204`; row has `deletedAt` set
6. **Stop here.**

---

## Group 6 — `availability/confirm` integration (Phase 3 lock-in)

> **Goal:** The user's flow continues from `POST .../configurations` (Group 4) → `POST /v1/availability/confirm` (owned by `journey-configurations/`) → `POST /v1/bookings` (owned by `bookings/` in shared-foundation).

This group is **integration only** — M3 does not own the `availability/confirm` or `POST /v1/bookings` endpoints. The work is to verify the M3 flow produces a `JourneyConfiguration` that those endpoints accept.

| # | Action |
|---|--------|
| 6.1 | Smoke: full flow basics → skeleton → configuration → confirm → booking |
| 6.2 | Verify `POST /v1/bookings { configurationId }` writes a `Booking` with reference prefix `CSM-` |
| 6.3 | Verify `Booking.method = 'BUILD_FROM_SCRATCH'` |
| 6.4 | Verify `BookingItem` rows count = sum of all leaf resources across all days (one per activity, hotel-night, transport-day, guide-day) |
| 6.5 | Verify hold key set in Redis |
| 6.6 | Verify `booking.created` event payload includes `method: 'BUILD_FROM_SCRATCH'`, `configurationId`, full `items[]` |

### Per-group gate

1. End-to-end smoke commands in `validation.md` all pass
2. Postgres: `SELECT method, single_resource_kind, configuration_id FROM bookings WHERE method = 'BUILD_FROM_SCRATCH'` shows the row
3. **Stop here.**

---

## Group 7 — Cross-cutting wiring + DoD

| # | Item | Action |
|---|------|--------|
| 7.1 | `src/common/errors/error-codes.ts` | Add all `BFS_*`, `DRAFT_*`, `CONFIG_*` codes from `requirements.md` § Validation Errors |
| 7.2 | `backend/.env.example` | Add `BFS_SESSION_TTL_SECONDS=86400`, `JOURNEY_DRAFT_EXPIRY_DAYS=30`, `CATALOG_CACHE_TTL_SECONDS=300` |
| 7.3 | `src/config/env.validation.ts` | Validate the three new env vars |
| 7.4 | `src/app.module.ts` | Confirm `BuildFromScratchModule` imported |
| 7.5 | `backend/context/specs/EVENT-CATALOG.md` | Add `journey_draft.created`, `configuration.created`, `configuration.confirmed`. Update `booking.created` doc to include `BUILD_FROM_SCRATCH` as a valid `method` value. |
| 7.6 | `backend/context/specs/API-CONTRACT.md` | Add new `§ M3 Build From Scratch` section with all endpoint shapes |
| 7.7 | `backend/context/specs/ERROR-REGISTRY.md` | Add all new codes |
| 7.8 | `backend/context/plans/PROGRESS-TRACKER.md` | Mark Phase 5c deliverables |

---

## File-count summary

| Bucket | Files |
|--------|-------|
| Use cases | 7 (submit-basics, get-session, finalize-config, create-draft, list-drafts, get-draft, delete-draft) |
| Validators | 6 + 6 specs = 12 |
| Utils | 3 + 1 spec = 4 |
| DTOs | 4 |
| Interfaces | 4 |
| Controllers | 1 (or 2 if split) |
| Modules | 1 |
| Schema migrations | 1 (`add_journey_drafts`) |
| Critical-path tests | 1 (skeleton-generator) + 6 (validators) = **7** |
| Modified files | `app.module.ts`, `error-codes.ts`, `.env.example`, `env.validation.ts`, 3 doc files = **7** |
| Barrels | 5 |
| **Total new files** | **~38** |

---

## Out of scope (do not build in this branch)

- AI-assisted skeleton generation (Phase 9 / Vibe Booking)
- M1 / M2 customization flows (Phase 5b)
- Stripe payment integration (Phase 6)
- Email / push notifications (Phase 8)
- Journey sharing + public discovery (Phase 7)
- Location reviews (Phase 7)
- `JourneyConfiguration` cleanup cron (Phase 8)
- Mapbox Matrix API for live travel time (current MVP uses pre-computed `distanceKm` columns)
- Multi-vehicle group splitting (single transport per day in MVP)
- Property-based tests, full E2E across the 5 phases (deferred to follow-up branch — same posture as Phase 5a)

---

## Definition of Done

- [ ] All 6 endpoints respond with correct shapes (basics, get-session, configurations, drafts CRUD)
- [ ] Skeleton generator passes the 6 critical-path test cases (deterministic, kid-filter, hotel-persists, etc.)
- [ ] All 6 validators are pure functions with their own spec files
- [ ] `POST /v1/availability/confirm` accepts a M3-source configuration and freezes it for 15 min
- [ ] `POST /v1/bookings { configurationId }` writes a `Booking` with `method: 'BUILD_FROM_SCRATCH'` and N `BookingItem` rows
- [ ] `Booking.reference` matches `/^CSM-[A-Z2-7]{6}$/`
- [ ] `journey_drafts` table exists, soft-deletes correctly, expiresAt set to 30 days
- [ ] Redis: `bfs_session:*` keys created with TTL ~86400, `availability_check:*` keys with TTL ~120
- [ ] All `BFS_*`, `DRAFT_*`, `CONFIG_*` codes in `ERROR-REGISTRY.md` and `error-codes.ts`
- [ ] `EVENT-CATALOG.md` updated with new events
- [ ] `API-CONTRACT.md` documents all 6 endpoints
- [ ] `PROGRESS-TRACKER.md` Phase 5c row → 🟢
- [ ] Lint / build / type-check clean
- [ ] All 7 critical-path unit tests pass
- [ ] `validation.md` smoke commands all pass
