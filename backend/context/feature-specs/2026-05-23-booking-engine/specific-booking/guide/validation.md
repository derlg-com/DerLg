# Validation: M4c — Guide Booking

> **Sub-method:** M4c
> **Endpoint:** `POST /v1/guides/:guideId/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking

This validates **only** the M4c endpoint. Foundation-level checks (overlap util, refund util, hold key, idempotency) are validated in `../shared-foundation/validation.md`.

---

## Verification Criteria

### Build & static checks (gating)

- [ ] `npm run lint` — zero errors / zero warnings
- [ ] `npm run build` — TypeScript compiles
- [ ] `npx tsc --noEmit` — zero type errors

### DTO validation (gating — manual)

- [ ] `:guideId` malformed UUID → `400 BKNG_INVALID_INPUT` (from `ParseUUIDPipe`)
- [ ] `startDate` malformed → `400 BKNG_INVALID_INPUT`
- [ ] `endDate` malformed → `400 BKNG_INVALID_INPUT`
- [ ] `endDate < startDate` → `400 BKNG_INVALID_DATE_RANGE`
- [ ] `endDate === startDate` → `201` (same-day allowed, charged as 1 day)
- [ ] `linkedTripBookingId` malformed → `400 BKNG_INVALID_INPUT`
- [ ] `specialRequests.length > 1000` → `400 BKNG_INVALID_INPUT`

### Endpoint behaviour (gating — manual)

#### Happy path — standalone (no linked trip)

- [ ] `POST /v1/guides/:guideId/bookings` against an `ACTIVE` guide → `201` with:
  - `data.status === 'HOLD'`
  - `data.method === 'SINGLE_RESOURCE'`
  - `data.singleResourceKind === 'GUIDE'`
  - `data.reference` matches `/^GDE-[A-Z2-7]{6}$/`
  - `data.holdExpiresAt` is ~15 min from now
  - `data.items.length === 1`
  - `data.items[0].itemType === 'GUIDE'`
  - `data.items[0].snapshot` contains `guideId, name, languages, specialties, location, isVerified, pricePerDayUsd, days, linkedTripBookingId: null`
  - `data.items[0].snapshot` does **not** contain `phone` or `email`
  - `data.totalPriceUsd === guide.pricePerDayUsd × days`

#### Happy path — with linked trip booking

- [ ] First book a single-trip booking (M4d) for dates D1–D5 → save `TRIP_BOOKING_ID`
- [ ] Then book the guide for dates D2–D4 with `linkedTripBookingId: TRIP_BOOKING_ID` → `201`
- [ ] `data.items[0].snapshot.linkedTripBookingId === TRIP_BOOKING_ID`

#### Resource state

- [ ] Guide does not exist → `404 GDE_NOT_FOUND`
- [ ] Guide soft-deleted → `404 GDE_NOT_FOUND`
- [ ] Guide `status: INACTIVE` → `403 GDE_INACTIVE`
- [ ] Guide `status: SUSPENDED` → `403 GDE_SUSPENDED`

#### Linked trip validation

- [ ] `linkedTripBookingId` does not exist → `400 GDE_INVALID_TRIP_LINK`
- [ ] `linkedTripBookingId` belongs to a different user → `400 GDE_INVALID_TRIP_LINK`
- [ ] `linkedTripBookingId` is `CANCELLED` → `400 GDE_INVALID_TRIP_LINK`
- [ ] `linkedTripBookingId` is `EXPIRED` → `400 GDE_INVALID_TRIP_LINK`
- [ ] `linkedTripBookingId` is a hotel booking (not a trip) → `400 GDE_INVALID_TRIP_LINK`
- [ ] Guide dates extend past the linked trip's dates → `400 GDE_INVALID_TRIP_LINK`
- [ ] Guide startDate before linked trip's startDate → `400 GDE_INVALID_TRIP_LINK`

#### Concurrency

- [ ] Two consecutive bookings on same `guideId` with overlapping dates → second returns `409 BKNG_UNAVAILABLE`
- [ ] Two bookings on same `guideId` with adjacent (non-overlapping) dates → both `201`

#### Idempotency

- [ ] Same `Idempotency-Key` retry → identical response body, same booking `id`

#### Side effects

- [ ] `redis-cli KEYS 'booking_hold:*'` shows the new id
- [ ] `redis-cli TTL booking_hold:<id>` returns ~900
- [ ] `booking.created` event emitted with `method: 'SINGLE_RESOURCE'`, `singleResourceKind: 'GUIDE'`

### Schema invariants (gating)

- [ ] Exactly 1 `BookingItem` row inserted with `itemType = 'GUIDE'`
- [ ] `BookingItem.subtotalUsd === Booking.totalPriceUsd`
- [ ] `BookingItem.snapshot.linkedTripBookingId` is `null` or a valid UUID string
- [ ] `BookingItem.snapshot` does not leak `phone`, `email`, `userId`, or `bio` fields

### Doc updates (gating)

- [ ] `backend/context/specs/ERROR-REGISTRY.md` — `GDE_INACTIVE`, `GDE_SUSPENDED`, `GDE_INVALID_TRIP_LINK` confirmed/added
- [ ] `backend/context/specs/API-CONTRACT.md` § 11 — `POST /v1/guides/:guideId/bookings` documented with `linkedTripBookingId` semantics

---

## Manual Verification Script

```bash
cd backend && npm run start:dev

TOKEN_A=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)
TOKEN_B=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)

GUIDE_ID=<active-guide-uuid>
SUSPENDED_GUIDE_ID=<suspended-guide-uuid>
INACTIVE_GUIDE_ID=<inactive-guide-uuid>
TRIP_ID=<trip-uuid>

# === Happy path — standalone ===
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-gde-1' \
  -d '{
    "startDate":"2026-08-01",
    "endDate":"2026-08-03",
    "specialRequests":"Mandarin tour please, vegetarian lunch"
  }' | jq .

# === Happy path — linked to trip booking ===
# First create a trip booking spanning a wider range
TRIP_BOOKING=$(curl -s -X POST "http://localhost:3001/v1/trips/$TRIP_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-trp-for-link' \
  -d '{
    "startDate":"2026-09-01",
    "travelers":{"adults":2}
  }')
TRIP_BOOKING_ID=$(echo "$TRIP_BOOKING" | jq -r .data.id

# Now book the guide for a subset of those dates
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-gde-linked-1' \
  -d "{
    \"startDate\":\"2026-09-02\",
    \"endDate\":\"2026-09-03\",
    \"linkedTripBookingId\":\"$TRIP_BOOKING_ID\"
  }" | jq '.data.items[0].snapshot.linkedTripBookingId'

# === Inactive guide — 403 GDE_INACTIVE ===
curl -s -X POST "http://localhost:3001/v1/guides/$INACTIVE_GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-08-10","endDate":"2026-08-11"}' -i

# === Suspended guide — 403 GDE_SUSPENDED ===
curl -s -X POST "http://localhost:3001/v1/guides/$SUSPENDED_GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-08-10","endDate":"2026-08-11"}' -i

# === Linked trip belongs to another user — 400 GDE_INVALID_TRIP_LINK ===
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d "{
    \"startDate\":\"2026-09-02\",
    \"endDate\":\"2026-09-03\",
    \"linkedTripBookingId\":\"$TRIP_BOOKING_ID\"
  }" -i

# === Linked trip dates don't contain guide range — 400 GDE_INVALID_TRIP_LINK ===
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{
    \"startDate\":\"2026-08-30\",
    \"endDate\":\"2026-09-05\",
    \"linkedTripBookingId\":\"$TRIP_BOOKING_ID\"
  }" -i

# === Overlap — 409 BKNG_UNAVAILABLE ===
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-08-02","endDate":"2026-08-04"}' -i

# === Bad date range — 400 BKNG_INVALID_DATE_RANGE ===
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-08-05","endDate":"2026-08-04"}' -i

# === Verify schema invariant ===
psql "$DATABASE_URL" -c \
  "SELECT b.reference, COUNT(bi.id) AS items, bi.snapshot ? 'phone' AS leaks_phone
   FROM bookings b
   JOIN booking_items bi ON bi.booking_id = b.id
   WHERE b.method = 'SINGLE_RESOURCE'
     AND b.single_resource_kind = 'GUIDE'
   GROUP BY b.id, bi.snapshot
   HAVING COUNT(bi.id) <> 1 OR bi.snapshot ? 'phone';"
# Expect 0 rows.
```

---

## Definition of Done

- [ ] All "Build & static checks" pass
- [ ] All "DTO validation" rows verified
- [ ] All "Endpoint behaviour" rows verified (especially the 7 linked-trip validation rows)
- [ ] All "Schema invariants" rows verified
- [ ] All "Doc updates" rows verified
- [ ] `PROGRESS-TRACKER.md` ticks Phase 5a — M4c row to 🟢
- [ ] PR description references this `validation.md` for the smoke evidence
