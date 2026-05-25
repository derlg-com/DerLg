# Specific Booking — Foundation Layer

> **Scope:** Single-resource (à-la-carte) bookings. Method **M4** from `../booking-methods.md`.
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a (foundation only — no journey-map customization)
> **Status:** 🟡 Per-type specs drafted; shared foundation + implementation not started.

---

## What "Specific Booking" Means

The user knows exactly which inventory item they want and books it directly — no journey map, no per-day customization, no skeleton wizard. This is the **fast path** for tourists who already know what they need.

| Scenario | Sub-method | Folder |
|----------|------------|--------|
| Tourist needs a tuk-tuk for tomorrow's airport transfer | M4a | [`transportation/`](./transportation/) |
| Walk-in traveler books tonight's hotel room | M4b | [`hotel-room/`](./hotel-room/) |
| Visitor wants a half-day private guide tomorrow morning | M4c | [`guide/`](./guide/) |
| Customer picks "Angkor Wat 1-Day Tour" and books it unchanged | M4d | [`single-trip/`](./single-trip/) |

---

## Sub-folder index

Each sub-folder ships its own `requirements.md`, `plan.md`, and `validation.md`. They share the same shape (DTO → use case → controller route → error codes) but each captures the domain quirks specific to that resource.

| Folder | Endpoint | Reference prefix | Distinguishing concern |
|--------|----------|------------------|-----------------------|
| [`transportation/`](./transportation/) | `POST /v1/transportation/bookings` | `TRN-` | Per-day vs per-km pricing, pickup/dropoff/stops, driver-reveal-at-24h |
| [`hotel-room/`](./hotel-room/) | `POST /v1/hotels/:hotelId/bookings` | `HTL-` | **Per-night inventory counter** (not overlap), occupancy cap, check-in/out time snapshot |
| [`guide/`](./guide/) | `POST /v1/guides/:guideId/bookings` | `GDE-` | Optional `linkedTripBookingId`, `INACTIVE` vs `SUSPENDED` distinction, contact-reveal-at-24h |
| [`single-trip/`](./single-trip/) | `POST /v1/trips/:tripId/bookings` | `TRP-` | Per-person pricing, max-guests cap, `endDate` derived from `durationDays`, itinerary freezing |

---

## What lives elsewhere

This folder covers **only** the four customer-facing M4 endpoints. Everything else is owned by sibling folders:

| Concern | Lives in |
|---------|----------|
| Atomic commit primitive (`commit-booking.use-case.ts`), hold key, idempotency, refund tiers, reference generator, status state machine, unified `GET /v1/bookings*` read/update/cancel/qr/ical surface | `../shared-foundation/` *(spec to be drafted — prerequisite for all 4 sub-folders)* |
| Multi-resource composed bookings with journey-map customization (M1, M2) | `../package-booking/` (Phase 5b) |
| Build-from-scratch per-day wizard (M3) | `../build-from-scratch/` (Phase 5c) |
| Admin inventory CRUD (vehicles, hotels, rooms, guides, trips) | `../admin-inventory/` *(separate spec — was previously bundled here as "Part B")* |

---

## Recommended build order

Build the shared foundation first, then the four M4 endpoints in this order. Hotel-room is intentionally last because it's the only one that needs a new availability primitive (per-night counter, not interval overlap).

```
1. ../shared-foundation/          ← prerequisite — unblocks everything below
2. transportation/                ← simplest (overlap-based, single resource)
3. guide/                         ← similar shape to transportation, plus linked-trip validation
4. single-trip/                   ← per-person pricing wrinkle, itinerary freeze
5. hotel-room/                    ← needs the per-night inventory counter from foundation
```

Each per-type spec has its own per-group implementation plan and per-group gates — see the sub-folder's `plan.md`.

---

## Boundary

This folder is **strictly M4**. Anything that needs a `JourneyConfiguration` row, a customizable journey map, or a multi-step wizard belongs in `../package-booking/` or `../build-from-scratch/`.

The shared primitives that all 4 sub-folders depend on (atomic commit, hold, refund, reference, idempotency, the unified `bookings/` read/update/cancel surface) are **imported** from `../shared-foundation/`, never duplicated per sub-folder.
