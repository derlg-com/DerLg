# Validation: Booking Engine

> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5 (Booking Engine)
> **Test posture:** **Critical paths only this branch.** Five unit-test specs are gating: `check-overlap.util.spec.ts`, `compute-refund.util.spec.ts`, `transition-status.util.spec.ts`, `create-guide-booking.use-case.spec.ts`, `cancel-booking.use-case.spec.ts`. Controller integration, full E2E (`bookings.e2e-spec.ts`), property-based (fast-check) tests, and the 90 % `TEST-PLAN.md` coverage gate for Bookings remain **unfulfilled** and must be restored in a follow-up branch before this code merges to `main`.

---

## Verification Criteria

### Build & static checks (gating)

- [ ] `npm run lint` — zero errors and zero warnings
- [ ] `npm run format` — repo formatted (Prettier)
- [ ] `npm run build` — TypeScript compiles cleanly
- [ ] `npx tsc --noEmit` — zero type errors

### Critical-path unit tests (gating)

Run from `backend/`:

- [ ] `npm test -- src/modules/bookings/utils/check-overlap.util.spec.ts` — all cases pass (full / partial / equal / adjacent / empty / single-day / swapped)
- [ ] `npm test -- src/modules/bookings/utils/compute-refund.util.spec.ts` — all cases pass (`> 7d` 100 %, exact 7d 50 % boundary, 3–7d 50 %, exact 3d 0 % boundary, `< 3d` 0 %, started 0 %, zero amount, decimal preservation)
- [ ] `npm test -- src/modules/bookings/utils/transition-status.util.spec.ts` — every legal transition succeeds; every illegal transition throws with the documented `BKNG_*` code
- [ ] `npm test -- src/modules/bookings/use-cases/create-guide-booking.use-case.spec.ts` — passes: hold key written `booking_hold:<id>` with TTL 900, overlap → 409 `BKNG_UNAVAILABLE`, `booking.created` event emitted with `EVENT-CATALOG.md` payload shape, idempotent retry returns cached body
- [ ] `npm test -- src/modules/bookings/use-cases/cancel-booking.use-case.spec.ts` — passes: 100 % / 50 % / 0 % refund tiers; already-cancelled throws `BKNG_ALREADY_CANCELLED`; payment-processing throws `BKNG_PAYMENT_PENDING`; hold key released; `booking.cancelled` event emitted

### Endpoint behaviour (manual smoke — gating)

> **Auth setup:** every booking endpoint requires a Bearer JWT. Acquire one with `curl -X POST http://localhost:3001/v1/auth/login -d ...` first; export `TOKEN=<accessToken>` and `USER_ID=<sub>` for the commands below.

#### Creation (Group 2)

- [ ] `POST /v1/guides/:guideId/bookings` — returns `201` with `{ success: true, data: { id, reference: 'GDE-XXXXXX', guideId, status: 'HOLD', holdExpiresAt, ... } }`
- [ ] `POST /v1/guides/:guideId/bookings` overlapping dates with existing HOLD/PENDING_PAYMENT/CONFIRMED — returns `409` + `BKNG_UNAVAILABLE`
- [ ] `POST /v1/guides/:guideId/bookings` with `endDate <= startDate` — returns `400` + `BKNG_INVALID_DATE_RANGE`
- [ ] `POST /v1/guides/:guideId/bookings` with same `Idempotency-Key` twice — second call returns the **same** body and the same `id` (no duplicate row in DB)
- [ ] `POST /v1/guides/:guideId/bookings` against a SUSPENDED guide — returns `403` + `GDE_SUSPENDED`
- [ ] `POST /v1/hotels/:hotelId/bookings` — returns `201`, status `HOLD`, ref prefix `HTL-`
- [ ] `POST /v1/hotels/:hotelId/bookings` with `guestsAdults + guestsChildren > room.capacity` — returns `400` + `BKNG_EXCEEDS_OCCUPANCY`
- [ ] `POST /v1/transportation/bookings` — returns `201`, status `HOLD`, ref prefix `TRN-`

#### Read (Group 3)

- [ ] `GET /v1/bookings` — paginated list scoped to `user.sub`; `{ items, page, limit, total }`
- [ ] `GET /v1/bookings?status=HOLD` — only HOLD rows
- [ ] `GET /v1/bookings/:id` — own booking returns detail
- [ ] `GET /v1/bookings/:id` — another user's booking returns `403` + `BKNG_NOT_AUTHOR`
- [ ] `GET /v1/bookings/:bogusId` — returns `404` + `BKNG_NOT_FOUND`

#### Update + cancel (Group 4)

- [ ] `PATCH /v1/bookings/:id` on a HOLD booking with valid date update — returns `200`, dates updated, overlap re-checked
- [ ] `PATCH /v1/bookings/:id` on a CONFIRMED booking — returns `403` + `BKNG_CONFIRMED_CANNOT_MODIFY`
- [ ] `POST /v1/bookings/:id/cancel` with start in 10 days — returns `200` with `{ refundAmountUsd: <total>, refundPercentage: 100, ... }`
- [ ] `POST /v1/bookings/:id/cancel` with start in 5 days — returns `200` with `refundPercentage: 50`
- [ ] `POST /v1/bookings/:id/cancel` with start in 1 day — returns `200` with `refundPercentage: 0`
- [ ] `POST /v1/bookings/:id/cancel` on already-cancelled booking — returns `400` + `BKNG_ALREADY_CANCELLED`
- [ ] After cancel, `redis-cli EXISTS booking_hold:<id>` returns `0`

#### QR + iCal (Group 5)

- [ ] `GET /v1/bookings/:id/qr` — returns `{ success: true, data: { qrCodeUrl: "<FRONTEND_URL>/bookings/<reference>/qr" } }`
- [ ] `GET /v1/bookings/:id/ical` — `Content-Type: text/calendar; charset=utf-8`
- [ ] First line of iCal body is exactly `BEGIN:VCALENDAR\r` (CRLF terminators per RFC 5545)
- [ ] `Content-Disposition: attachment; filename="<reference>.ics"` header present

#### Cron entrypoint (Group 6)

- [ ] Insert a `Booking` row with `status: HOLD, holdExpiresAt: now() - 60s` (Prisma Studio or a one-shot `ts-node` script).
- [ ] Invoke `ExpireHoldUseCase.execute()` from a `ts-node` REPL script.
- [ ] Booking row's `status` flips to `EXPIRED`.
- [ ] `redis-cli EXISTS booking_hold:<that-id>` returns `0` (idempotent — no error if it was already gone).
- [ ] Returns `{ expired: <count> }` reflecting the number of rows transitioned.

### Hold + idempotency behaviour (gating)

- [ ] After any creation call, `redis-cli KEYS 'booking_hold:*'` lists the new id
- [ ] `redis-cli TTL booking_hold:<id>` returns ~900 (or whatever `BOOKING_HOLD_TTL_SECONDS` is set to)
- [ ] After successful cancel, the matching hold key is gone
- [ ] After idempotent retry, `redis-cli KEYS 'idem:booking:<userId>:*'` shows the stored entry

### Event emission behaviour (gating, manual)

> Verified by enabling debug logs on `EventEmitter2` (one-line patch in `app.module.ts` for the smoke run, reverted before commit) OR by attaching a temporary `@OnEvent('booking.created')` test handler.

- [ ] `booking.created` emitted on every successful creation with payload matching `EVENT-CATALOG.md` § `booking.created` (fields: `bookingId, userId, bookingType, reference, startDate, endDate, totalPriceUsd, status: 'HOLD', createdAt`)
- [ ] `booking.cancelled` emitted on cancel with `refundAmountUsd, refundPercentage`
- [ ] `booking.expired` emitted from the `expire-hold` use case

### Test coverage (deferred — informational only)

> **Not gating this branch.** Listed to make the deferral visible.

- [ ] ❌ `bookings.controller.spec.ts` — controller integration tests (deferred)
- [ ] ❌ `bookings.e2e-spec.ts` — covers `TEST-PLAN.md` § 3.2 (creation + 15-min expiry), § 3.3 (User A confirmed → User B 409 → User A cancel → User B retry succeeds), § 3.6 (Idempotency-Key) — **deferred**
- [ ] ❌ `compute-refund.property.spec.ts` — fast-check property test for refund tiers — **deferred**
- [ ] ❌ 90 % unit coverage on every booking use case — **deferred** (this branch ships ~5 spec files only)

---

## Manual Verification Script

> Assumes Postgres + Redis are running locally and at least one `User`, `Guide` (ACTIVE), `Hotel`, `HotelRoom`, `TransportationVehicle` row in the local DB. If Phase 2 seed has not landed, insert one row each via `npx prisma studio` or a one-off `prisma.*.create` script before running.

```bash
cd backend && npm run start:dev
# Server boots on :3001

# Acquire a token (Phase 3)
TOKEN=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)
GUIDE_ID=<guide-uuid>
HOTEL_ID=<hotel-uuid>
ROOM_ID=<room-uuid>
VEHICLE_ID=<vehicle-uuid>

# === Group 2: Creation ===

# Guide booking — 201
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-1' \
  -d '{"startDate":"2026-08-01","endDate":"2026-08-03","specialRequests":"Mandarin tour please"}' | jq .

# Same Idempotency-Key — same response
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: smoke-1' \
  -d '{"startDate":"2026-08-01","endDate":"2026-08-03","specialRequests":"Mandarin tour please"}' | jq .

# Overlap — 409 BKNG_UNAVAILABLE
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-08-02","endDate":"2026-08-04"}' -i

# Bad date range — 400 BKNG_INVALID_DATE_RANGE
curl -s -X POST "http://localhost:3001/v1/guides/$GUIDE_ID/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-08-05","endDate":"2026-08-04"}' -i

# Hotel booking — 201
curl -s -X POST "http://localhost:3001/v1/hotels/$HOTEL_ID/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"roomId\":\"$ROOM_ID\",\"checkInDate\":\"2026-09-01\",\"checkOutDate\":\"2026-09-04\",\"guestsAdults\":2}" | jq .

# Transport booking — 201
curl -s -X POST "http://localhost:3001/v1/transportation/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"vehicleId\":\"$VEHICLE_ID\",\"startDate\":\"2026-10-01\",\"endDate\":\"2026-10-02\"}" | jq .

# === Group 3: Read ===

# My bookings
curl -s "http://localhost:3001/v1/bookings?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Filtered
curl -s "http://localhost:3001/v1/bookings?status=HOLD" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Detail (own)
BOOKING_ID=<id-from-create-response>
curl -s "http://localhost:3001/v1/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Detail (someone else's, with another user's token) — 403
TOKEN_OTHER=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.com","password":"Passw0rd!"}' | jq -r .data.accessToken)
curl -s "http://localhost:3001/v1/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $TOKEN_OTHER" -i

# === Group 4: Update + cancel ===

# Update HOLD — 200
curl -s -X PATCH "http://localhost:3001/v1/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"specialRequests":"updated note"}' | jq .

# Cancel — 100 % refund (assuming start is > 7 days out)
curl -s -X POST "http://localhost:3001/v1/bookings/$BOOKING_ID/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"plans changed"}' | jq .

# Cancel again — 400 BKNG_ALREADY_CANCELLED
curl -s -X POST "http://localhost:3001/v1/bookings/$BOOKING_ID/cancel" \
  -H "Authorization: Bearer $TOKEN" -i

# === Group 5: QR + iCal ===

curl -s "http://localhost:3001/v1/bookings/$BOOKING_ID/qr" \
  -H "Authorization: Bearer $TOKEN" | jq .

curl -i "http://localhost:3001/v1/bookings/$BOOKING_ID/ical" \
  -H "Authorization: Bearer $TOKEN"
# Expect: Content-Type: text/calendar; charset=utf-8
#         Content-Disposition: attachment; filename="<reference>.ics"
#         Body starts with BEGIN:VCALENDAR\r\n

# === Hold + idempotency state ===

redis-cli KEYS 'booking_hold:*'
redis-cli TTL "booking_hold:$BOOKING_ID"        # expect ~900 (or 0 / -2 if already cancelled)
redis-cli KEYS 'idem:booking:*'

# === Group 6: Cron entrypoint smoke ===

# In a separate terminal:
cat <<'EOF' > /tmp/expire-hold-smoke.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ExpireHoldUseCase } from './src/modules/bookings/use-cases';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const useCase = app.get(ExpireHoldUseCase);
  console.log(await useCase.execute());
  await app.close();
}
main();
EOF
# (after seeding a booking with holdExpiresAt < now)
cd backend && npx ts-node /tmp/expire-hold-smoke.ts
```

---

## Definition of Done

- [ ] All "Build & static checks" boxes ticked
- [ ] All "Critical-path unit tests" boxes ticked (5 spec files passing)
- [ ] All "Endpoint behaviour" boxes ticked (Groups 2–6 smoke commands)
- [ ] All "Hold + idempotency behaviour" boxes ticked
- [ ] All "Event emission behaviour" boxes ticked
- [ ] `PROGRESS-TRACKER.md` updated:
  - Phase 5 deliverables marked 🟢 Complete
  - "Tests for critical paths only — controller / E2E / property-based / 90 % coverage gate deferred to follow-up branch" noted under Phase 5
  - M4 milestone (Booking) flipped to 🟢 with date
- [ ] Follow-up issue / branch name recorded for the test work (so it is not forgotten)
- [ ] PR description explicitly flags **"⚠️ critical-path tests only — full coverage deferred to follow-up branch"** so the reviewer cannot miss it

---

## Pre-Merge Gate (mandatory before this branch lands on `main`)

> Even though this branch ships with critical-path tests only, it MUST NOT merge to `main` without the full coverage gate. The follow-up branch is a hard prerequisite.

| Gate | Required artifact |
|------|-------------------|
| `TEST-PLAN.md` § 2 coverage (Bookings = 90 %) | ≥ 90 % unit coverage on every `*UseCase` class in `src/modules/bookings/use-cases/`, plus integration coverage on the `BookingsController` + `InventoryBookingsController` |
| `TEST-PLAN.md` § 3.2 critical E2E | `bookings.e2e-spec.ts` covers create → HOLD → wait TTL → EXPIRED |
| `TEST-PLAN.md` § 3.3 critical E2E | `bookings.e2e-spec.ts` covers User A 201 → User B 409 → User A cancel → User B 201 |
| `TEST-PLAN.md` § 3.6 critical E2E | `bookings.e2e-spec.ts` covers Idempotency-Key (same key returns same body, different key creates new row) |
| `TEST-PLAN.md` § 4.3 property-based | `compute-refund.property.spec.ts` exercises refund tiers with fast-check generators |
| Code review | Reviewer confirms `BKNG_*` codes match `ERROR-REGISTRY.md`, hold key + TTL match `CONSTITUTION.md` § 9.1, refund tiers match § 9.3, event payloads match `EVENT-CATALOG.md` |
| `PROGRESS-TRACKER.md` | Phase 5 row updated to 🟢 Complete with test-coverage figures |
