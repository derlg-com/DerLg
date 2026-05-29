# Validation: M4a — Transportation Booking

> **Sub-method:** M4a
> **Endpoint:** `POST /v1/transportation/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking

This validates **only** the M4a endpoint. Foundation-level checks (overlap util, refund util, hold key, idempotency) are validated in `../shared-foundation/validation.md`.

---

## Verification Criteria

### Build & static checks (gating)

- [ ] `npm run lint` — zero errors / zero warnings
- [ ] `npm run build` — TypeScript compiles
- [ ] `npx tsc --noEmit` — zero type errors

### DTO validation (gating — manual)

> Use `curl -i` to inspect status code and response body. `TOKEN` and `VEHICLE_ID` come from the foundation seed.

- [ ] `vehicleId` missing → `400 BKNG_INVALID_INPUT` with `vehicleId must be a UUID`
- [ ] `startDate` malformed → `400 BKNG_INVALID_INPUT`
- [ ] `endDate < startDate` → `400 BKNG_INVALID_DATE_RANGE`
- [ ] `pickupLocation` empty → `400 BKNG_INVALID_INPUT`
- [ ] `dropoffLocation` empty → `400 BKNG_INVALID_INPUT`
- [ ] `stops.length > 10` → `400 BKNG_INVALID_INPUT`
- [ ] `estimatedDistanceKm` negative → `400 BKNG_INVALID_INPUT`
- [ ] `specialRequests.length > 1000` → `400 BKNG_INVALID_INPUT`

### Endpoint behaviour (gating — manual)

#### Happy path — per-day vehicle

- [ ] `POST /v1/transportation/bookings` against an `ACTIVE` vehicle with `pricePerDayUsd` set → `201` with:
  - `data.status === 'HOLD'`
  - `data.method === 'SINGLE_RESOURCE'`
  - `data.singleResourceKind === 'TRANSPORTATION'`
  - `data.reference` matches `/^TRN-[A-Z2-7]{6}$/`
  - `data.holdExpiresAt` is ~15 min from now
  - `data.items.length === 1`
  - `data.items[0].itemType === 'TRANSPORTATION'`
  - `data.items[0].snapshot` contains `vehicleId, label, type, capacity, pricingModel: 'PER_DAY', pickupLocation, dropoffLocation, stops, hasAc, hasWifi`
  - `data.totalPriceUsd === vehicle.pricePerDayUsd × days`

#### Happy path — per-km vehicle

- [ ] Vehicle row has `pricePerKmUsd` set, `pricePerDayUsd` null. Body includes `estimatedDistanceKm`. Returns `201`, `pricingModel: 'PER_KM'`, `totalPriceUsd === pricePerKmUsd × estimatedDistanceKm`.

#### Pricing edge cases

- [ ] Per-km vehicle but `estimatedDistanceKm` missing → `400 TRNS_PRICING_REQUIRES_DISTANCE`
- [ ] Vehicle row with both `pricePerDayUsd` and `pricePerKmUsd` set → uses per-day pricing (decision #5 in `requirements.md`)

#### Resource state

- [ ] Vehicle does not exist → `404 TRNS_NOT_FOUND`
- [ ] Vehicle is soft-deleted (`deletedAt != null`) → `404 TRNS_NOT_FOUND`
- [ ] Vehicle has `status: INACTIVE` → `404 TRNS_NOT_FOUND`
- [ ] Vehicle has `status: SUSPENDED` → `404 TRNS_NOT_FOUND`

#### Concurrency

- [ ] Two consecutive bookings on same `vehicleId` with overlapping dates → second returns `409 BKNG_UNAVAILABLE`
- [ ] Two bookings on same `vehicleId` with adjacent (non-overlapping) dates → both `201`

#### Idempotency

- [ ] Same `Idempotency-Key` retry → identical response body, same booking `id`
- [ ] After idempotent retry, `redis-cli KEYS 'idem:booking:<userId>:*'` shows the entry

#### Side effects

- [ ] `redis-cli KEYS 'booking_hold:*'` shows the new id
- [ ] `redis-cli TTL booking_hold:<id>` returns ~900
- [ ] `booking.created` event emitted with `method: 'SINGLE_RESOURCE'`, `singleResourceKind: 'TRANSPORTATION'`, `items[0].snapshot` matching the shape in `requirements.md`

### Schema invariants (gating)

- [ ] Exactly 1 `BookingItem` row inserted with `itemType = 'TRANSPORTATION'`
- [ ] `BookingItem.subtotalUsd === Booking.totalPriceUsd`
- [ ] `BookingItem.snapshot.pickupLocation` and `.dropoffLocation` are non-empty strings
- [ ] `BookingItem.snapshot.stops` is an array (possibly empty)

### Doc updates (gating)

- [ ] `backend/context/specs/ERROR-REGISTRY.md` — `TRNS_PRICING_REQUIRES_DISTANCE`, `TRNS_PRICING_MISCONFIGURED` added
- [ ] `backend/context/specs/API-CONTRACT.md` § 11 — `POST /v1/transportation/bookings` documented with request/response examples

---

## Manual Verification Script

```bash
# Pre-reqs: foundation deployed locally, server running on :3001,
# at least one ACTIVE TransportationVehicle row exists.

cd backend && npm run start:dev

TOKEN=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)
VEHICLE_ID=<vehicle-uuid>

# === Happy path — per-day ===
curl -s -X POST "http://localhost:3001/v1/transportation/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-trn-1' \
  -d "{
    \"vehicleId\":\"$VEHICLE_ID\",
    \"startDate\":\"2026-10-01\",
    \"endDate\":\"2026-10-03\",
    \"pickupLocation\":\"Siem Reap International Airport\",
    \"dropoffLocation\":\"Pub Street, Siem Reap\",
    \"stops\":[\"Angkor Wat ticket office\"]
  }" | jq .

# === Idempotent retry — same body, same id ===
curl -s -X POST "http://localhost:3001/v1/transportation/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-trn-1' \
  -d "{
    \"vehicleId\":\"$VEHICLE_ID\",
    \"startDate\":\"2026-10-01\",
    \"endDate\":\"2026-10-03\",
    \"pickupLocation\":\"Siem Reap International Airport\",
    \"dropoffLocation\":\"Pub Street, Siem Reap\"
  }" | jq .

# === Overlap — 409 BKNG_UNAVAILABLE ===
curl -s -X POST "http://localhost:3001/v1/transportation/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"vehicleId\":\"$VEHICLE_ID\",
    \"startDate\":\"2026-10-02\",
    \"endDate\":\"2026-10-04\",
    \"pickupLocation\":\"X\",
    \"dropoffLocation\":\"Y\"
  }" -i

# === Bad date range — 400 BKNG_INVALID_DATE_RANGE ===
curl -s -X POST "http://localhost:3001/v1/transportation/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"vehicleId\":\"$VEHICLE_ID\",
    \"startDate\":\"2026-10-05\",
    \"endDate\":\"2026-10-04\",
    \"pickupLocation\":\"X\",
    \"dropoffLocation\":\"Y\"
  }" -i

# === Per-km without distance — 400 TRNS_PRICING_REQUIRES_DISTANCE ===
# Use a vehicle row with pricePerKmUsd set + pricePerDayUsd null.
KM_VEHICLE_ID=<per-km-vehicle-uuid>
curl -s -X POST "http://localhost:3001/v1/transportation/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"vehicleId\":\"$KM_VEHICLE_ID\",
    \"startDate\":\"2026-11-01\",
    \"endDate\":\"2026-11-02\",
    \"pickupLocation\":\"A\",
    \"dropoffLocation\":\"B\"
  }" -i

# === Verify schema invariant: exactly 1 BookingItem ===
psql "$DATABASE_URL" -c \
  "SELECT b.reference, COUNT(bi.id) AS items
   FROM bookings b
   JOIN booking_items bi ON bi.booking_id = b.id
   WHERE b.method = 'SINGLE_RESOURCE'
     AND b.single_resource_kind = 'TRANSPORTATION'
   GROUP BY b.id
   HAVING COUNT(bi.id) <> 1;"
# Expect 0 rows.

# === Hold + idempotency state ===
BOOKING_ID=<id-from-create-response>
redis-cli TTL "booking_hold:$BOOKING_ID"           # ~900
redis-cli KEYS 'idem:booking:*'                    # shows the entry
```

---

## Definition of Done

- [ ] All "Build & static checks" pass
- [ ] All "DTO validation" rows verified
- [ ] All "Endpoint behaviour" rows verified
- [ ] All "Schema invariants" rows verified
- [ ] All "Doc updates" rows verified
- [ ] `PROGRESS-TRACKER.md` ticks Phase 5a — M4a row to 🟢
- [ ] PR description references this `validation.md` for the smoke evidence
