# Validation: M4d — Single Trip Booking (As-Is)

> **Sub-method:** M4d
> **Endpoint:** `POST /v1/trips/:tripId/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking

This validates **only** the M4d endpoint. Foundation-level checks (overlap util, refund util, hold key, idempotency) are validated in `../shared-foundation/validation.md`.

---

## Verification Criteria

### Build & static checks (gating)

- [ ] `npm run lint` — zero errors / zero warnings
- [ ] `npm run build` — TypeScript compiles
- [ ] `npx tsc --noEmit` — zero type errors

### DTO validation (gating — manual)

- [ ] `:tripId` malformed UUID → `400 BKNG_INVALID_INPUT` (from `ParseUUIDPipe`)
- [ ] `startDate` malformed → `400 BKNG_INVALID_INPUT`
- [ ] `travelers` missing → `400 BKNG_INVALID_INPUT`
- [ ] `travelers.adults === 0` → `400 BKNG_INVALID_INPUT`
- [ ] `travelers.adults` missing → `400 BKNG_INVALID_INPUT`
- [ ] `travelers.children < 0` → `400 BKNG_INVALID_INPUT`
- [ ] `travelers.children` is a non-integer → `400 BKNG_INVALID_INPUT`
- [ ] `specialRequests.length > 1000` → `400 BKNG_INVALID_INPUT`

### Endpoint behaviour (gating — manual)

#### Happy path — adults only

- [ ] `POST /v1/trips/:tripId/bookings` against an `ACTIVE` 1-day trip with `{ startDate: '2026-09-01', travelers: { adults: 2 } }` → `201` with:
  - `data.status === 'HOLD'`
  - `data.method === 'SINGLE_RESOURCE'`
  - `data.singleResourceKind === 'TRIP'`
  - `data.reference` matches `/^TRP-[A-Z2-7]{6}$/`
  - `data.holdExpiresAt` is ~15 min from now
  - `data.items.length === 1`
  - `data.items[0].itemType === 'TRIP'`
  - `data.items[0].startDate === '2026-09-01'`
  - `data.items[0].endDate === '2026-09-01'` (1-day trip)
  - `data.items[0].quantity === 2`
  - `data.totalPriceUsd === trip.priceUsd × 2`
  - `data.items[0].snapshot.itinerarySnapshot` contains the trip's full `translations` payload

#### Happy path — adults + children

- [ ] Same trip with `{ travelers: { adults: 2, children: 1 } }` → `201`:
  - `data.totalPriceUsd === trip.priceUsd × 3` (no child discount in MVP)
  - `data.items[0].quantity === 3`
  - `data.items[0].snapshot.travelersAdults === 2`
  - `data.items[0].snapshot.travelersChildren === 1`
  - `data.items[0].snapshot.totalTravelers === 3`

#### Happy path — multi-day trip

- [ ] Book a 3-day trip with `startDate: '2026-09-01'` → `data.items[0].endDate === '2026-09-03'`
- [ ] Book a 5-day trip with `startDate: '2026-10-15'` → `data.items[0].endDate === '2026-10-19'`

#### Date validation

- [ ] `startDate` in the past → `400 BKNG_INVALID_DATE_RANGE`
- [ ] `startDate === today` → `201` (today is allowed)
- [ ] `startDate` in the future → `201`

#### Resource state

- [ ] Trip does not exist → `404 TRIP_NOT_FOUND`
- [ ] Trip soft-deleted → `404 TRIP_NOT_FOUND`
- [ ] Trip `status: INACTIVE` → `404 TRIP_NOT_FOUND`
- [ ] Trip `status: DRAFT` → `404 TRIP_NOT_FOUND`

#### Guest cap

- [ ] `adults === trip.maxGuests, children === 0` → `201` (boundary)
- [ ] `adults + children === trip.maxGuests` → `201` (boundary)
- [ ] `adults + children === trip.maxGuests + 1` → `400 BKNG_EXCEEDS_GUESTS`
- [ ] `adults > trip.maxGuests` → `400 BKNG_EXCEEDS_GUESTS`

#### Same-user overlap

- [ ] User A books trip T on `2026-09-01` (3-day) → `201`
- [ ] User A books trip T on `2026-09-02` (3-day, overlaps) → `409 BKNG_UNAVAILABLE`
- [ ] User A books trip T on `2026-09-04` (3-day, adjacent) → `201` (no overlap)
- [ ] User B books trip T on `2026-09-01` → `201` (different user, no per-date capacity in MVP)

#### Idempotency

- [ ] Same `Idempotency-Key` retry → identical response body, same booking `id`

#### Side effects

- [ ] `redis-cli KEYS 'booking_hold:*'` shows the new id
- [ ] `redis-cli TTL booking_hold:<id>` returns ~900
- [ ] `booking.created` event emitted with `method: 'SINGLE_RESOURCE'`, `singleResourceKind: 'TRIP'`

### Schema invariants (gating)

- [ ] Exactly 1 `BookingItem` row inserted with `itemType = 'TRIP'`
- [ ] `BookingItem.subtotalUsd === Booking.totalPriceUsd`
- [ ] `BookingItem.endDate - BookingItem.startDate === (trip.durationDays - 1) days`
- [ ] `BookingItem.snapshot.itinerarySnapshot` is non-null and matches `trip.translations` at booking time
- [ ] `BookingItem.snapshot.cancellationPolicySnapshot` is non-empty

### Itinerary freezing test (gating)

> Verifies Decision #6 — snapshot freezes the itinerary at booking time.

- [ ] Book trip T → save `BOOKING_ID` and the booking's `itinerarySnapshot`
- [ ] Have admin edit `T.translations.en.itinerary_days[0].title` to a new value
- [ ] `GET /v1/bookings/:BOOKING_ID` → response's `itinerarySnapshot` still shows the original title (not the new one)

### Doc updates (gating)

- [ ] `backend/context/specs/ERROR-REGISTRY.md` — `BKNG_EXCEEDS_GUESTS` added
- [ ] `backend/context/specs/API-CONTRACT.md` § 11 — `POST /v1/trips/:tripId/bookings` documented with `endDate` derivation rule and `itinerarySnapshot` shape

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

ONE_DAY_TRIP=<1-day-active-trip-uuid>
THREE_DAY_TRIP=<3-day-active-trip-uuid>
INACTIVE_TRIP=<inactive-trip-uuid>
DRAFT_TRIP=<draft-trip-uuid>

# === Happy path — 1-day trip, 2 adults ===
curl -s -X POST "http://localhost:3001/v1/trips/$ONE_DAY_TRIP/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-trp-1' \
  -d '{
    "startDate":"2026-09-01",
    "travelers":{"adults":2}
  }' | jq '{ id: .data.id, ref: .data.reference, start: .data.items[0].startDate, end: .data.items[0].endDate, total: .data.totalPriceUsd }'

# === Happy path — 3-day trip with adults + children ===
curl -s -X POST "http://localhost:3001/v1/trips/$THREE_DAY_TRIP/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-trp-2' \
  -d '{
    "startDate":"2026-10-15",
    "travelers":{"adults":2,"children":1}
  }' | jq '{ start: .data.items[0].startDate, end: .data.items[0].endDate, qty: .data.items[0].quantity }'
# Expect end: 2026-10-19, qty: 3

# === Past date — 400 BKNG_INVALID_DATE_RANGE ===
curl -s -X POST "http://localhost:3001/v1/trips/$ONE_DAY_TRIP/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate":"2024-01-01",
    "travelers":{"adults":1}
  }' -i

# === Inactive trip — 404 TRIP_NOT_FOUND ===
curl -s -X POST "http://localhost:3001/v1/trips/$INACTIVE_TRIP/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate":"2026-12-01",
    "travelers":{"adults":1}
  }' -i

# === Exceeds maxGuests — 400 BKNG_EXCEEDS_GUESTS ===
curl -s -X POST "http://localhost:3001/v1/trips/$ONE_DAY_TRIP/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate":"2026-09-15",
    "travelers":{"adults":99,"children":99}
  }' -i

# === Same-user overlap — 409 BKNG_UNAVAILABLE ===
# (Run this AFTER the 3-day trip happy path above)
curl -s -X POST "http://localhost:3001/v1/trips/$THREE_DAY_TRIP/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate":"2026-10-16",
    "travelers":{"adults":1}
  }' -i

# === Different user, same trip + date — 201 (no per-date capacity) ===
curl -s -X POST "http://localhost:3001/v1/trips/$ONE_DAY_TRIP/bookings" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-trp-userb-1' \
  -d '{
    "startDate":"2026-09-01",
    "travelers":{"adults":1}
  }' | jq .data.id

# === Verify schema invariants ===
psql "$DATABASE_URL" -c \
  "SELECT b.reference, bi.start_date, bi.end_date,
          (bi.end_date - bi.start_date) AS day_diff,
          (bi.snapshot ? 'itinerarySnapshot') AS has_snapshot,
          bi.subtotal_usd = b.total_price_usd AS price_match
   FROM bookings b
   JOIN booking_items bi ON bi.booking_id = b.id
   WHERE b.method = 'SINGLE_RESOURCE'
     AND b.single_resource_kind = 'TRIP';"
# Verify: day_diff = trip.duration_days - 1, has_snapshot = true, price_match = true
```

---

## Definition of Done

- [ ] All "Build & static checks" pass
- [ ] All "DTO validation" rows verified
- [ ] All "Endpoint behaviour" rows verified
- [ ] All "Schema invariants" rows verified
- [ ] "Itinerary freezing test" passes (snapshot survives a trip edit)
- [ ] All "Doc updates" rows verified
- [ ] `PROGRESS-TRACKER.md` ticks Phase 5a — M4d row to 🟢
- [ ] PR description references this `validation.md` for the smoke evidence
