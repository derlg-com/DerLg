# Plan: M2 — Private Package (Prebuilt + Customize / Book As-Is)

> **Method:** M2
> **Branch:** TBD (Phase 5b follow-up branch — NOT this branch)
> **Phase:** 5b — Private Package
> **Status:** 🟡 Spec drafted, implementation not started
> **Prerequisites:**
>   - `../shared-foundation/` 🟢 Complete (commit-booking primitive, hold key, idempotency, `PRV-` reference prefix support)
>   - `../journey-configurations/` 🟢 Complete (`JourneyConfiguration` model, `availability/check`, `availability/confirm`, `journey-drafts` CRUD)
>   - `../build-from-scratch/` 🟢 Complete (`transport_routes` lookup, `distanceKmTo` activity columns)

This plan implements **M2 only**. It assumes all three prerequisites are landed. M2 is intentionally a constrained subset of M3 — every primitive M2 needs (configuration store, drafts, availability checks, line-item commit, validators for travel-time / opening-hours / destination-reachable) already exists. M2 adds the **template-driven** layer: pool expansion, group-size bounds, kid-friendly handling, day-mutation rules, per-group price reconciliation.

> **Why M2 is a small module:** roughly 60% of the validator surface is reused from M3 (travel-time, opening-hours, destination-reachable, group-capacity). The M2-specific work is the pool / template / day-mutation logic, the as-is materializer, and the price reconciliator.

---

## Sequential implementation rule

**Implement one group at a time.** Per-group gates must pass before the next group begins. Same gate template as `../specific-booking/transportation/plan.md` and `../build-from-scratch/plan.md`:

| # | Check | Command |
|---|-------|---------|
| 1 | Lint | `npm run lint` — zero errors / warnings |
| 2 | Build | `npm run build` succeeds |
| 3 | Type-check | `npx tsc --noEmit` — zero errors |
| 4 | Unit tests | `npm test -- src/modules/private-package` — relevant specs pass |
| 5 | Smoke | `validation.md` curl commands for this group succeed |
| 6 | Tracker | `PROGRESS-TRACKER.md` row updated |
| 7 | Stop & confirm | Pause for review before next group |

---

## Module structure

```
src/modules/private-package/
  private-package.module.ts
  private-package.controller.ts
  dto/
    finalize-private-package.dto.ts                 ⭐ Group 3 — discriminated on asIs
    travelers.dto.ts                                ⭐ Group 3 — reused from common
    customized-day.dto.ts                           ⭐ Group 3 — nested under finalize DTO
    index.ts
  use-cases/
    get-template.use-case.ts                        ⭐ Group 2
    finalize-configuration.use-case.ts              ⭐ Group 4
    index.ts
  utils/
    template-loader.util.ts                         ⭐ Group 1 — Redis cache + pool expansion
    template-loader.util.spec.ts                    ⭐ Group 1 — critical-path test
    as-is-materializer.util.ts                      ⭐ Group 1 — defaults → days[]
    as-is-materializer.util.spec.ts                 ⭐ Group 1 — critical-path test
    price-computer.util.ts                          ⭐ Group 1 — sum-from-line-items
    index.ts
  validators/
    group-size-bounds.validator.ts                  ⭐ Group 3
    kid-friendly.validator.ts                       ⭐ Group 3
    pool-membership.validator.ts                    ⭐ Group 3
    template-scope.validator.ts                     ⭐ Group 3
    day-mutation.validator.ts                       ⭐ Group 3
    minimum-activity.validator.ts                   ⭐ Group 3
    price-reconciliation.validator.ts               ⭐ Group 3
    index.ts
  interfaces/
    private-package-template.interface.ts
    finalize-result.interface.ts
    validation-result.interface.ts
    index.ts
```

**Reused from siblings (no duplication):**
- `TravelTimeValidator`, `OpeningHoursValidator`, `GroupCapacityValidator`, `DestinationReachableValidator`, `MealCoverageValidator` — owned by `../build-from-scratch/validators/` (re-exported through a shared barrel for cross-method use)
- `JourneyConfigurationsService` — owned by `../journey-configurations/`
- `commit-booking.use-case.ts` — owned by `../shared-foundation/`

---

## Group 1 — Pure utilities (foundation)

> **Goal:** Three pure-logic utilities that the rest of the module depends on. Get them right before touching controllers or DB writes.

| # | File | Action |
|---|------|--------|
| 1.1 | `utils/template-loader.util.ts` | Create — `@Injectable()`. Method `load(tripId): PrivatePackageTemplate`. Reads Redis (`pp_template:{tripId}`, TTL 300 s). On miss, queries Prisma for `Trip` (filtered by `tripType: 'PRIVATE'`, `deletedAt: null`), expands pools (activities/hotels/transport/guides) via parallel catalog reads, builds the response shape. Returns `null` if not found, throws `PP_TEMPLATE_INACTIVE` (`ConflictException`) if soft-deleted between the cache and the DB. |
| 1.2 | `utils/as-is-materializer.util.ts` | Create — pure function `materialize(template, startDate, travelers): CustomizedDay[]`. Walks `template.defaultJourneyMap`, fills in `date` from `startDate + dayNumber - 1`, copies `defaultActivities → activities`, `defaultHotel → hotel`, etc. No DB calls. |
| 1.3 | `utils/price-computer.util.ts` | Create — pure function `compute(days): { totalPriceUsd, breakdown }`. Sums `activities[].priceUsd`, `hotel.pricePerNightUsd × nights`, `transport.priceUsd × days`, `guide.pricePerDayUsd × days`. Returns the canonical `itemBreakdown` shape. |
| 1.4 | `utils/template-loader.util.spec.ts` | Create — **critical-path test**. Cases:<br>(a) cache miss → Prisma read → Redis populated<br>(b) cache hit → no Prisma calls<br>(c) `tripType: 'PUBLIC'` → returns null (M2 doesn't serve public templates)<br>(d) soft-deleted template → throws `PP_TEMPLATE_INACTIVE`<br>(e) pool expansion: `activity_pool` ids resolve to full activity rows<br>(f) parallel pool fetches use `Promise.all` (verify via spy on Prisma calls) |
| 1.5 | `utils/as-is-materializer.util.spec.ts` | Create — **critical-path test**. Cases:<br>(a) 3-day template + startDate → 3 days with sequential dates<br>(b) `defaultGuide: null` on template → `day.guide` undefined in result<br>(c) `mealsIncluded` array copied as-is<br>(d) `notes` field absent in output (template doesn't have it)<br>(e) traveler ages don't affect the materialized days (group size validation runs separately) |
| 1.6 | `utils/price-computer.util.ts` test (inline or sibling) | Create. Cases: empty day → 0; multi-night hotel; rounding (cent precision); breakdown keys all numeric. |
| 1.7 | `interfaces/private-package-template.interface.ts` | Create — full type for the template-loader response. |
| 1.8 | `utils/index.ts`, `interfaces/index.ts` | Create barrels |

### Per-group gate

1. Lint / build / type-check clean
2. `npm test -- src/modules/private-package/utils/template-loader.util.spec.ts` passes (6 cases)
3. `npm test -- src/modules/private-package/utils/as-is-materializer.util.spec.ts` passes (5 cases)
4. **Stop here.**

---

## Group 2 — Template endpoint (Phase 1 helper)

> **Goal:** `GET /v1/private-packages/:tripId/template` works end-to-end. Frontend can render the customizer.

| # | File | Action |
|---|------|--------|
| 2.1 | `use-cases/get-template.use-case.ts` | Create — thin wrapper over `TemplateLoader`. `execute(user, tripId)`. `404 PP_TEMPLATE_NOT_FOUND` if loader returns null. Auth: any authenticated user (no ownership concept on templates). |
| 2.2 | `private-package.controller.ts` | Create — `@Controller('private-packages')`. Route:<br>`@Get(':tripId/template')` |
| 2.3 | `private-package.module.ts` | Create — register `GetTemplateUseCase` + `TemplateLoader`. |
| 2.4 | `src/app.module.ts` | Modify — import `PrivatePackageModule`. |

### Per-group gate

1. Lint / build / type-check clean
2. `GET /v1/private-packages/<valid-tripId>/template` returns `200` with the expanded shape
3. `GET /v1/private-packages/<bogus-uuid>/template` returns `404 PP_TEMPLATE_NOT_FOUND`
4. `GET /v1/private-packages/<public-trip-id>/template` returns `404 PP_TEMPLATE_NOT_FOUND` (public trips don't have private template shape)
5. `redis-cli TTL pp_template:<tripId>` returns ~300
6. Repeat call within 5 min serves from cache (verify via DB query log: zero new SELECTs)
7. **Stop here.**

---

## Group 3 — Validators (pure, testable)

> **Goal:** All 7 M2-specific validators implemented as pure functions. Tested independently. Used by Group 4.

| # | File | Action |
|---|------|--------|
| 3.1 | `validators/group-size-bounds.validator.ts` | Create — `validate(template, travelers): ValidationResult`. Checks `template.minGroupSize ≤ adults + children ≤ template.maxGroupSize`. |
| 3.2 | `validators/kid-friendly.validator.ts` | Create — `validate(template, travelers, acknowledged): ValidationResult`. Returns warning when `children > 0 && template.isKidFriendly === false && acknowledged === true`. Returns failure when `acknowledged === false`. |
| 3.3 | `validators/pool-membership.validator.ts` | Create — `validate(template, days): ValidationResult`. For each `day.activities[].resourceId`, checks membership in `template.pools.activities[sourceDayNumber || dayNumber]`. For added days (no `sourceDayNumber`), passes (no pool to be outside of). Same logic for `day.guide.guideId` against `template.pools.guides` when non-null. |
| 3.4 | `validators/template-scope.validator.ts` | Create — `validate(days, catalogReader): ValidationResult`. For each `day.hotel.hotelId`, queries `Hotel.destinations` to verify it serves `day.destination`. Same for `transport.vehicleId`. Uses an injected catalog reader so tests can mock it. |
| 3.5 | `validators/day-mutation.validator.ts` | Create — `validate(template, days): ValidationResult`. Checks `dayNumber` sequence is `1..N`, no gaps, no duplicates. Computes `daysAdded = days.length - template.durationDays + (count of removed sourceDayNumber)`. Verifies `daysAdded ≤ template.durationDays`, `daysRemoved ≤ template.durationDays - 1`. |
| 3.6 | `validators/minimum-activity.validator.ts` | Create — `validate(days): ValidationResult`. For each day, `activities.length ≥ 1 || day.restDay === true`. |
| 3.7 | `validators/price-reconciliation.validator.ts` | Create — `validate(days, clientTotalUsd): ValidationResult`. Recomputes total from `days[]` via `PriceComputer`. Compares to `clientTotalUsd` with `± 1¢` tolerance. |
| 3.8 | `validators/*.spec.ts` (one per validator) | Create — pure-function tests. Boundary cases per validator (group exactly at min/max, pool with 0 entries, day mutation at max cap, etc.). |
| 3.9 | `interfaces/validation-result.interface.ts` | Create — same shape as `../build-from-scratch/interfaces/validation-result.interface.ts`. **If feasible, move to a shared `../journey-configurations/interfaces/` barrel and import from both.** |
| 3.10 | `validators/index.ts` | Create barrel. Exports `runM2Validators(input, mode: 'AS_IS' | 'CUSTOMIZE')` aggregator that runs the right subset per the requirements doc § Validators table. |

### Per-group gate

1. Lint / build / type-check clean
2. `npm test -- src/modules/private-package/validators` — all 7 spec files pass
3. **Stop here.**

---

## Group 4 — Configuration finalization (Phase 3 of user flow)

> **Goal:** `POST /v1/private-packages/:tripId/configurations` writes a `JourneyConfiguration` row (DRAFT, source `PRIVATE_PREBUILT`, 1 h TTL).

| # | File | Action |
|---|------|--------|
| 4.1 | `dto/finalize-private-package.dto.ts` | Create — discriminated union on `asIs`. `class-validator` rules:<br>• `asIs: boolean` (required, discriminator)<br>• `startDate: string` (ISO, ≥ tomorrow)<br>• `travelers: TravelersDto` (nested validator)<br>• `draftId?: string` (UUID)<br>• `acknowledgeKidUnfriendly?: boolean` (default `true`)<br>• `@ValidateIf(o => o.asIs === false)` for `days: CustomizedDayDto[]` (required when customize)<br>• `@ValidateIf(o => o.asIs === false)` for `totalPriceUsd: number` (required when customize) |
| 4.2 | `dto/customized-day.dto.ts` | Create — nested DTO with all fields from § DTO Customize path. Each nested resource (`activities[].resourceId`, `hotel.hotelId`, etc.) class-validated as UUID. |
| 4.3 | `dto/travelers.dto.ts` | Create or reuse — `adults ≥ 1, total ≤ 20`, `childrenAges.length === children`. |
| 4.4 | `prisma/schema.prisma` | Modify — add 3 columns to `JourneyConfiguration`:<br>`templateId String? @db.Uuid`<br>`templateBasePriceUsd Decimal? @db.Decimal(10, 2)`<br>`asIs Boolean? @default(false)`<br>FK `templateId → trips.id (onDelete: Restrict)`. |
| 4.5 | `npx prisma migrate dev --name add_private_package_columns_to_journey_configurations` | Run migration. |
| 4.6 | `use-cases/finalize-configuration.use-case.ts` | Create. Steps:<br>1. Idempotency: check `idem:m2-config:{userId}:{tripId}:{key}`. Return cached config if hit.<br>2. Load template via `TemplateLoader.load(tripId)`. `404 PP_TEMPLATE_NOT_FOUND` / `409 PP_TEMPLATE_INACTIVE`.<br>3. If `asIs`, call `AsIsMaterializer.materialize(...)`; else use `dto.days`.<br>4. Run `runM2Validators(...)` plus the reused M3 validators (`travel-time`, `opening-hours`, `group-capacity`, `destination-reachable`, `meal-coverage`) for the customize path. Aggregate failures → `400 PP_VALIDATION_FAILED { failures: [...] }`.<br>5. Inside `prisma.$transaction`:<br>&nbsp;&nbsp;a. Insert `JourneyConfiguration` with `source: 'PRIVATE_PREBUILT', templateId, templateBasePriceUsd, asIs, daysSnapshot`<br>&nbsp;&nbsp;b. If `draftId`, mark draft `status: BOOKED` (best-effort; if it errors, log + continue)<br>6. Cache idempotency record (24 h).<br>7. Return `FinalizeResult` shape from § response. |
| 4.7 | `private-package.controller.ts` | Modify — add `@Post(':tripId/configurations')` handler. Pulls `Idempotency-Key` header (required). |
| 4.8 | `private-package.module.ts` | Modify — register `FinalizeConfigurationUseCase`, all 7 validators, the price computer, and import `JourneyConfigurationsModule` + `BuildFromScratchValidatorsModule` (for re-exported validators). |
| 4.9 | `src/common/errors/error-codes.ts` | Add all `PP_*` codes. |

### Per-group gate

1. Lint / build / type-check clean
2. `prisma migrate status` — migration applied
3. Smoke: as-is happy path → `200`, config row in DB with `asIs: true, source: 'PRIVATE_PREBUILT'`
4. Smoke: customize happy path → `200`, config row with `asIs: false, daysSnapshot` populated
5. Smoke: pool violation → `400 PP_VALIDATION_FAILED` with `failures: [{ code: 'PP_OUTSIDE_POOL', ... }]`
6. Smoke: group out of bounds → `400 PP_VALIDATION_FAILED` with `PP_GROUP_SIZE_OUT_OF_BOUNDS`
7. Smoke: price mismatch → `400 PP_VALIDATION_FAILED` with `PP_PRICE_MISMATCH`
8. Smoke: missing `Idempotency-Key` header → `400`
9. Smoke: same idempotency key, second call → returns same `configurationId` (no duplicate row)
10. Postgres: `SELECT * FROM journey_configurations WHERE source = 'PRIVATE_PREBUILT'` shows the new rows
11. **Stop here.**

---

## Group 5 — `availability/confirm` + booking commit integration

> **Goal:** Verify M2's flow produces a `JourneyConfiguration` that the shared `availability/confirm` and `POST /v1/bookings` endpoints consume correctly.

This group is **integration only** — M2 owns no new endpoints here. The work is to verify the M2 flow plugs into shared infrastructure.

| # | Action |
|---|--------|
| 5.1 | Smoke: full as-is flow → template fetch → config (as-is) → confirm → commit |
| 5.2 | Smoke: full customize flow → template → config (customize, with day-add and pool-swap) → draft save → confirm → commit |
| 5.3 | Verify `POST /v1/bookings { configurationId }` writes a `Booking` with reference matching `/^PRV-[A-Z2-7]{6}$/` |
| 5.4 | Verify `Booking.method = 'PRIVATE_PREBUILT'` |
| 5.5 | Verify `Booking.singleResourceKind IS NULL` |
| 5.6 | Verify `BookingItem` row count = sum of leaf resources across all days (one per activity, hotel-night, transport-day, guide-day) |
| 5.7 | Verify hold key set in Redis (`booking_hold:{bookingId}`, TTL ~900) |
| 5.8 | Verify `booking.created` event payload includes `method: 'PRIVATE_PREBUILT'`, `asIs: <bool>`, `configurationId`, full `items[]` |
| 5.9 | Verify `journey_drafts.status` flips to `BOOKED` when `draftId` was supplied |
| 5.10 | Verify inventory drift on confirm → `409 CONFIG_INVENTORY_DRIFT`; configuration stays `DRAFT` |

### Per-group gate

1. End-to-end smoke commands in `validation.md` all pass for both as-is and customize
2. Postgres: `SELECT method, single_resource_kind, configuration_id, reference FROM bookings WHERE method = 'PRIVATE_PREBUILT'` shows correct rows
3. **Stop here.**

---

## Group 6 — Cross-cutting wiring + DoD

| # | Item | Action |
|---|------|--------|
| 6.1 | `src/common/errors/error-codes.ts` | Confirm all `PP_*` codes from § Validation Errors are registered. |
| 6.2 | `backend/.env.example` | Add `PP_TEMPLATE_CACHE_TTL_SECONDS=300`. |
| 6.3 | `src/config/env.validation.ts` | Validate `PP_TEMPLATE_CACHE_TTL_SECONDS` (positive integer). |
| 6.4 | `src/app.module.ts` | Confirm `PrivatePackageModule` imported. |
| 6.5 | `backend/context/specs/EVENT-CATALOG.md` | Update `booking.created` — add `'PRIVATE_PREBUILT'` to `method` enum, document new `asIs: boolean` field on the payload. |
| 6.6 | `backend/context/specs/API-CONTRACT.md` | Add new `§ M2 Private Package` section with both endpoint shapes (template + configurations). Include as-is and customize request examples. |
| 6.7 | `backend/context/specs/ERROR-REGISTRY.md` | Add all `PP_*` codes with HTTP status, trigger, and example response body. |
| 6.8 | `backend/context/specs/SCHEMA.md` | Document the 3 new columns on `JourneyConfiguration` (`templateId`, `templateBasePriceUsd`, `asIs`). |
| 6.9 | `backend/context/plans/PROGRESS-TRACKER.md` | Mark Phase 5b — Private Package row → 🟢 |

---

## File-count summary

| Bucket | Files |
|--------|-------|
| Use cases | 2 (get-template, finalize-configuration) |
| Validators | 7 + 7 specs = 14 |
| Utils | 3 + 3 specs = 6 (template-loader, as-is-materializer, price-computer) |
| DTOs | 3 (finalize, customized-day, travelers — last may be reused) |
| Interfaces | 3 (template, finalize-result, validation-result — last may be shared) |
| Controllers | 1 |
| Modules | 1 |
| Schema migrations | 1 (`add_private_package_columns_to_journey_configurations`) |
| Critical-path tests | 2 (template-loader, as-is-materializer) + 7 (validators) = **9** |
| Modified files | `app.module.ts`, `error-codes.ts`, `.env.example`, `env.validation.ts`, 4 doc files = **8** |
| Barrels | 4 |
| **Total new files** | **~31** |

---

## Out of scope (do not build in this branch)

- M1 (public-package customize) — sibling spec, separate branch
- M3 (build-from-scratch) — already complete in Phase 5c (prerequisite)
- Admin authoring tools for templates (pool editor, kid-friendly toggle UI) — Phase 4 admin-inventory
- Stripe payment integration — Phase 6
- Email / push notifications (including the per-group price formatting in confirmation emails) — Phase 8
- Multi-package combined checkout — Phase 5b+ enhancement
- AI-assisted customization (Vibe Booking) — Phase 9
- Journey sharing / public discovery — Phase 7
- `PATCH /v1/private-packages/.../configurations/:id` (configurations are immutable post-creation) — out of scope by Decision #15
- Property-based tests, full E2E across the 5 phases (deferred to follow-up branch — same posture as 5a/5c)
- Frontend customizer UI — frontend repo concern, not this spec
- Mapbox Matrix API for live travel time (MVP uses pre-computed `distanceKm` columns from M3)

---

## Definition of Done

- [ ] Both endpoints respond with correct shapes (`GET /template`, `POST /configurations`)
- [ ] As-is path works end-to-end: `POST /configurations { asIs: true, ... }` → `JourneyConfiguration` (DRAFT)
- [ ] Customize path works end-to-end: `POST /configurations { asIs: false, days[], ... }` → `JourneyConfiguration` (DRAFT)
- [ ] All 7 M2-specific validators pass critical-path tests (group-size, kid-friendly, pool, scope, day-mutation, minimum-activity, price-reconciliation)
- [ ] Both critical-path utility tests pass (template-loader, as-is-materializer)
- [ ] Reused M3 validators (`travel-time`, `opening-hours`, `group-capacity`, `destination-reachable`, `meal-coverage`) execute successfully on M2 configurations
- [ ] Idempotency: same `Idempotency-Key` returns same `configurationId`, no duplicate DB rows
- [ ] `POST /v1/availability/confirm` accepts an M2-source configuration and freezes it for 15 min
- [ ] `POST /v1/bookings { configurationId }` writes a `Booking` with `method: 'PRIVATE_PREBUILT'`, `asIs: <bool>`, and N `BookingItem` rows
- [ ] `Booking.reference` matches `/^PRV-[A-Z2-7]{6}$/`
- [ ] Redis: `pp_template:*` keys created with TTL ~300; `idem:m2-config:*` keys persist 24 h
- [ ] All `PP_*` codes in `ERROR-REGISTRY.md` and `error-codes.ts`
- [ ] `EVENT-CATALOG.md` documents `'PRIVATE_PREBUILT'` and `asIs` on `booking.created`
- [ ] `API-CONTRACT.md` documents both M2 endpoints with as-is and customize examples
- [ ] `SCHEMA.md` documents the 3 new `JourneyConfiguration` columns
- [ ] `PROGRESS-TRACKER.md` Phase 5b — Private Package row → 🟢
- [ ] Lint / build / type-check clean
- [ ] All 9 critical-path unit tests pass
- [ ] `validation.md` smoke commands all pass (both as-is and customize tracks)
