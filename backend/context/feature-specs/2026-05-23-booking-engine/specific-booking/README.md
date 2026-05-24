# Specific Booking — Foundation Layer

> **Scope:** Single-resource (à-la-carte) bookings. Method **M4** from `../booking-methods.md`.
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a (foundation only — no journey-map customization)
> **Status:** 🟡 Spec triplet drafted; implementation not started.

---

## What "Specific Booking" Means

The user knows exactly which inventory item they want and books it directly — no journey map, no per-day customization, no skeleton wizard. This is the **fast path** for tourists who already know what they need.

### Real-world scenarios this folder covers

| Scenario | Sub-method | Endpoint |
|----------|------------|----------|
| Tourist in Siem Reap needs a tuk-tuk for tomorrow's airport transfer | M4a | `POST /v1/transportation/bookings` |
| Walk-in traveler books tonight's hotel room | M4b | `POST /v1/hotels/:hotelId/bookings` |
| Visitor wants a half-day private guide tomorrow morning | M4c | `POST /v1/guides/:guideId/bookings` |
| Customer picks "Angkor Wat 1-Day Tour" and books it unchanged | M4d | `POST /v1/trips/:tripId/bookings` |

### Why this is the foundation

Every other booking method (M1 public package, M2 private prebuilt, M3 build-from-scratch) eventually writes the same things: a `Booking` row, one or more `BookingItem` line items, a Redis hold, and a `booking.created` event.

This folder builds those primitives — the `commit-booking` use case, the overlap check, the hold/release helpers, the refund tier function, the reference generator, the idempotency store, the unified `Booking` read/update/cancel/QR/iCal endpoints. Methods M1/M2/M3 (separate folders, future phases) will consume them.

---

## Files in this folder

| File | Purpose |
|------|---------|
| [`requirements.md`](./requirements.md) | Scope, decisions, dependencies for the foundation layer |
| [`plan.md`](./plan.md) | Implementation plan — module structure, sequential groups, per-group gates |
| [`validation.md`](./validation.md) | Verification criteria — build/static checks, smoke tests, DoD |

---

## Boundary

This folder is **only** for M4. Anything that needs a `JourneyConfiguration` row, a customizable journey map, or a multi-step wizard belongs in the other two folders (to be created later):

- `package-booking/` — M1 + M2 (composed trips with customization)
- `build-from-scratch/` — M3 (skeleton + per-day wizard)

The shared primitives this folder builds (atomic commit, hold, refund, reference, idempotency, the unified `bookings/` read/update/cancel surface) will be **imported** by those folders, never duplicated.
