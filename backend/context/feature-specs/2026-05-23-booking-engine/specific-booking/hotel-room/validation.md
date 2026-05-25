# Validation: M4b — Hotel Room Booking

> **Sub-method:** M4b
> **Endpoint:** `POST /v1/hotels/:hotelId/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking

This validates **only** the M4b endpoint. The per-night inventory counter, hold key, idempotency, and refund logic are validated in `../shared-foundation/validation.md`.

---

## Verification Criteria

### Build & static checks (gating)

- [ ] `npm run lint` — zero errors / zero warnings
- [ ] `npm run build` — TypeScript compiles
- [ ] `npx tsc --noEmit` — zero type errors

### DTO validation (gating — manual)

- [ ] `roomId` missing or malformed → `400 BKNG_INVALID_INPUT`
- [ ] `:hotelId` malformed UUID → `400 BKNG_INVALID_INPUT` (from `ParseUUIDPipe`)
- [ ] `checkInDate` malformed → `400 BKNG_INVALID_INPUT`
- [ ] `checkOutDate === checkInDate` → `400 BKNG_INVALID_DATE_RANGE` (zero-night booking rejected)
- [ ] `checkOutDate < checkInDate` → `400 BKNG_INVALID_DATE_RANGE`
- [ ] `guestsAdults === 0` → `400 BKNG_INVALID_INPUT`
- [ ] `guestsAdults` missing → `400 BKNG_INVALID_INPUT`
- [ ] `guestsChildren < 0` → `400 BKNG_INVALID_INPUT`
- [ ] `specialRequests.length > 1000` → `400 BKNG_INVALID_INPUT`

### Endpoint behaviour (gating — manual)

#### Happy path

- [ ] `POST /v1/hotels/:hotelId/bookings` against an `ACTIVE` hotel + room → `201` with:
  - `data.status === 'HOLD'`
  - `data.method === 'SINGLE_RESOURCE'`
  - `data.singleResourceKind === 'HOTEL'`
  - `data.reference` matches `/^HTL-[A-Z2-7]{6}$/`
  - `data.holdExpiresAt` is ~15 min from now
  - `data.items.length === 1`
  - `data.items[0].itemType === 'HOTEL'`
  - `data.items[0].snapshot` contains `hotelId, hotelName, roomId, roomName, bedConfiguration, maxOccupancy, guestsAdults, guestsChildren, checkInTime, checkOutTime, cancellationPolicySnapshot, nights, pricePerNightUsd`
  - `data.totalPriceUsd === room.pricePerNightUsd × nights`

#### Resource state

- [ ] Hotel does not exist → `404 HTL_NOT_FOUND`
- [ ] Hotel `status: INACTIVE` → `404 HTL_NOT_FOUND`
- [ ] Room does not exist → `404 HTL_ROOM_NOT_FOUND`
- [ ] Room belongs to a different hotel than `:hotelId` → `404 HTL_ROOM_NOT_FOUND`
- [ ] Room `status: INACTIVE` → `404 HTL_ROOM_NOT_FOUND`

#### Occupancy

- [ ] `guestsAdults + guestsChildren === room.maxOccupancy` → `201` (boundary allowed)
- [ ] `guestsAdults + guestsChildren > room.maxOccupancy` → `400 BKNG_EXCEEDS_OCCUPANCY`
- [ ] `guestsAdults === room.maxOccupancy, guestsChildren === 1` → `400 BKNG_EXCEEDS_OCCUPANCY` (children count toward cap)

#### Per-night inventory (the M4b-specific test)

> Set up a `HotelRoom` row with `totalRooms: 2` for these tests.

- [ ] First booking for nights N1–N2 by user A → `201`
- [ ] Second booking for nights N1–N2 by user B (same `roomId`) → `201` (still under cap)
- [ ] Third booking for nights N1–N2 by user C (same `roomId`) → `409 BKNG_UNAVAILABLE` (cap reached)
- [ ] Booking for nights N3–N4 (no overlap with N1–N2) by user C → `201` (different nights, not constrained)
- [ ] Booking for nights N1–N3 by user C while two N1–N2 holds exist → `409 BKNG_UNAVAILABLE` (any night over cap blocks the whole stay)
- [ ] After user A cancels their N1–N2 booking, user C retries N1–N2 → `201`

#### Idempotency

- [ ] Same `Idempotency-Key` retry → identical response body, same booking `id`
- [ ] After idempotent retry, `redis-cli KEYS 'idem:booking:<userId>:*'` shows the entry

#### Side effects

- [ ] `redis-cli KEYS 'booking_hold:*'` shows the new id
- [ ] `redis-cli TTL booking_hold:<id>` returns ~900
- [ ] `booking.created` event emitted with `method: 'SINGLE_RESOURCE'`, `singleResourceKind: 'HOTEL'`

### Schema invariants (gating)

- [ ] Exactly 1 `BookingItem` row inserted with `itemType = 'HOTEL'`
- [ ] `BookingItem.subtotalUsd === Booking.totalPriceUsd`
- [ ] `BookingItem.startDate === checkInDate`, `BookingItem.endDate === checkOutDate`
- [ ] `BookingItem.quantity === nights`
- [ ] `BookingItem.snapshot.checkInTime` and `.checkOutTime` are non-empty time strings (e.g. `"14:00"`, `"12:00"`)

### Doc updates (gating)

- [ ] `backend/context/specs/ERROR-REGISTRY.md` — `HTL_ROOM_NOT_FOUND` confirmed/added
- [ ] `backend/context/specs/API-CONTRACT.md` § 11 — `POST /v1/hotels/:hotelId/bookings` documented with the `BookingItem.snapshot` HOTEL shape

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
TOKEN_C=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"carol@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)

HOTEL_ID=<hotel-uuid>
# Use a room with totalRooms = 2
ROOM_ID=<room-uuid>

# === Happy path ===
curl -s -X POST "http://localhost:3001/v1/hotels/$HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-htl-A1' \
  -d "{
    \"roomId\":\"$ROOM_ID\",
    \"checkInDate\":\"2026-09-01\",
    \"checkOutDate\":\"2026-09-04\",
    \"guestsAdults\":2,
    \"guestsChildren\":1
  }" | jq .

# === Per-night counter — second booking under cap ===
curl -s -X POST "http://localhost:3001/v1/hotels/$HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-htl-B1' \
  -d "{
    \"roomId\":\"$ROOM_ID\",
    \"checkInDate\":\"2026-09-01\",
    \"checkOutDate\":\"2026-09-04\",
    \"guestsAdults\":2
  }" | jq .

# === Per-night counter — third booking hits cap → 409 ===
curl -s -X POST "http://localhost:3001/v1/hotels/$HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_C" \
  -H 'Content-Type: application/json' \
  -d "{
    \"roomId\":\"$ROOM_ID\",
    \"checkInDate\":\"2026-09-01\",
    \"checkOutDate\":\"2026-09-04\",
    \"guestsAdults\":1
  }" -i

# === Different nights — should succeed even though N1-N2 are full ===
curl -s -X POST "http://localhost:3001/v1/hotels/$HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_C" \
  -H 'Content-Type: application/json' \
  -d "{
    \"roomId\":\"$ROOM_ID\",
    \"checkInDate\":\"2026-09-10\",
    \"checkOutDate\":\"2026-09-12\",
    \"guestsAdults\":1
  }" | jq .

# === Exceeds occupancy — 400 BKNG_EXCEEDS_OCCUPANCY ===
curl -s -X POST "http://localhost:3001/v1/hotels/$HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{
    \"roomId\":\"$ROOM_ID\",
    \"checkInDate\":\"2026-09-20\",
    \"checkOutDate\":\"2026-09-22\",
    \"guestsAdults\":99
  }" -i

# === Bad date range (zero nights) — 400 BKNG_INVALID_DATE_RANGE ===
curl -s -X POST "http://localhost:3001/v1/hotels/$HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{
    \"roomId\":\"$ROOM_ID\",
    \"checkInDate\":\"2026-09-25\",
    \"checkOutDate\":\"2026-09-25\",
    \"guestsAdults\":1
  }" -i

# === Room belongs to a different hotel — 404 HTL_ROOM_NOT_FOUND ===
WRONG_HOTEL_ID=<another-hotel-uuid>
curl -s -X POST "http://localhost:3001/v1/hotels/$WRONG_HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{
    \"roomId\":\"$ROOM_ID\",
    \"checkInDate\":\"2026-09-01\",
    \"checkOutDate\":\"2026-09-02\",
    \"guestsAdults\":1
  }" -i

# === Verify schema invariant ===
psql "$DATABASE_URL" -c \
  "SELECT b.reference, COUNT(bi.id) AS items, bi.snapshot->>'checkInTime' AS check_in_time
   FROM bookings b
   JOIN booking_items bi ON bi.booking_id = b.id
   WHERE b.method = 'SINGLE_RESOURCE'
     AND b.single_resource_kind = 'HOTEL'
   GROUP BY b.id, bi.snapshot
   HAVING COUNT(bi.id) <> 1;"
# Expect 0 rows.
```

---

## Definition of Done

- [ ] All "Build & static checks" pass
- [ ] All "DTO validation" rows verified
- [ ] All "Endpoint behaviour" rows verified (especially the 6 per-night counter rows)
- [ ] All "Schema invariants" rows verified
- [ ] All "Doc updates" rows verified
- [ ] `PROGRESS-TRACKER.md` ticks Phase 5a — M4b row to 🟢
- [ ] PR description references this `validation.md` for the smoke evidence
