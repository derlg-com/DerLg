# Validation: M3 — Build From Scratch

> **Method:** M3
> **Endpoints under test:**
> - `POST /v1/trips/build-from-scratch/basics`
> - `GET /v1/trips/build-from-scratch/sessions/:sessionId`
> - `POST /v1/trips/build-from-scratch/configurations`
> - `POST /v1/journey-drafts`
> - `GET /v1/journey-drafts`
> - `GET /v1/journey-drafts/:draftId`
> - `DELETE /v1/journey-drafts/:draftId`
>
> **Branch:** TBD (Phase 5c follow-up — NOT this branch)
> **Phase:** 5c — Build From Scratch
> **Date:** 2026-05-25

This validates **only** the M3 surface. Foundation-level checks (`commit-booking` primitive, hold key, idempotency, refund tiers, reference generator, `POST /v1/bookings`) are validated in `../shared-foundation/validation.md`. The shared `POST /v1/availability/check` and `POST /v1/availability/confirm` endpoints are validated in `../journey-configurations/validation.md` — this file only verifies that an M3-sourced `JourneyConfiguration` flows through them correctly.

---

## Verification Criteria

### Build & static checks (gating)

- [ ] `npm run lint` — zero errors / zero warnings
- [ ] `npm run build` — TypeScript compiles
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx prisma generate` — Prisma client regenerated after `journey_drafts` migration
- [ ] `npx prisma migrate status` — `add_journey_drafts` migration applied cleanly

### Critical-path unit tests (gating)

- [ ] `npm test -- src/modules/build-from-scratch/utils/skeleton-generator.util.spec.ts` — all 6 cases pass:
  - (a) deterministic: same input → same output
  - (b) destinations clamped when `destinations.length > durationDays`
  - (c) `kidFriendly` filter applied when `children > 0`
  - (d) hotel persists across consecutive same-destination days
  - (e) inter-city day adds a transport line item
  - (f) `estimatedTotalUsd ≤ budgetUsd × 1.1`
- [ ] `npm test -- src/modules/build-from-scratch/validators` — all 6 validator spec files pass

### DTO validation — basics endpoint (gating — manual)

> Use `curl -i` to inspect status code and response body. `TOKEN` comes from a successful login.

- [ ] `startDate` missing → `400 BFS_INVALID_BASICS`
- [ ] `startDate` in the past (today or earlier) → `400 BFS_INVALID_BASICS`
- [ ] `endDate < startDate` → `400 BFS_INVALID_DURATION`
- [ ] `endDate - startDate > 30` days → `400 BFS_INVALID_DURATION`
- [ ] `travelers.adults < 1` → `400 BFS_INVALID_BASICS`
- [ ] `travelers.adults + travelers.children > 20` → `400 BFS_INVALID_BASICS`
- [ ] `travelers.childrenAges.length !== travelers.children` → `400 BFS_INVALID_BASICS`
- [ ] `travelers.childrenAges` contains a value `> 17` or `< 0` → `400 BFS_INVALID_BASICS`
- [ ] `tripStyle` not in enum → `400 BFS_INVALID_BASICS`
- [ ] `budgetUsd < 100` → `400 BFS_INVALID_BASICS`
- [ ] `languages` empty array → `400 BFS_INVALID_BASICS`
- [ ] `destinations` empty or `> 5` → `400 BFS_INVALID_BASICS`
- [ ] `mustSee.length > 10` → `400 BFS_INVALID_BASICS`

### DTO validation — configurations endpoint (gating — manual)

- [ ] `sessionId` missing → `400 BFS_INVALID_BASICS`
- [ ] `sessionId` not a UUID → `400 BFS_INVALID_BASICS`
- [ ] `days` empty array → `400 BFS_INVALID_BASICS`
- [ ] `days[i].dayNumber` non-sequential (e.g. 1, 2, 4) → `400 BFS_INVALID_BASICS`
- [ ] `totalPriceUsd` missing or negative → `400 BFS_INVALID_BASICS`

### DTO validation — journey-drafts (gating — manual)

- [ ] `title` missing or `> 120` chars → `400`
- [ ] `source` not in enum → `400`
- [ ] `days` empty → `400`

### Endpoint behaviour (gating — manual)

#### Happy path — basics → skeleton

- [ ] `POST /v1/trips/build-from-scratch/basics` with valid body → `200` with:
  - `data.sessionId` matches UUID v4 regex
  - `data.generatedSkeleton.durationDays === endDate - startDate + 1`
  - `data.generatedSkeleton.days.length === durationDays`
  - `data.generatedSkeleton.days[i].dayNumber === i + 1`
  - `data.generatedSkeleton.days[i].date === startDate + (i days)`
  - `data.generatedSkeleton.estimatedTotalUsd ≤ budgetUsd × 1.1`
  - `data.generatedSkeleton.estimatedBreakdown` keys: `activitiesUsd`, `hotelsUsd`, `transportUsd`, `guidesUsd`, `mealsUsd` — all numbers ≥ 0
  - Day 1 theme is `"Arrival & Orientation"` or `"Discovery"`
  - Last day theme is `"Farewell & Departure"`

#### Determinism

- [ ] Same body, two consecutive calls → both responses produce identical `generatedSkeleton` (excluding `sessionId`). Compare with `jq 'del(.data.sessionId)'`.

#### Get-session

- [ ] `GET /v1/trips/build-from-scratch/sessions/:sessionId` with the sessionId from above → `200` with the same `generatedSkeleton`
- [ ] `GET .../sessions/<bogus-uuid>` → `404 BFS_SESSION_NOT_FOUND`
- [ ] User B calls `GET .../sessions/<user-A-sessionId>` → `403 BFS_SESSION_NOT_AUTHOR`
- [ ] After 24h (or after `redis-cli DEL bfs_session:<id>`) → `404 BFS_SESSION_NOT_FOUND`

#### Configurations — happy path

- [ ] `POST /v1/trips/build-from-scratch/configurations` with a valid days[] body → `200` with:
  - `data.configurationId` is a UUID
  - `data.status === 'DRAFT'`
  - `data.expiresAt` is ~1h from now
  - `data.totalPriceUsd === sum(days[i].totalPriceUsd)`
  - `data.itemBreakdown` matches the `estimatedBreakdown` shape

#### Configurations — validator failures

- [ ] `BudgetCapValidator`: `sum(day.totalPriceUsd) > budgetUsd` → `400 BFS_VALIDATION_FAILED` with `failures: [{ code: 'BFS_BUDGET_EXCEEDED', ... }]`
- [ ] `TravelTimeValidator`: two activities scheduled 30 minutes apart but 60 km between them → `400 BFS_VALIDATION_FAILED` with `failures: [{ code: 'BFS_TRAVEL_TIME_INVALID', dayNumber, activityId, ... }]`
- [ ] `OpeningHoursValidator`: activity startTime `06:00` but venue opens `09:00` → `400 BFS_VALIDATION_FAILED` with `failures: [{ code: 'BFS_OUTSIDE_OPENING_HOURS', ... }]`
- [ ] `GroupSizeValidator`: 6 adults + transport.capacity = 4 → `400 BFS_VALIDATION_FAILED` with `failures: [{ code: 'BFS_GROUP_TOO_LARGE', ... }]`
- [ ] `GroupSizeValidator`: 4 adults + hotel.maxOccupancy = 2 → `400 BFS_VALIDATION_FAILED` with `BFS_GROUP_TOO_LARGE`
- [ ] `DestinationReachableValidator`: Day 2 in Mondulkiri, Day 3 in Koh Kong, no transport_routes row → `400 BFS_VALIDATION_FAILED` with `BFS_DESTINATION_UNREACHABLE`
- [ ] `DurationValidator`: 31-day span → `400 BFS_VALIDATION_FAILED` with `BFS_INVALID_DURATION`
- [ ] Multiple failures in same request → response includes `failures[]` with all codes (aggregated, not first-fail)
- [ ] Warnings (`ActivityKidFriendlyValidator`, `MealCoverageValidator`) surface in `warnings[]` but do **not** block — request still returns `200` with the warnings array

#### Session ownership on configurations

- [ ] User B submits configurations with User A's sessionId → `403 BFS_SESSION_NOT_AUTHOR`
- [ ] Expired sessionId → `404 BFS_SESSION_NOT_FOUND`

#### Journey-drafts CRUD

- [ ] `POST /v1/journey-drafts` with valid body → `201` with `{ draftId, createdAt, updatedAt }`
- [ ] `POST /v1/journey-drafts` with same `Idempotency-Key` → identical response, same `draftId`
- [ ] `GET /v1/journey-drafts` → paginated list, only own drafts (verify by inserting one for User B and confirming it does NOT appear)
- [ ] `GET /v1/journey-drafts?status=OPEN` → filters correctly
- [ ] `GET /v1/journey-drafts?source=BUILD_FROM_SCRATCH` → filters correctly
- [ ] `GET /v1/journey-drafts/:draftId` for own draft → `200`
- [ ] `GET /v1/journey-drafts/:draftId` for another user's draft → `403 DRAFT_NOT_AUTHOR`
- [ ] `GET /v1/journey-drafts/<bogus-uuid>` → `404 DRAFT_NOT_FOUND`
- [ ] `DELETE /v1/journey-drafts/:draftId` → `204`, row has `deletedAt` set
- [ ] `GET /v1/journey-drafts/:draftId` after delete → `404 DRAFT_NOT_FOUND`
- [ ] `DELETE` on another user's draft → `403 DRAFT_NOT_AUTHOR`

#### Configurations + draftId linkage

- [ ] `POST /v1/trips/build-from-scratch/configurations` with `draftId` set → on success, the draft row's `status` becomes `BOOKED`
- [ ] If validators fail, draft `status` stays `OPEN` (best-effort, not gating)

#### Performance smoke (informational)

- [ ] `time curl -X POST .../basics` for a typical 4-day, 2-destination input → < 500 ms wall clock (informational; not a CI gate)

### Schema invariants (gating)

- [ ] Exactly 1 `JourneyDraft` row per `POST /v1/journey-drafts` call
- [ ] `JourneyDraft.userId` matches the authenticated user's `sub`
- [ ] `JourneyDraft.expiresAt === updatedAt + 30 days`
- [ ] `JourneyDraft.deletedAt` set on `DELETE`, never returned in list/get queries
- [ ] `JourneyConfiguration.source = 'BUILD_FROM_SCRATCH'` for every M3-originated config
- [ ] No `JourneyConfiguration` row created when validators fail (transactional rollback verified)

### Redis invariants (gating)

- [ ] `redis-cli KEYS 'bfs_session:*'` shows new key after basics submission
- [ ] `redis-cli TTL bfs_session:<id>` returns ~86400
- [ ] `redis-cli GET bfs_session:<id>` returns JSON containing `userId`, `basics`, `skeleton`
- [ ] `redis-cli KEYS 'availability_check:*'` shows entries during customization (TTL ~120)

### Doc updates (gating)

- [ ] `backend/context/specs/ERROR-REGISTRY.md` — all new codes documented: 
  `BFS_INVALID_DURATION`, `BFS_INVALID_BASICS`, `BFS_SESSION_NOT_FOUND`, `BFS_SESSION_NOT_AUTHOR`,
  `BFS_BUDGET_EXCEEDED`, `BFS_TRAVEL_TIME_INVALID`, `BFS_OUTSIDE_OPENING_HOURS`,
  `BFS_GROUP_TOO_LARGE`, `BFS_DESTINATION_UNREACHABLE`, `BFS_VALIDATION_FAILED`,
  `DRAFT_NOT_FOUND`, `DRAFT_NOT_AUTHOR`,
  `CONFIG_NOT_FOUND`, `CONFIG_EXPIRED`, `CONFIG_INVENTORY_DRIFT`
- [ ] `backend/context/specs/API-CONTRACT.md` § M3 — all 7 endpoints documented with request/response examples
- [ ] `backend/context/specs/EVENT-CATALOG.md` — `journey_draft.created`, `configuration.created`, `configuration.confirmed` added; `booking.created` lists `BUILD_FROM_SCRATCH` as a valid `method`

### Cross-method integration (gating — runs after `../journey-configurations/` and `../shared-foundation/` are landed)

- [ ] `POST /v1/availability/confirm { configurationId }` for an M3-source DRAFT config → `200` with `status: 'CONFIRMED'`, `expiresAt ~15 min`
- [ ] `POST /v1/bookings { configurationId }` for the CONFIRMED config → `201` with:
  - `data.method === 'BUILD_FROM_SCRATCH'`
  - `data.singleResourceKind === null`
  - `data.reference` matches `/^CSM-[A-Z2-7]{6}$/`
  - `data.items.length === sum of leaf resources across all days`
  - `data.holdExpiresAt` ~15 min from now
- [ ] `booking.created` event payload includes `method: 'BUILD_FROM_SCRATCH'`, `configurationId`, full `items[]`
- [ ] Inventory drift on confirm → `409 CONFIG_INVENTORY_DRIFT` with `unavailable[]` and `alternatives[]` populated; configuration stays in `DRAFT` until alternatives accepted

---

## Manual Verification Script

```bash
# Pre-reqs:
#   - shared-foundation/ deployed locally
#   - journey-configurations/ deployed locally
#   - Phase 4 catalog seeded (activities, hotels, vehicles, guides, transport_routes)
#   - server running on :3001
#   - redis-cli + psql available

cd backend && npm run start:dev

TOKEN=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)

# === 1. Basics — happy path ===
BASICS_RESPONSE=$(curl -s -X POST "http://localhost:3001/v1/trips/build-from-scratch/basics" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate":"2026-10-01",
    "endDate":"2026-10-04",
    "travelers":{"adults":2,"children":1,"childrenAges":[8]},
    "tripStyle":"FAMILY",
    "budgetUsd":1500,
    "languages":["en"],
    "destinations":["Siem Reap","Phnom Penh"],
    "mustSee":["Angkor Wat"]
  }')
echo "$BASICS_RESPONSE" | jq .
SESSION_ID=$(echo "$BASICS_RESPONSE" | jq -r .data.sessionId)

# === 2. Determinism — same input twice, identical skeleton ===
SKEL_1=$(echo "$BASICS_RESPONSE" | jq '.data.generatedSkeleton')
SKEL_2=$(curl -s -X POST "http://localhost:3001/v1/trips/build-from-scratch/basics" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate":"2026-10-01","endDate":"2026-10-04",
    "travelers":{"adults":2,"children":1,"childrenAges":[8]},
    "tripStyle":"FAMILY","budgetUsd":1500,
    "languages":["en"],
    "destinations":["Siem Reap","Phnom Penh"],
    "mustSee":["Angkor Wat"]
  }' | jq '.data.generatedSkeleton')
diff <(echo "$SKEL_1") <(echo "$SKEL_2")  # expect: no output

# === 3. Get-session — resume ===
curl -s "http://localhost:3001/v1/trips/build-from-scratch/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# === 4. Get-session — bogus id ===
curl -s -i "http://localhost:3001/v1/trips/build-from-scratch/sessions/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN"
# Expect: 404 BFS_SESSION_NOT_FOUND

# === 5. Save draft ===
DRAFT_RESPONSE=$(curl -s -X POST "http://localhost:3001/v1/journey-drafts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-draft-1' \
  -d "{
    \"sessionId\":\"$SESSION_ID\",
    \"source\":\"BUILD_FROM_SCRATCH\",
    \"title\":\"Family Cambodia 4-day\",
    \"startDate\":\"2026-10-01\",
    \"endDate\":\"2026-10-04\",
    \"travelers\":{\"adults\":2,\"children\":1,\"childrenAges\":[8]},
    \"budgetUsd\":1500,
    \"totalPriceUsd\":1280,
    \"days\":[ /* full day-by-day shape, copy from skeleton */ ]
  }")
echo "$DRAFT_RESPONSE" | jq .
DRAFT_ID=$(echo "$DRAFT_RESPONSE" | jq -r .data.draftId)

# === 6. Idempotent retry — same draftId ===
curl -s -X POST "http://localhost:3001/v1/journey-drafts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-draft-1' \
  -d "{ ... same body ... }" | jq -r .data.draftId
# Expect: same DRAFT_ID

# === 7. List drafts ===
curl -s "http://localhost:3001/v1/journey-drafts?status=OPEN" \
  -H "Authorization: Bearer $TOKEN" | jq .

# === 8. Get draft ===
curl -s "http://localhost:3001/v1/journey-drafts/$DRAFT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# === 9. Configurations — happy path ===
CONFIG_RESPONSE=$(curl -s -X POST "http://localhost:3001/v1/trips/build-from-scratch/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\":\"$SESSION_ID\",
    \"draftId\":\"$DRAFT_ID\",
    \"days\":[ /* customized days[] */ ],
    \"totalPriceUsd\":1280
  }")
echo "$CONFIG_RESPONSE" | jq .
CONFIG_ID=$(echo "$CONFIG_RESPONSE" | jq -r .data.configurationId)

# === 10. Configurations — budget exceeded ===
curl -s -i -X POST "http://localhost:3001/v1/trips/build-from-scratch/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\":\"$SESSION_ID\",
    \"days\":[ /* days[] with totalPriceUsd > budgetUsd */ ],
    \"totalPriceUsd\":2500
  }"
# Expect: 400 BFS_VALIDATION_FAILED, failures contains BFS_BUDGET_EXCEEDED

# === 11. Configurations — group too large ===
curl -s -i -X POST "http://localhost:3001/v1/trips/build-from-scratch/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{ /* travelers.adults=6 with transport.capacity=4 */ }"
# Expect: 400 BFS_VALIDATION_FAILED, failures contains BFS_GROUP_TOO_LARGE

# === 12. Confirm — freezes config ===
curl -s -X POST "http://localhost:3001/v1/availability/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-confirm-1' \
  -d "{\"configurationId\":\"$CONFIG_ID\"}" | jq .
# Expect: status: CONFIRMED, expiresAt ~15 min

# === 13. Commit — creates booking ===
BOOKING_RESPONSE=$(curl -s -X POST "http://localhost:3001/v1/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-book-1' \
  -d "{\"configurationId\":\"$CONFIG_ID\"}")
echo "$BOOKING_RESPONSE" | jq .
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | jq -r .data.id)

# === 14. Verify schema invariants ===
psql "$DATABASE_URL" -c \
  "SELECT method, single_resource_kind, configuration_id, reference
   FROM bookings WHERE id = '$BOOKING_ID';"
# Expect: method = BUILD_FROM_SCRATCH, single_resource_kind = NULL,
#         reference matches CSM-XXXXXX

psql "$DATABASE_URL" -c \
  "SELECT COUNT(*) AS item_count FROM booking_items WHERE booking_id = '$BOOKING_ID';"
# Expect: item_count = sum of leaf resources across all days

psql "$DATABASE_URL" -c \
  "SELECT status, expires_at FROM journey_drafts WHERE id = '$DRAFT_ID';"
# Expect: status = BOOKED

# === 15. Hold + idempotency state ===
redis-cli TTL "booking_hold:$BOOKING_ID"             # ~900
redis-cli TTL "bfs_session:$SESSION_ID"              # ~86400
redis-cli KEYS 'idem:booking:*'                       # shows the entry
redis-cli KEYS 'availability_check:*'                 # shows cached probes

# === 16. Delete draft ===
curl -s -i -X DELETE "http://localhost:3001/v1/journey-drafts/$DRAFT_ID" \
  -H "Authorization: Bearer $TOKEN"
# Expect: 204

curl -s -i "http://localhost:3001/v1/journey-drafts/$DRAFT_ID" \
  -H "Authorization: Bearer $TOKEN"
# Expect: 404 DRAFT_NOT_FOUND

psql "$DATABASE_URL" -c \
  "SELECT deleted_at FROM journey_drafts WHERE id = '$DRAFT_ID';"
# Expect: deleted_at IS NOT NULL

# === 17. Cross-user ownership — 403 ===
TOKEN_B=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)

curl -s -i "http://localhost:3001/v1/journey-drafts/$DRAFT_ID" \
  -H "Authorization: Bearer $TOKEN_B"
# Expect: 403 DRAFT_NOT_AUTHOR (or 404 if you've already deleted — re-create for this test)

curl -s -i "http://localhost:3001/v1/trips/build-from-scratch/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN_B"
# Expect: 403 BFS_SESSION_NOT_AUTHOR
```

---

## Definition of Done

- [ ] All "Build & static checks" pass
- [ ] All "Critical-path unit tests" pass (skeleton-generator + 6 validators)
- [ ] All "DTO validation" rows verified for basics, configurations, journey-drafts
- [ ] All "Endpoint behaviour" rows verified (basics, get-session, configurations, drafts CRUD, validator failures)
- [ ] All "Schema invariants" rows verified
- [ ] All "Redis invariants" rows verified
- [ ] All "Doc updates" rows verified
- [ ] All "Cross-method integration" rows verified (confirm + commit produce a `BUILD_FROM_SCRATCH` booking with `CSM-` reference)
- [ ] `PROGRESS-TRACKER.md` ticks Phase 5c row to 🟢
- [ ] PR description references this `validation.md` for the smoke evidence
