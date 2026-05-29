# Booking Methods — Revised Model (4 Methods)

> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5 (Booking Engine)
> **Date:** 2026-05-24
> **Status:** Revised — adds **Method M4 (Single-Resource Quick-Book)** to the 3 workflow methods.
> **Companion to:** `analysis.md` (does not replace it).
> **Purpose:** Authoritative definition of every way a user can create a booking. Subsequent edits to `requirements.md`, `plan.md`, and `validation.md` will reference the section numbers in this file.

---

## TL;DR

The product supports **4 booking methods**, not 3. Three are composed-trip flows from `docs/workflows/`; the fourth is the à-la-carte scenario the current `requirements.md` was already targeting (a tourist in Siem Reap who just wants a tuk-tuk, a hotel room, or a 1-day tour — without going through a journey-map customizer).

| # | Method | Path | Composed? | Configuration phase? | Folder | Source |
|---|--------|------|-----------|----------------------|--------|--------|
| **M1** | Public package + customize | `template` | ✅ Multi-resource | ✅ Required | `template-booking/public-package/` | `docs/workflows/package-booking/` |
| **M2** | Private prebuilt (template-driven) + customize / book as-is | `template` | ✅ Multi-resource | ✅ Required | `template-booking/private-package/` | `docs/workflows/customize-package/01-...` |
| **M3** | Build from scratch (template path, no seed) | `template` | ✅ Multi-resource | ✅ Required (skeleton + wizard) | `template-booking/build-from-scratch/` | `docs/workflows/customize-package/02-...` |
| **M4** | Single-resource quick-book | `specific` | ❌ Single resource | ❌ Skipped (direct hold) | `specific-booking/` (4 sub-methods) | Current `requirements.md` (Phase 5 plan) |

All 4 methods converge on the same atomic `Booking` write via `src/modules/bookings/use-cases/commit-booking.use-case.ts` — they only differ in **how the booking input is assembled** before the commit. M1/M2/M3 share the *template path* (multi-resource journey, optionally seeded from a `Trip` template); M4 is the *specific path* (single resource, direct hold).

---

## 1. Method M4 — Single-Resource Quick-Book (NEW)

### User scenario

> "A tourist is already in Siem Reap. They open derlg.com on their phone. They just need a tuk-tuk for tomorrow's airport transfer. They don't want to plan a journey, customize a package, or fill a basics form — they want to pick a vehicle, pick a date, and pay."

This is the **walk-in / on-the-ground** use case. The user knows exactly what they need and wants the shortest possible path from "open app" to "QR ticket in wallet."

### Variants

| Sub-method | Endpoint | Inventory | Use case |
|------------|----------|-----------|----------|
| **M4a** Transportation only | `POST /v1/transportation/bookings` | `TransportationVehicle` | Tuk-tuk, taxi, van, airport transfer |
| **M4b** Hotel room only | `POST /v1/hotels/:hotelId/bookings` | `HotelRoom` | Tonight's stay, no tour |
| **M4c** Guide only | `POST /v1/guides/:guideId/bookings` | `Guide` | Half-day or full-day private guide |
| **M4d** Single-trip as-is | `POST /v1/trips/:tripId/bookings` *(NEW)* | `Trip` (one-day or short tours, no customization) | "Angkor Wat 1-Day Tour" booked unchanged |

### Why no configuration phase

M4 has **no journey-map customization**. There are no per-day choices, no activity pools, no budget tracker, no skeleton generator. The only inputs are:
- Resource id (which guide / hotel room / vehicle / trip)
- Date range
- Guest count / occupancy (for hotels and trips)
- Optional special requests

That fits in a single DTO. Forcing it through a `JourneyConfiguration` row would add latency and complexity for zero validation benefit. M4 goes **directly** from `POST` to atomic commit.

### M4 properties

| Property | Value |
|----------|-------|
| Pre-checkout step | None — direct `POST` |
| Hold | 900 s (same as M1/M2/M3) |
| Reference prefix | `GDE-` / `HTL-` / `TRN-` / `TRP-` |
| BookingItem rows | Exactly 1 |
| Idempotency-Key | Required |
| Allowed status flow | Same state machine as M1/M2/M3 |
| Refund tiers | Same as M1/M2/M3 (CONSTITUTION § 9.3) |
| Customization | Not allowed — `PATCH` only adjusts dates / guests / notes |

---

## 2. The 4 Methods Side-by-Side

### Decision matrix — when each method applies

| User Intent | Method | Entry Point |
|-------------|--------|-------------|
| "I want to discover Cambodia trips" | M1 | Homepage search |
| "I want a private family tour with reorderable days" | M2 | Private Tours section |
| "I want to design my own multi-day trip from scratch" | M3 | "Build Your Own Trip" |
| "I just need a ride / a room / a guide / a 1-day tour" | M4 | Inventory listing pages, deep links, AI chat |

### Capability comparison

| Concern | M1 Public | M2 Private | M3 Build | M4 Single |
|---------|-----------|------------|----------|-----------|
| Multi-resource | ✅ | ✅ | ✅ | ❌ |
| Multi-day journey map | ✅ (fixed days) | ✅ (reorderable days) | ✅ (blank → wizard) | ❌ |
| Skeleton generator | ❌ | ❌ | ✅ | ❌ |
| Customization | Limited (within pools) | Full (reorder/add/remove days) | Maximum (per-day wizard) | None |
| Save draft | ✅ | ✅ | ✅ | ❌ |
| Availability/check + confirm | ✅ | ✅ | ✅ | ❌ (single-shot at commit) |
| Configuration phase | Required | Required | Required | Skipped |
| Number of API calls (frontend) | 2-3 | 2-3 | 3-N (per-day) | 1 |
| Time-to-book (median) | ~5 min | ~5 min | ~10 min | < 30 s |

### Shared surface (all 4 methods)

| Endpoint | Purpose | Owner |
|----------|---------|-------|
| `GET /v1/bookings` | List user's bookings (any method) | `bookings` module |
| `GET /v1/bookings/:id` | Booking detail | `bookings` module |
| `PATCH /v1/bookings/:id` | Update HOLD booking | `bookings` module |
| `POST /v1/bookings/:id/cancel` | Cancel + refund tier | `bookings` module |
| `GET /v1/bookings/:id/qr` | Check-in QR code | `bookings` module |
| `GET /v1/bookings/:id/ical` | Calendar export | `bookings` module |
| `POST /v1/bookings/:id/extend-hold` | +5 min once during payment | `bookings` module |

---

## 3. Architectural Implication

Both `analysis.md` Design C (configuration + commit) and the current `requirements.md` Design B (per-resource endpoints) are **partially correct**:

- Design C is right for M1/M2/M3 (composed, customizable trips).
- Design B is right for M4 (single-resource quick-book).

The unified architecture is **Design C with a fast-path for M4** — both paths converge on the same internal `commit-booking` use case so atomicity, idempotency, hold semantics, and event emission are shared.

```
                  ┌──────────────────────────────┐
M1 customize ────▶│ PublicPackageConfig          │
                  │ POST /public-packages/:id/   │──┐
                  │      configurations          │  │
                  └──────────────────────────────┘  │
                                                    │
                  ┌──────────────────────────────┐  │
M2 customize ────▶│ PrivatePrebuiltConfig        │  │
                  │ POST /private-packages/:id/  │──┤
                  │      configurations          │  │
                  └──────────────────────────────┘  │
                                                    ▼
                  ┌──────────────────────────────┐ ┌──────────────────────────┐
M3 wizard ───────▶│ BuildFromScratchConfig       │ │ JourneyConfiguration row │
                  │ POST /trips/build-from-      │─┤  (CONFIRMED, 15 min TTL) │
                  │      scratch/configurations  │ └────────────┬─────────────┘
                  └──────────────────────────────┘              │
                                                                ▼
                                                  POST /v1/bookings
                                                  { configurationId }
                                                                │
                  ┌──────────────────────────────┐              │
                  │ M4 single-resource           │              │
M4a tuk-tuk ─────▶│ POST /transportation/        │──┐           │
                  │      bookings                │  │           │
                  └──────────────────────────────┘  │           │
                  ┌──────────────────────────────┐  │           │
M4b hotel ───────▶│ POST /hotels/:id/bookings    │──┤           │
                  └──────────────────────────────┘  ├──┐        │
                  ┌──────────────────────────────┐  │  │        │
M4c guide ───────▶│ POST /guides/:id/bookings    │──┤  │        │
                  └──────────────────────────────┘  │  │        │
                  ┌──────────────────────────────┐  │  │        │
M4d trip ────────▶│ POST /trips/:id/bookings     │──┘  │        │
                  └──────────────────────────────┘     │        │
                                                       ▼        ▼
                                            ┌────────────────────────────┐
                                            │ commit-booking.use-case.ts │
                                            │ (shared, atomic TX)        │
                                            └─────────────┬──────────────┘
                                                          │
                                                          ▼
                                            Booking + BookingItem[] + hold + event
```

### Key insight

Whether the input is a `JourneyConfiguration` (M1/M2/M3) or a single-resource DTO (M4), both produce the same intermediate shape before `commit-booking` runs:

```ts
type CommitInput = {
  userId: string;
  reference: string;
  totalPriceUsd: Decimal;
  items: Array<{
    type: 'HOTEL' | 'TRANSPORTATION' | 'GUIDE' | 'TRIP' | 'ACTIVITY';
    resourceId: string;
    startDate: Date;
    endDate: Date;
    quantity: number;
    snapshot: Json;  // the part of the journey map this row represents
  }>;
  metadata: {
    method: 'PUBLIC_PACKAGE' | 'PRIVATE_PREBUILT' | 'BUILD_FROM_SCRATCH' | 'SINGLE_RESOURCE';
    configurationId?: string;  // M1/M2/M3 only
    journeyMap?: Json;          // M1/M2/M3 only
  };
};
```

`commit-booking.use-case.ts` accepts this shape and runs the atomic transaction. The difference between methods is only **how `CommitInput` is assembled**.

---

## 4. Module Boundaries (Revised — 4 Methods)

```
src/modules/

# === Method M1 ===
public-package-config/
├── use-cases/
│   ├── customize-public-journey.use-case.ts
│   ├── confirm-public-availability.use-case.ts
│   └── save-public-draft.use-case.ts
├── validators/
│   ├── activity-pool-bounds.validator.ts
│   └── time-conflict.validator.ts
└── public-package-config.module.ts

# === Method M2 ===
private-prebuilt-config/
├── use-cases/
│   ├── customize-private-journey.use-case.ts
│   ├── confirm-private-availability.use-case.ts
│   └── book-as-is.use-case.ts
├── validators/
│   ├── group-size.validator.ts
│   └── day-reorder.validator.ts
└── private-prebuilt-config.module.ts

# === Method M3 ===
build-from-scratch/
├── use-cases/
│   ├── submit-basics-form.use-case.ts
│   ├── generate-skeleton.use-case.ts
│   ├── customize-day.use-case.ts
│   └── confirm-scratch-availability.use-case.ts
├── validators/
│   ├── budget-cap.validator.ts
│   ├── travel-time.validator.ts
│   └── opening-hours.validator.ts
└── build-from-scratch.module.ts

# === Method M4 (NEW) ===
single-resource-bookings/                     ← absorbs the current Phase 5 plan
├── use-cases/
│   ├── book-transportation.use-case.ts       ← M4a — calls commit-booking internally
│   ├── book-hotel-room.use-case.ts           ← M4b — calls commit-booking internally
│   ├── book-guide.use-case.ts                ← M4c — calls commit-booking internally
│   └── book-single-trip.use-case.ts          ← M4d — calls commit-booking internally
├── dto/
│   ├── book-transportation.dto.ts
│   ├── book-hotel-room.dto.ts
│   ├── book-guide.dto.ts
│   └── book-single-trip.dto.ts
├── controllers/
│   └── single-resource-bookings.controller.ts ← carries 4 inventory-prefixed routes
└── single-resource-bookings.module.ts

# === Shared infrastructure ===
journey-configurations/                       ← used by M1/M2/M3 only
├── use-cases/
│   ├── persist-configuration.use-case.ts
│   ├── load-configuration.use-case.ts
│   ├── freeze-configuration.use-case.ts
│   └── expire-stale-configs.use-case.ts
└── journey-configurations.module.ts

bookings/                                     ← shared by all 4 methods
├── use-cases/
│   ├── commit-booking.use-case.ts            ← ⭐ THE atomic boundary
│   ├── list-bookings.use-case.ts
│   ├── get-booking-detail.use-case.ts
│   ├── update-booking.use-case.ts
│   ├── cancel-booking.use-case.ts
│   ├── extend-hold.use-case.ts
│   ├── get-booking-qr.use-case.ts
│   ├── get-booking-ical.use-case.ts
│   └── expire-hold.use-case.ts
├── utils/
│   ├── check-overlap.util.ts
│   ├── compute-refund.util.ts
│   ├── transition-status.util.ts
│   ├── set-hold.util.ts
│   ├── release-hold.util.ts
│   ├── generate-reference.util.ts
│   ├── idempotency.util.ts
│   ├── map-booking.util.ts
│   └── build-ical.util.ts
└── bookings.module.ts
```

### Boundary rules (must hold)

1. **Only `commit-booking.use-case.ts` writes to the `Booking` table.** Every method module produces a `CommitInput` and delegates.
2. **M4 modules never touch `JourneyConfiguration`.** They build `CommitInput` directly from the request DTO.
3. **M1/M2/M3 modules never touch `Booking`.** They produce `JourneyConfiguration` rows; the bookings module reads them.
4. **`bookings/utils/` is shared by all 4 methods** — no per-method duplication of overlap checks, hold logic, refund math, or reference generation.
5. **Each method module owns its own validators.** No cross-method validator imports.
6. **One controller per method module.** No controller knows about more than one method.

---

## 5. API Surface (Revised — 4 Methods)

### Method-specific endpoints

| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| M1 | `POST /v1/public-packages/:tripId/configurations` | `{ customizations[], travelers, startDate }` | `JourneyConfiguration` (DRAFT) |
| M2 | `POST /v1/private-packages/:tripId/configurations` | `{ customizations[], travelers, startDate, asIs?: boolean }` | `JourneyConfiguration` (DRAFT) |
| M3 | `POST /v1/trips/build-from-scratch/basics` | `{ travelers, dates, budget, destinations, ... }` | `{ sessionId, generatedSkeleton }` |
| M3 | `POST /v1/trips/build-from-scratch/configurations` | `{ sessionId, days[] }` | `JourneyConfiguration` (DRAFT) |
| M4a | `POST /v1/transportation/bookings` | `{ vehicleId, startDate, endDate, ... }` | `Booking` (HOLD) — direct |
| M4b | `POST /v1/hotels/:hotelId/bookings` | `{ roomId, checkInDate, checkOutDate, guestsAdults, guestsChildren? }` | `Booking` (HOLD) — direct |
| M4c | `POST /v1/guides/:guideId/bookings` | `{ startDate, endDate, ... }` | `Booking` (HOLD) — direct |
| M4d | `POST /v1/trips/:tripId/bookings` | `{ startDate, travelers, asIs: true }` | `Booking` (HOLD) — direct |

### Shared endpoints

| Endpoint | Used by | Purpose |
|----------|---------|---------|
| `POST /v1/availability/check` | M1, M2, M3 | Cached probe (2 min) during customization |
| `POST /v1/availability/confirm` | M1, M2, M3 | Fresh check; freezes configuration to CONFIRMED, 15 min TTL |
| `POST /v1/journey-drafts` | M1, M2, M3 | Save DRAFT configuration |
| `GET /v1/journey-drafts` | M1, M2, M3 | List user's drafts |
| `POST /v1/bookings` | M1, M2, M3 | Atomic commit — body: `{ configurationId, idempotencyKey? }` |
| `GET /v1/bookings` | All 4 | List bookings |
| `GET /v1/bookings/:id` | All 4 | Detail |
| `PATCH /v1/bookings/:id` | All 4 | Update HOLD only |
| `POST /v1/bookings/:id/cancel` | All 4 | Cancel + refund tier |
| `POST /v1/bookings/:id/extend-hold` | All 4 | +5 min during payment retry |
| `GET /v1/bookings/:id/qr` | All 4 | Check-in QR |
| `GET /v1/bookings/:id/ical` | All 4 | Calendar export |

### Key API invariants

- **M4 endpoints DO NOT accept a `configurationId`.** They build the booking directly from the DTO.
- **`POST /v1/bookings` (the unified one) ONLY accepts a `configurationId`.** It is for M1/M2/M3 only.
- **All 8 method endpoints (M1 config, M2 config, M3 basics+config, M4a-d) accept `Idempotency-Key`.**
- **The same `Booking` row format is returned by all 4 methods** — frontend doesn't need method-specific response handling.

---

## 6. Schema Implications

### New models (Phase 2 must include)

```prisma
enum BookingMethod {
  PUBLIC_PACKAGE        // M1
  PRIVATE_PREBUILT      // M2
  BUILD_FROM_SCRATCH    // M3
  SINGLE_RESOURCE       // M4
}

enum SingleResourceKind {
  TRANSPORTATION        // M4a
  HOTEL                 // M4b
  GUIDE                 // M4c
  TRIP                  // M4d
}

enum ConfigStatus {
  DRAFT
  CONFIRMED
  BOOKED
  EXPIRED
}

model JourneyConfiguration {
  // ... per analysis.md § 4 (M1/M2/M3 only)
}
```

### Changes to existing `Booking` model

```prisma
model Booking {
  // ... existing fields
  method               BookingMethod      // ⭐ NEW — every booking is tagged with its method
  configurationId      String?            // ⭐ NEW — set for M1/M2/M3, null for M4
  singleResourceKind   SingleResourceKind? // ⭐ NEW — set for M4 only

  configuration        JourneyConfiguration? @relation(...)
  items                BookingItem[]      // ⭐ NEW — line items (M1/M2/M3 = many, M4 = exactly 1)

  @@index([method, status])
}

model BookingItem {                       // ⭐ NEW — line item table
  id              String   @id @default(uuid())
  bookingId       String
  itemType        ItemType // HOTEL | TRANSPORTATION | GUIDE | ACTIVITY | MEAL
  resourceId      String
  startDate       DateTime @db.Timestamptz()
  endDate         DateTime @db.Timestamptz()
  quantity        Int      @default(1)
  unitPriceUsd    Decimal  @db.Decimal(10, 2)
  subtotalUsd     Decimal  @db.Decimal(10, 2)
  snapshot        Json     // resource snapshot at booking time
  createdAt       DateTime @default(now()) @db.Timestamptz()

  booking         Booking  @relation(fields: [bookingId], references: [id])

  @@index([bookingId])
  @@index([resourceId, itemType])
}
```

### Reference prefix mapping

| Method | Booking reference prefix |
|--------|--------------------------|
| M1 | `PKG-XXXXXX` |
| M2 | `PRV-XXXXXX` |
| M3 | `CSM-XXXXXX` (custom) |
| M4a | `TRN-XXXXXX` |
| M4b | `HTL-XXXXXX` |
| M4c | `GDE-XXXXXX` |
| M4d | `TRP-XXXXXX` |

This keeps support / customer-service routing trivial — the prefix tells the agent which method the user took.

---

## 7. Mapping the Current `requirements.md` to the Revised Model

This is the section we'll use when editing `requirements.md` line by line.

| Current `requirements.md` item | Revised model placement | Action |
|-------------------------------|-------------------------|--------|
| `BookingsModule` use-case pattern | `bookings/` module — kept | Keep, expand scope |
| `POST /v1/guides/:guideId/bookings` | M4c (`single-resource-bookings/`) | Keep endpoint, move use case |
| `POST /v1/hotels/:hotelId/bookings` | M4b (`single-resource-bookings/`) | Keep endpoint, move use case |
| `POST /v1/transportation/bookings` | M4a (`single-resource-bookings/`) | Keep endpoint, move use case |
| Unified read surface (`GET /v1/bookings`, `:id`, `PATCH`, cancel, qr, ical) | `bookings/` module — shared by all 4 methods | Keep — already correct |
| Overbooking protection | Move into `commit-booking.use-case.ts` | Keep logic, change owner |
| Redis hold mechanism | `bookings/utils/set-hold.util.ts` — shared | Keep |
| Booking status state machine | `bookings/utils/transition-status.util.ts` — shared | Keep |
| Tiered refund | `bookings/utils/compute-refund.util.ts` — shared | Keep |
| Reference generator | `bookings/utils/generate-reference.util.ts` — extend with new prefixes | Extend |
| Idempotency | `bookings/utils/idempotency.util.ts` — shared | Keep |
| Authorization (`@CurrentUser`) | All method modules + bookings | Keep |
| Soft delete awareness | All queries | Keep |
| Domain event emission stubs | `commit-booking.use-case.ts` (single emission point) | Centralize |
| Out of scope: trip bookings | **Remove** — M4d is in scope | Add M4d (`POST /v1/trips/:id/bookings`) |
| Out of scope: cron scheduler | Keep deferred to Phase 8 | Keep |
| Out of scope: Stripe / payments | Keep deferred to Phase 6 | Keep |
| Decision #13: no `BookingItem` | **Reverse** — `BookingItem` is required for multi-resource methods | Remove decision |

### What needs adding to `requirements.md`

| New scope item | Phase | Notes |
|----------------|-------|-------|
| `commit-booking.use-case.ts` shared | 5 | Atomic boundary called by all 4 methods |
| `BookingItem` model + insertion logic | 5 | One row per leaf resource; M4 = 1 row |
| `JourneyConfiguration` model | 2 (senior) | Block on Phase 2 |
| `Booking.method` + `singleResourceKind` columns | 2 (senior) | Block on Phase 2 |
| Reference prefix per method (`PKG-`, `PRV-`, `CSM-`, `TRN-`, `HTL-`, `GDE-`, `TRP-`) | 5 | Update generator |
| Method-tagged events (`booking.created` payload includes `method`) | 5 | Update EVENT-CATALOG |
| M4d single-trip endpoint (`POST /v1/trips/:id/bookings`) | 5 | New endpoint |
| `extend-hold` endpoint | 5 or 6 | Decide before requirements lock |

### What can stay deferred (per current plan)

- Property-based tests
- Full E2E coverage (`bookings.e2e-spec.ts`)
- 90 % coverage gate
- M1/M2/M3 method modules (defer to Phase 5b — separate branch)
- `availability/check`, `availability/confirm`, `journey-drafts` endpoints (defer to Phase 5b)
- Stripe payment intent + webhook (Phase 6)
- Notification side effects (Phase 8)

---

## 8. Suggested Phase 5 Re-Scope

### Phase 5a — this branch — M4 + shared infrastructure

- `bookings/` module with:
  - `commit-booking.use-case.ts` (atomic TX, accepts `CommitInput`)
  - All shared utils (overlap, refund, transition, hold, idempotency, reference, mappers, ical)
  - Shared read/update/cancel/qr/ical endpoints
- `single-resource-bookings/` module with:
  - 4 endpoints (M4a, M4b, M4c, M4d)
  - Each use case builds `CommitInput` and delegates to `commit-booking.use-case.ts`
- `BookingItem` table writes — every booking gets ≥ 1 line item (M4 = exactly 1)
- 5 critical-path unit tests (per current plan, scoped to M4 + shared utils)

### Phase 5b — next branch — M1 / M2 / M3 + configuration store

- `journey-configurations/` shared module
- `template-booking/public-package/` (M1)
- `template-booking/private-package/` (M2)
- `template-booking/build-from-scratch/` (M3)
- `availability/check`, `availability/confirm`, `journey-drafts` endpoints
- Unified `POST /v1/bookings` accepting `configurationId` (delegates to same `commit-booking.use-case.ts`)
- Full E2E + 90 % coverage gate

This split keeps Phase 5a reviewable (~12 use cases, 4 controllers) and lets M4 ship to production first since it's the lowest-friction path for tourists in Cambodia who already know the brand.

---

## 9. Open Questions (need user decision before requirements rewrite)

| # | Question | Default |
|---|----------|---------|
| 1 | Adopt 5a/5b split? | Yes |
| 2 | M4d single-trip endpoint scope: in 5a, or defer? | In 5a (it's the same shape as M4a-c) |
| 3 | Is `extend-hold` in 5a or 6 (payments)? | 6 — it depends on payment retry semantics |
| 4 | Reference prefix change (`GDE-` → `PKG-`/`PRV-`/`CSM-`/`TRN-`/`HTL-`/`GDE-`/`TRP-`) — do it now or keep current 3? | Now — easier than retrofitting |
| 5 | Refund tier reconciliation: `CONSTITUTION § 9.3` (3-day boundary) or `flow.md § 6` (24h / 7-day boundary)? | `CONSTITUTION` wins; update `flow.md` |
| 6 | M4 booking event payload: include `method: 'SINGLE_RESOURCE'` and `singleResourceKind`? | Yes |
| 7 | Should M4 use `JourneyConfiguration` (with status=BOOKED, single item) for storage uniformity, or skip it entirely? | Skip — direct path is the whole point of M4 |

---

## 10. References

- `analysis.md` — original 3-method analysis (this doc supersedes it on the methods topic)
- `docs/workflows/booking-transaction-methods.md` — architectural decision (Method 3 — backend orchestrated)
- `docs/workflows/package-booking/01-homepage-search-package-journey.md` — M1
- `docs/workflows/customize-package/01-prebuilt-private-package.md` — M2
- `docs/workflows/customize-package/02-build-from-scratch.md` — M3
- `backend/context/feature-specs/2026-05-23-booking-engine/requirements.md` — current Phase 5 plan (covers M4 partially, will be edited section by section)
- `backend/context/guides/CONSTITUTION.md` § 9 — Booking & Payment Rules
- `backend/context/specs/SCHEMA.md` — Booking model (needs `method`, `BookingItem`, `JourneyConfiguration` additions)
- `backend/context/specs/EVENT-CATALOG.md` — booking events (need `method` field)
