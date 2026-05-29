# Validation: M2 — Private Package (Prebuilt + Customize / Book As-Is)

> **Method:** M2
> **Endpoints under test:**
> - `GET /v1/private-packages/:tripId/template`
> - `POST /v1/private-packages/:tripId/configurations` (both `asIs: true` and `asIs: false` paths)
>
> **Branch:** TBD (Phase 5b follow-up — NOT this branch)
> **Phase:** 5b — Private Package
> **Date:** 2026-05-25

This validates **only** the M2 surface. Foundation-level checks (`commit-booking` primitive, hold key, idempotency, refund tiers, reference generator, `POST /v1/bookings`) are validated in `../shared-foundation/validation.md`. The shared `POST /v1/availability/check`, `POST /v1/availability/confirm`, and the `journey-drafts` CRUD surface are validated in `../journey-configurations/validation.md` — this file only verifies that an M2-sourced `JourneyConfiguration` flows through them correctly.

---

## Verification Criteria

### Build & static checks (gating)

- [ ] `npm run lint` — zero errors / zero warnings
- [ ] `npm run build` — TypeScript compiles
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx prisma generate` — Prisma client regenerated after `add_private_package_columns_to_journey_configurations` migration
- [ ] `npx prisma migrate status` — migration applied cleanly

### Critical-path unit tests (gating)

- [ ] `npm test -- src/modules/private-package/utils/template-loader.util.spec.ts` — all 6 cases pass:
  - (a) cache miss → Prisma read → Redis populated
  - (b) cache hit → no Prisma calls
  - (c) `tripType: 'PUBLIC'` → returns null
  - (d) soft-deleted template → throws `PP_TEMPLATE_INACTIVE`
  - (e) pool expansion: `activity_pool` ids resolve to full activity rows
  - (f) parallel pool fetches use `Promise.all`
- [ ] `npm test -- src/modules/private-package/utils/as-is-materializer.util.spec.ts` — all 5 cases pass:
  - (a) 3-day template + startDate → 3 days with sequential dates
  - (b) `defaultGuide: null` on template → `day.guide` undefined in result
  - (c) `mealsIncluded` array copied as-is
  - (d) `notes` field absent in output
  - (e) traveler ages don't affect materialized days
- [ ] `npm test -- src/modules/private-package/validators` — all 7 validator spec files pass

### DTO validation — `POST /v1/private-packages/:tripId/configurations` (gating — manual)

> Use `curl -i` to inspect status code and response body. `TOKEN` comes from a successful login. `TRIP_ID` is the id of a seeded private template.

#### Common DTO failures (apply to both as-is and customize)

- [ ] `Idempotency-Key` header missing → `400 IDEMPOTENCY_KEY_REQUIRED`
- [ ] `asIs` missing from body → `400 PP_INVALID_BODY`
- [ ] `startDate` missing → `400`
- [ ] `startDate` in the past → `400`
- [ ] `travelers.adults < 1` → `400`
- [ ] `travelers.adults + travelers.children > 20` → `400`
- [ ] `travelers.childrenAges.length !== travelers.children` → `400`
- [ ] `draftId` not a UUID → `400`

#### Customize-path DTO failures (`asIs: false`)

- [ ] `days` missing → `400`
- [ ] `days` empty array → `400`
- [ ] `days[i].dayNumber` non-sequential (1, 2, 4) → caught by `DayMutationValidator` → `400 PP_DAY_MUTATION_INVALID`
- [ ] `days[i].activities[].resourceId` not a UUID → `400`
- [ ] `totalPriceUsd` missing or negative → `400`

#### As-is-path DTO failures (`asIs: true`)

- [ ] `days` field present (rejected — server materializes, client must not supply) → `400 PP_INVALID_BODY` (extra-property rejection via class-validator `whitelist + forbidNonWhitelisted`)
- [ ] `totalPriceUsd` field present (same — server computes) → `400 PP_INVALID_BODY`

### Endpoint behaviour — template (gating — manual)

#### Happy path — template fetch

- [ ] `GET /v1/private-packages/$TRIP_ID/template` → `200` with:
  - `data.templateId` matches a UUID v4
  - `data.tripId === TRIP_ID`
  - `data.priceType === 'PER_GROUP'`
  - `data.minGroupSize ≤ data.maxGroupSize`
  - `data.defaultJourneyMap.length === data.durationDays`
  - `data.pools.activities` keys are stringified day numbers
  - `data.pools.hotels` keys are destination names
  - At least one pool entry per day (catalog seed has ≥ 1 activity per destination)
- [ ] Repeat call within 5 min — Postgres query log shows zero new SELECTs (Redis cache hit)

#### Negative paths — template fetch

- [ ] `GET /v1/private-packages/<bogus-uuid>/template` → `404 PP_TEMPLATE_NOT_FOUND`
- [ ] `GET /v1/private-packages/<public-trip-id>/template` → `404 PP_TEMPLATE_NOT_FOUND` (correct: M2 only serves `tripType: 'PRIVATE'`)
- [ ] `GET /v1/private-packages/<soft-deleted-trip-id>/template` → `404 PP_TEMPLATE_NOT_FOUND`
- [ ] No `Authorization` header → `401`

### Endpoint behaviour — configurations (as-is path) (gating — manual)

#### Happy path — as-is

- [ ] `POST /v1/private-packages/$TRIP_ID/configurations` with body `{ asIs: true, startDate, travelers }` → `200` with:
  - `data.configurationId` is a UUID
  - `data.status === 'DRAFT'`
  - `data.source === 'PRIVATE_PREBUILT'`
  - `data.asIs === true`
  - `data.templateId === TRIP_ID`
  - `data.templateBasePriceUsd` matches `template.basePriceUsd`
  - `data.expiresAt` is ~1 h from now
  - `data.totalPriceUsd === sum of materialized line items` (verified via `PriceComputer` invariant)
  - `data.itemBreakdown` keys present and ≥ 0

#### As-is — group out of bounds

- [ ] `POST .../configurations { asIs: true, travelers: { adults: 1 } }` against a template with `minGroupSize: 4` → `400 PP_VALIDATION_FAILED` with `failures: [{ code: 'PP_GROUP_SIZE_OUT_OF_BOUNDS', ... }]`
- [ ] `POST .../configurations { asIs: true, travelers: { adults: 10 } }` against a template with `maxGroupSize: 6` → same error

#### As-is — kid-unfriendly template

- [ ] Template has `isKidFriendly: false`. Body `{ asIs: true, travelers: { adults: 2, children: 1, childrenAges: [8] } }` → `200` with `warnings: [{ code: 'PP_KID_UNFRIENDLY', ... }]` (default `acknowledgeKidUnfriendly: true`)
- [ ] Same body but with `acknowledgeKidUnfriendly: false` → `400 PP_VALIDATION_FAILED` with the same code

### Endpoint behaviour — configurations (customize path) (gating — manual)

#### Happy path — customize

- [ ] `POST .../configurations` with body `{ asIs: false, days[], travelers, startDate, totalPriceUsd }` where `days[]` swaps one activity from the template's pool → `200` with:
  - `data.asIs === false`
  - `data.totalPriceUsd === clientTotalPriceUsd` (within 1¢ tolerance)
  - `data.itemBreakdown.daysAdded === 0` (no day mutations)
  - `data.itemBreakdown.daysRemoved === 0`

#### Customize — pool violation

- [ ] Body has `days[0].activities[0].resourceId` set to an activity NOT in `template.pools.activities['1']` → `400 PP_VALIDATION_FAILED` with `failures: [{ code: 'PP_OUTSIDE_POOL', dayNumber: 1, resourceId, expectedPool: [...] }]`

#### Customize — pool match for moved day

- [ ] Body reorders Day 2 → Day 1 (`sourceDayNumber: 2, dayNumber: 1`). Activities still match Day 2's pool → `200` (the validator uses `sourceDayNumber || dayNumber`).
- [ ] Same body but activities now reference Day 1's pool ids → `400 PP_OUTSIDE_POOL` (correct: pool follows the source day).

#### Customize — destination scope

- [ ] `days[0].hotel.hotelId` is a hotel that doesn't serve `days[0].destination` → `400 PP_VALIDATION_FAILED` with `PP_OUT_OF_DESTINATION_SCOPE`

#### Customize — day mutation

- [ ] Add 4 days to a 3-day template (`daysAdded: 4 > durationDays: 3`) → `400 PP_VALIDATION_FAILED` with `PP_DAY_MUTATION_INVALID`
- [ ] Remove all days from a 3-day template (`daysRemoved: 3 > durationDays - 1`) → same code
- [ ] Non-sequential `dayNumber`s (1, 3, 4) → same code
- [ ] Duplicate `dayNumber`s → same code

#### Customize — added day, no source pool

- [ ] Add Day 4 to a 3-day template (`sourceDayNumber: undefined`) with activities NOT in any template pool → `200` (added days have no pool to violate; `MinimumActivityValidator` still runs)
- [ ] Same with empty `activities: []` and `restDay: false` → `400 PP_VALIDATION_FAILED` with `PP_DAY_EMPTY`
- [ ] Same with empty `activities: []` and `restDay: true` → `200`

#### Customize — travel time / opening hours (reused M3 validators)

- [ ] Two activities scheduled 30 min apart with 60 km between them → `400 PP_VALIDATION_FAILED` with reused M3 code (likely `BFS_TRAVEL_TIME_INVALID` if validators are re-exported as-is, or `PP_TRAVEL_TIME_INVALID` if re-coded — confirm in implementation; document final choice in `ERROR-REGISTRY.md`)
- [ ] Activity startTime `06:00` but venue opens `09:00` → `400 PP_VALIDATION_FAILED` with the corresponding opening-hours code

#### Customize — group capacity

- [ ] 6 adults + transport.capacity = 4 → `400 PP_VALIDATION_FAILED` with `PP_GROUP_TOO_LARGE` (or reused M3 code, per implementation choice)
- [ ] 4 adults + hotel.maxOccupancy = 2 → same family of error

#### Customize — destination unreachable

- [ ] Day 2 in Mondulkiri, Day 3 in Koh Kong, no `transport_routes` row → `400 PP_VALIDATION_FAILED` with `PP_DESTINATION_UNREACHABLE` (or reused M3 code)

#### Customize — price mismatch

- [ ] Body claims `totalPriceUsd: 500` but server-computed total is `512.30` (delta > 1¢) → `400 PP_VALIDATION_FAILED` with `PP_PRICE_MISMATCH`, response includes `serverComputedTotalUsd: 512.30`
- [ ] Body claims `totalPriceUsd: 512.29` (within 1¢ of `512.30`) → `200` (within tolerance)

#### Customize — multiple failures aggregated

- [ ] Body violates pool, group capacity, AND price reconciliation simultaneously → `400 PP_VALIDATION_FAILED` with `failures: [...]` containing all three codes (not first-fail)

#### Idempotency

- [ ] `POST .../configurations` with `Idempotency-Key: smoke-1` → `200` with `configurationId: A`
- [ ] Same call with same `Idempotency-Key: smoke-1` → identical response, same `configurationId: A` (no duplicate row)
- [ ] Same call with different `Idempotency-Key: smoke-2` → new `configurationId: B`
- [ ] Postgres: `SELECT COUNT(*) FROM journey_configurations WHERE template_id = $TRIP_ID AND user_id = $USER` returns 2 (one per distinct key)

#### Template ownership / template state

- [ ] `POST .../configurations` against a soft-deleted template (`tripId` exists but `deletedAt IS NOT NULL`) → `409 PP_TEMPLATE_INACTIVE`
- [ ] `POST .../configurations` against a non-existent template → `404 PP_TEMPLATE_NOT_FOUND`

### Schema invariants (gating)

- [ ] Exactly 1 `JourneyConfiguration` row per successful (or idempotent-replay) call
- [ ] `JourneyConfiguration.userId` matches the authenticated user's `sub`
- [ ] `JourneyConfiguration.source = 'PRIVATE_PREBUILT'` for every M2 row
- [ ] `JourneyConfiguration.templateId` references the trip via FK
- [ ] `JourneyConfiguration.templateBasePriceUsd` matches `Trip.priceUsd` snapshot at config time
- [ ] `JourneyConfiguration.asIs` matches the request flag
- [ ] `JourneyConfiguration.daysSnapshot` is non-null and contains a valid `days[]` shape
- [ ] No `JourneyConfiguration` row created when validators fail (transactional rollback verified — try a body that fails reconciliation, then `SELECT COUNT(*)` is unchanged)

### Redis invariants (gating)

- [ ] `redis-cli KEYS 'pp_template:*'` shows the key after first template fetch
- [ ] `redis-cli TTL pp_template:$TRIP_ID` returns ~300
- [ ] `redis-cli GET pp_template:$TRIP_ID` returns valid JSON containing `pools`, `defaultJourneyMap`
- [ ] `redis-cli KEYS 'idem:m2-config:*'` shows entry after configurations call (TTL ~86400)
- [ ] `redis-cli KEYS 'availability_check:*'` shows entries during customization (TTL ~120)
- [ ] After a successful commit, `booking_hold:{bookingId}` exists with TTL ~900

### Doc updates (gating)

- [ ] `backend/context/specs/ERROR-REGISTRY.md` — all new codes documented:
  `PP_TEMPLATE_NOT_FOUND`, `PP_TEMPLATE_INACTIVE`, `PP_GROUP_SIZE_OUT_OF_BOUNDS`,
  `PP_OUTSIDE_POOL`, `PP_OUT_OF_DESTINATION_SCOPE`, `PP_DAY_MUTATION_INVALID`,
  `PP_DAY_EMPTY`, `PP_GROUP_TOO_LARGE`, `PP_TRAVEL_TIME_INVALID`,
  `PP_OUTSIDE_OPENING_HOURS`, `PP_DESTINATION_UNREACHABLE`, `PP_PRICE_MISMATCH`,
  `PP_VALIDATION_FAILED`, `PP_KID_UNFRIENDLY` (warning-only code), `PP_INVALID_BODY`
- [ ] `backend/context/specs/API-CONTRACT.md` § M2 — both endpoints documented with request/response examples (as-is + customize)
- [ ] `backend/context/specs/EVENT-CATALOG.md` — `booking.created` lists `'PRIVATE_PREBUILT'` as valid `method`; payload includes `asIs: boolean`
- [ ] `backend/context/specs/SCHEMA.md` — `JourneyConfiguration` columns `templateId`, `templateBasePriceUsd`, `asIs` documented

### Cross-method integration (gating — runs after `../journey-configurations/` and `../shared-foundation/` are landed)

- [ ] `POST /v1/availability/confirm { configurationId }` for an M2-source DRAFT config → `200` with `status: 'CONFIRMED'`, `expiresAt ~15 min`
- [ ] `POST /v1/bookings { configurationId }` for the CONFIRMED config → `201` with:
  - `data.method === 'PRIVATE_PREBUILT'`
  - `data.singleResourceKind === null`
  - `data.reference` matches `/^PRV-[A-Z2-7]{6}$/`
  - `data.items.length === sum of leaf resources across all days`
  - `data.holdExpiresAt` ~15 min from now
- [ ] `booking.created` event payload includes `method: 'PRIVATE_PREBUILT'`, `asIs: <bool>`, `configurationId`, full `items[]`
- [ ] Inventory drift on confirm → `409 CONFIG_INVENTORY_DRIFT` with `unavailable[]` and `alternatives[]`; configuration stays in `DRAFT`
- [ ] When `draftId` was supplied during configuration creation, after successful commit the `journey_drafts` row's `status` becomes `BOOKED`

---

## Manual Verification Script

```bash
# Pre-reqs:
#   - shared-foundation/ deployed locally (commit-booking, PRV- prefix support)
#   - journey-configurations/ deployed locally (config model, availability/check, availability/confirm, journey-drafts)
#   - build-from-scratch/ deployed locally (transport_routes, distanceKmTo columns)
#   - Phase 4 catalog seeded with at least one private template, including pools
#   - server running on :3001
#   - redis-cli + psql available

cd backend && npm run start:dev

TOKEN=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)

# Pick a private template seeded in Phase 4
TRIP_ID=$(psql "$DATABASE_URL" -t -c \
  "SELECT id FROM trips WHERE trip_type = 'PRIVATE' AND deleted_at IS NULL LIMIT 1;" | xargs)
echo "Using TRIP_ID=$TRIP_ID"

# === 1. Template fetch — happy path ===
curl -s "http://localhost:3001/v1/private-packages/$TRIP_ID/template" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expect: 200 with pools, defaultJourneyMap, basePriceUsd

# === 2. Template fetch — cache hit ===
# Repeat the same call; check Postgres logs to confirm no new SELECTs
psql "$DATABASE_URL" -c "SELECT now();"  # marker
curl -s -o /dev/null "http://localhost:3001/v1/private-packages/$TRIP_ID/template" \
  -H "Authorization: Bearer $TOKEN"
# Inspect Postgres log between markers — should be zero queries against trips/activities/etc.

redis-cli TTL "pp_template:$TRIP_ID"  # ~300

# === 3. Template fetch — bogus id ===
curl -s -i "http://localhost:3001/v1/private-packages/00000000-0000-0000-0000-000000000000/template" \
  -H "Authorization: Bearer $TOKEN"
# Expect: 404 PP_TEMPLATE_NOT_FOUND

# === 4. Configurations — as-is happy path ===
AS_IS_RESPONSE=$(curl -s -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-asis-1' \
  -d '{
    "asIs": true,
    "startDate": "2026-10-01",
    "travelers": { "adults": 2, "children": 1, "childrenAges": [8] }
  }')
echo "$AS_IS_RESPONSE" | jq .
AS_IS_CONFIG_ID=$(echo "$AS_IS_RESPONSE" | jq -r .data.configurationId)

# === 5. Configurations — as-is, group out of bounds ===
curl -s -i -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-asis-bounds' \
  -d '{
    "asIs": true,
    "startDate": "2026-10-01",
    "travelers": { "adults": 20 }
  }'
# Expect: 400 PP_VALIDATION_FAILED, failures contains PP_GROUP_SIZE_OUT_OF_BOUNDS

# === 6. Configurations — customize happy path ===
# (assemble a customize body — for the smoke test, fetch the template and modify one activity)
TEMPLATE=$(curl -s "http://localhost:3001/v1/private-packages/$TRIP_ID/template" \
  -H "Authorization: Bearer $TOKEN")

# Build days[] by mutating one activity per day from the pool. In practice, this is the
# frontend's job — for smoke testing, prepare a fixture file `customize-body.json`.

CUSTOMIZE_RESPONSE=$(curl -s -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-cust-1' \
  -d @customize-body.json)
echo "$CUSTOMIZE_RESPONSE" | jq .
CUSTOMIZE_CONFIG_ID=$(echo "$CUSTOMIZE_RESPONSE" | jq -r .data.configurationId)

# === 7. Configurations — pool violation ===
# Modify customize-body.json to set activities[0].resourceId to a guaranteed not-in-pool activity
curl -s -i -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-cust-pool' \
  -d @customize-body-pool-violation.json
# Expect: 400 PP_VALIDATION_FAILED, failures contains PP_OUTSIDE_POOL with dayNumber + resourceId

# === 8. Configurations — price mismatch ===
# Modify customize-body.json to set totalPriceUsd to a deliberately-wrong number
curl -s -i -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-cust-price' \
  -d @customize-body-price-mismatch.json
# Expect: 400 PP_VALIDATION_FAILED, failures contains PP_PRICE_MISMATCH with serverComputedTotalUsd

# === 9. Configurations — day mutation cap ===
# Modify customize-body.json to add 5 extra days to a 3-day template
curl -s -i -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-cust-mutation' \
  -d @customize-body-too-many-days.json
# Expect: 400 PP_VALIDATION_FAILED, failures contains PP_DAY_MUTATION_INVALID

# === 10. Idempotent retry ===
curl -s -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-asis-1' \
  -d '{
    "asIs": true,
    "startDate": "2026-10-01",
    "travelers": { "adults": 2, "children": 1, "childrenAges": [8] }
  }' | jq -r .data.configurationId
# Expect: same as $AS_IS_CONFIG_ID

# === 11. Confirm — freezes config ===
curl -s -X POST "http://localhost:3001/v1/availability/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-confirm-1' \
  -d "{\"configurationId\":\"$AS_IS_CONFIG_ID\"}" | jq .
# Expect: status: CONFIRMED, expiresAt ~15 min

# === 12. Commit — creates booking ===
BOOKING_RESPONSE=$(curl -s -X POST "http://localhost:3001/v1/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-book-1' \
  -d "{\"configurationId\":\"$AS_IS_CONFIG_ID\"}")
echo "$BOOKING_RESPONSE" | jq .
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | jq -r .data.id)

# === 13. Verify schema invariants ===
psql "$DATABASE_URL" -c \
  "SELECT method, single_resource_kind, configuration_id, reference, ais_is
   FROM bookings WHERE id = '$BOOKING_ID';"
# Expect: method = PRIVATE_PREBUILT, single_resource_kind = NULL,
#         reference matches PRV-XXXXXX, asIs = true (note: column probably persisted via metadata, confirm in shared-foundation)

psql "$DATABASE_URL" -c \
  "SELECT COUNT(*) AS item_count FROM booking_items WHERE booking_id = '$BOOKING_ID';"
# Expect: item_count = sum of leaf resources across all days

psql "$DATABASE_URL" -c \
  "SELECT source, template_id, template_base_price_usd, as_is, status
   FROM journey_configurations WHERE id = '$AS_IS_CONFIG_ID';"
# Expect: source = PRIVATE_PREBUILT, template_id = $TRIP_ID, as_is = true,
#         status = BOOKED (after commit)

# === 14. Hold + idempotency state ===
redis-cli TTL "booking_hold:$BOOKING_ID"             # ~900
redis-cli KEYS 'idem:m2-config:*'                    # shows entries
redis-cli KEYS 'availability_check:*'                # cached probes from customize phase
redis-cli KEYS 'pp_template:*'                       # template cache

# === 15. Cross-user template/config access — 403 ===
TOKEN_B=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)

curl -s -i "http://localhost:3001/v1/private-packages/$TRIP_ID/template" \
  -H "Authorization: Bearer $TOKEN_B"
# Expect: 200 — templates are public (any authenticated user can fetch any template)

curl -s -i -X POST "http://localhost:3001/v1/availability/confirm" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-confirm-cross' \
  -d "{\"configurationId\":\"$AS_IS_CONFIG_ID\"}"
# Expect: 403 CONFIG_NOT_AUTHOR (configurations ARE user-scoped — owned by journey-configurations/)

# === 16. As-is path with customize body fields rejected ===
curl -s -i -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-asis-extra' \
  -d '{
    "asIs": true,
    "startDate": "2026-10-01",
    "travelers": { "adults": 2 },
    "days": [],
    "totalPriceUsd": 450
  }'
# Expect: 400 PP_INVALID_BODY (extra-property rejection on as-is)

# === 17. Soft-deleted template ===
psql "$DATABASE_URL" -c "UPDATE trips SET deleted_at = now() WHERE id = '$TRIP_ID';"
redis-cli DEL "pp_template:$TRIP_ID"  # bust cache so loader hits DB

curl -s -i "http://localhost:3001/v1/private-packages/$TRIP_ID/template" \
  -H "Authorization: Bearer $TOKEN"
# Expect: 404 PP_TEMPLATE_NOT_FOUND

curl -s -i -X POST "http://localhost:3001/v1/private-packages/$TRIP_ID/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-asis-deleted' \
  -d '{
    "asIs": true,
    "startDate": "2026-10-01",
    "travelers": { "adults": 2 }
  }'
# Expect: 404 PP_TEMPLATE_NOT_FOUND or 409 PP_TEMPLATE_INACTIVE depending on how loader distinguishes
# Document the chosen distinction in implementation.

# Restore
psql "$DATABASE_URL" -c "UPDATE trips SET deleted_at = NULL WHERE id = '$TRIP_ID';"
```

---

## Definition of Done

- [ ] All "Build & static checks" pass
- [ ] All "Critical-path unit tests" pass (template-loader, as-is-materializer, 7 validators)
- [ ] All "DTO validation" rows verified (common, customize-only, as-is-only)
- [ ] All "Endpoint behaviour — template" rows verified (happy + cache hit + bogus + public-trip-rejected + soft-deleted)
- [ ] All "Endpoint behaviour — configurations (as-is)" rows verified
- [ ] All "Endpoint behaviour — configurations (customize)" rows verified
- [ ] Idempotency rows verified (same key → same config; different key → different config)
- [ ] All "Schema invariants" rows verified
- [ ] All "Redis invariants" rows verified
- [ ] All "Doc updates" rows verified
- [ ] All "Cross-method integration" rows verified (confirm + commit produce a `PRIVATE_PREBUILT` booking with `PRV-` reference; both `asIs: true` and `asIs: false` paths)
- [ ] `PROGRESS-TRACKER.md` ticks Phase 5b — Private Package row to 🟢
- [ ] PR description references this `validation.md` for the smoke evidence
