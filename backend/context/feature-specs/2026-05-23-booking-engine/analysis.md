# Analysis: Booking Engine — Workflow Alignment & Design Options

> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5 (Booking Engine)
> **Date:** 2026-05-24
> **Purpose:** Audit the current `requirements.md` / `plan.md` against `docs/workflows/` and propose a flexible booking-engine design that natively supports the 3 user booking methods.
> **Status:** 🔴 Pre-implementation review — current plan does NOT match the workflow.

---

## TL;DR

The workflow docs (`docs/workflows/`) define **3 user booking methods** that all converge on a single `POST /v1/bookings` endpoint accepting composed `TRIP` items with a `custom_journey_map` payload. The current `plan.md` instead ships **3 standalone resource endpoints** (`/v1/guides/:id/bookings`, `/v1/hotels/:id/bookings`, `/v1/transportation/bookings`) and explicitly defers trip-level bookings.

These two designs are **architecturally incompatible**. The workflow's path cannot be implemented on top of the current plan without ripping out the per-resource controllers and replacing them with a configuration + atomic-commit pipeline.

This document:
1. Lists 4 candidate booking-engine designs with pros/cons.
2. Documents the 3 user booking methods exactly as the workflow specifies.
3. Proposes module boundaries to isolate each method so they can be designed and tested independently.
4. Catalogues every mismatch between the current spec triplet and the workflow.
5. Recommends a re-scoping path.

---

## 1. Source-of-Truth Audit

### Documents reviewed

| Document | Role |
|----------|------|
| `docs/workflows/booking-transaction-methods.md` | **Architectural decision** — picks Method 3 (Backend Orchestrated with Configuration) for DerLg |
| `docs/workflows/package-booking/01-homepage-search-package-journey.md` | Method M1 — public package + customize |
| `docs/workflows/customize-package/01-prebuilt-private-package.md` | Method M2 — private prebuilt package + customize / book as-is |
| `docs/workflows/customize-package/02-build-from-scratch.md` | Method M3 — build from scratch (basics form → skeleton → per-day wizard) |
| `docs/workflows/package-booking/flow.md` | Mermaid sequence + state machine for M1 |
| `docs/workflows/customize-package/flow.md` | Mermaid sequence for M2 + M3 |
| `backend/context/feature-specs/2026-05-23-booking-engine/requirements.md` | Current Phase 5 scope |
| `backend/context/feature-specs/2026-05-23-booking-engine/plan.md` | Current Phase 5 plan |
| `backend/context/feature-specs/2026-05-23-booking-engine/validation.md` | Current Phase 5 verification matrix |

### Key contract from `booking-transaction-methods.md`

> **Decision Record (excerpt):**
> | Question | Decision |
> |----------|----------|
> | Who orchestrates the booking? | Backend (Booking Service) |
> | How many API calls does the frontend make? | **Two: one to configure, one to book** |
> | Where does validation happen? | **Configuration phase (before inventory lock)** |
> | How is inventory locked? | **Atomic database transaction with serializable isolation** |
> | What happens if email/push fails? | Async outbox retry; booking is still confirmed |

This decision was already made when the workflow was written. The current Phase 5 plan was written without referencing it.

---

## 2. The 3 Booking Methods (workflow-canonical)

These are the **only** ways a user can create a booking in the product. Every booking flow in the app must map to exactly one of these.

| # | Method ID | Entry Point | Customization Scope | Source Workflow |
|---|-----------|-------------|---------------------|-----------------|
| **M1** | `BOOK_PUBLIC_PACKAGE` | Homepage → search → public trip detail | Limited: swap activities/hotel/transport within fixed day structure | `package-booking/01-homepage-search-package-journey.md` |
| **M2** | `BOOK_PRIVATE_PREBUILT` | "Private Tours" section → private trip detail | Full: reorder / add / remove days, swap everything, OR book as-is | `customize-package/01-prebuilt-private-package.md` |
| **M3** | `BOOK_BUILD_FROM_SCRATCH` | "Build Your Own Trip" → basics form → skeleton wizard | Maximum: blank slate, AI-generated skeleton + per-day wizard | `customize-package/02-build-from-scratch.md` |

### Convergence point

All 3 methods funnel through the same checkout pipeline:

```
[M1 customize] ──┐
[M2 customize] ──┼──▶ POST /v1/availability/confirm ──▶ POST /v1/bookings (HOLD)
[M3 wizard]    ──┘                                                │
                                                                  ▼
                                                          POST /v1/payments/intent
                                                                  │
                                                                  ▼
                                                          Webhook → CONFIRMED
                                                                  │
                                                                  ▼
                                                          Outbox → email / push / QR ticket
```

### Differences worth isolating

| Concern | M1 (Public) | M2 (Private Prebuilt) | M3 (Build From Scratch) |
|---------|-------------|-----------------------|-------------------------|
| Entry endpoint | `GET /v1/trips/:slug` | `GET /v1/trips/:slug?type=private` | `POST /v1/trips/build-from-scratch/basics` |
| Customization unit | Item swap within fixed days | Day reorder + item swap | Per-day wizard from blank/skeleton |
| Required validators | Activity-pool bounds, time-conflict | Group size, kid-friendly, day reorder, travel time | Budget cap, travel time, opening hours, multi-city transport gaps |
| Pricing model | Per-person × travelers | Per-group OR per-person | Sum of per-day customizations vs. budget |
| Draft semantics | "Save My Journey" → `POST /v1/journey-drafts` | Same | Same, plus session-id from basics form |
| Skeleton generator | None (uses admin template) | None (uses admin template) | Heuristic / AI on basics input |

---

## 3. Booking-Engine Design Options

Four candidate architectures. Compared on the criteria that matter for this product: support for the 3 methods, transactional safety, frontend simplicity, and testability.

### Design A — Single Polymorphic Endpoint

One `POST /v1/bookings` with `items[]`, `item_type ∈ {TRIP, HOTEL, TRANSPORTATION, GUIDE, ACTIVITY}`. All 3 user methods send the same shape, varying by `metadata.custom_journey_map`.

```
Frontend ──▶ POST /v1/bookings { items: [{ item_type: TRIP, ... }] } ──▶ Booking Service
                                                                              │
                                                                              ▼
                                                                       Atomic TX (Postgres)
```

**Pros**
- Frontend simplicity: one HTTP call, one error envelope
- Atomic multi-resource booking (one TX locks hotel + transport + guide together)
- Matches `booking-transaction-methods.md` Method 3 partially
- Single error surface

**Cons**
- Use case becomes a fat dispatcher (`if item_type === 'TRIP' ... else if 'HOTEL' ...`)
- Validation rules per `item_type` leak into one mega-DTO (discriminated union)
- Hard to unit-test in isolation — every test needs full polymorphic context
- Configuration validation (kid-friendly, group size, budget) bloats the booking TX

---

### Design B — Per-Resource Endpoints (current plan)

Three endpoints, one per low-level resource. Each books a single inventory item.

```
Frontend ──▶ POST /v1/guides/:id/bookings        ──▶ Guide Booking Service
         ──▶ POST /v1/hotels/:id/bookings        ──▶ Hotel Booking Service
         ──▶ POST /v1/transportation/bookings    ──▶ Transport Booking Service
```

**Pros**
- Clean DTOs per resource (no discriminated unions)
- Easy unit tests, clear use-case boundaries
- Matches `API-CONTRACT.md` § 11 verbatim (which is what the current plan cites)

**Cons**
- ❌ **Does not implement the 3 workflow methods.** A "Siem Reap Temple Tour 3D" booking with hotel + transport + guide cannot be created in one call — frontend would call 3 endpoints in parallel = `Method 1` (frontend orchestration), explicitly **rejected** by `booking-transaction-methods.md`
- ❌ No atomic overlap check across resources (hotel locks but transport sells out → orphan)
- ❌ Frontend must compensate (DELETE) on partial failure
- ❌ No `custom_journey_map` storage path
- ❌ Cannot save `journey_draft` → book flow
- ❌ Decision #13 in current plan ("No use of `BookingItem` / line-item table") makes multi-resource trips impossible

---

### Design C — Two-Phase: Configuration + Atomic Booking Commit ⭐ recommended

Phase 1 — `POST /v1/<method>/configurations` (or `POST /v1/availability/confirm`) produces a server-validated **configuration snapshot**. No inventory lock yet.
Phase 2 — `POST /v1/bookings` references the configuration id, runs ONE atomic TX that re-checks availability + locks all resources + writes `Booking` + `BookingItem[]`.

```
Frontend ──▶ POST /v1/<method>/configurations    ──▶ <Method> Config Module
                                                          │
                                                          ▼
                                                    JourneyConfiguration row
                                                          │
         ──▶ POST /v1/availability/confirm  ───────────  freezes snapshot
                                                          │
         ──▶ POST /v1/bookings { configurationId } ──▶ Booking Commit Use Case
                                                          │
                                                          ▼
                                                    Atomic TX (SELECT FOR UPDATE)
                                                          │
                                                          ▼
                                                    Booking + BookingItem[]
                                                          │
                                                          ▼
                                                    Outbox → side effects
```

**Pros**
- ✅ Matches `booking-transaction-methods.md` Method 3 (the recommended one)
- ✅ Heavy validation (kid-friendly, group size, travel time, budget, customization rules) lives in the configuration phase — booking TX stays fast
- ✅ Single atomic lock across all sub-resources — no partial state
- ✅ Each user method (M1/M2/M3) plugs in by writing different configurations; the booking phase is **one shared use case**
- ✅ `journey_draft` is a natural fallback ("save my journey")
- ✅ Cleanly separates: configuration (per method, validation-heavy) vs. inventory commit (shared, performance-critical)
- ✅ Idempotency-Key applies cleanly to the commit step
- ✅ Outbox pattern isolates email/push/QR side effects from the critical path

**Cons**
- Two endpoints to call (workflow already does this — frontend cost is paid)
- Configuration table grows; needs TTL cleanup cron (already planned for `journey_drafts`)
- Slightly more code than Design A
- Schema change required: `JourneyConfiguration` model + `BookingItem` line-item table

---

### Design D — Saga / gRPC (Method 2 in `booking-transaction-methods.md`)

Booking service coordinates compensating transactions across hotel/transport/guide microservices via gRPC.

**Pros**
- Service isolation if you ever go microservices
- Strong consistency via compensations

**Cons**
- ❌ Massive overkill for monolithic NestJS + single Postgres
- ❌ Compensating-action bugs ship money loss
- ❌ `booking-transaction-methods.md` already rejected this for DerLg
- ❌ Operational burden (distributed tracing, saga monitoring, circuit breakers)

---

### Verdict

| Design | Supports M1 | Supports M2 | Supports M3 | Atomic | Frontend-friendly | Score |
|--------|-------------|-------------|-------------|--------|-------------------|-------|
| **A** Polymorphic endpoint | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 — but fat dispatcher |
| **B** Per-resource (current) | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 |
| **C** Configuration + Commit | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 — clean boundaries |
| **D** Saga / gRPC | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 — wrong tool |

**Choose Design C.** It is the only design that:
1. Implements all 3 user methods natively
2. Matches the architectural decision already in `booking-transaction-methods.md`
3. Keeps each method's validation logic isolated and independently testable
4. Preserves atomicity without bolting saga complexity onto a monolith

---

## 4. Method Boundaries (isolation strategy)

To keep the booking engine flexible, each method gets its **own configuration module**. None touch `Booking` rows directly. The booking commit is a single shared use case.

### Boundary 1 — Per-Method Configuration Modules

```
src/modules/
├── public-package-config/      ← Method M1 — owns customization rules for public packages
│   ├── use-cases/
│   │   ├── customize-public-journey.use-case.ts
│   │   ├── confirm-public-availability.use-case.ts
│   │   └── save-public-draft.use-case.ts
│   ├── validators/
│   │   ├── activity-pool-bounds.validator.ts        ← can only swap within pool
│   │   └── time-conflict.validator.ts
│   ├── dto/
│   ├── interfaces/
│   └── public-package-config.module.ts
│
├── private-prebuilt-config/    ← Method M2 — owns full-flexibility customization
│   ├── use-cases/
│   │   ├── customize-private-journey.use-case.ts
│   │   ├── confirm-private-availability.use-case.ts
│   │   └── book-as-is.use-case.ts                   ← skips customization entirely
│   ├── validators/
│   │   ├── group-size.validator.ts                  ← min/max group, kid-friendly
│   │   └── day-reorder.validator.ts                 ← travel time between cities
│   ├── dto/
│   ├── interfaces/
│   └── private-prebuilt-config.module.ts
│
├── build-from-scratch/         ← Method M3 — owns skeleton generation + per-day wizard
│   ├── use-cases/
│   │   ├── submit-basics-form.use-case.ts           ← intake → skeleton
│   │   ├── generate-skeleton.use-case.ts            ← AI/heuristic day planner
│   │   ├── customize-day.use-case.ts
│   │   └── confirm-scratch-availability.use-case.ts
│   ├── validators/
│   │   ├── budget-cap.validator.ts                  ← live tracker enforcement
│   │   ├── travel-time.validator.ts                 ← multi-city realism
│   │   └── opening-hours.validator.ts
│   ├── dto/
│   ├── interfaces/
│   └── build-from-scratch.module.ts
```

**Rule:** Each module's public surface is **just** "produce a `JourneyConfiguration` row" — never a `Booking` row. This is the firewall that keeps methods independent.

### Boundary 2 — Shared Configuration Store

```
src/modules/journey-configurations/   ← shared across all 3 methods
├── use-cases/
│   ├── persist-configuration.use-case.ts    ← all 3 methods write here
│   ├── load-configuration.use-case.ts
│   ├── freeze-configuration.use-case.ts     ← availability/confirm
│   └── expire-stale-configs.use-case.ts     ← cron entrypoint
├── interfaces/
│   └── journey-configuration.interface.ts   ← discriminated by method: M1 | M2 | M3
└── journey-configurations.module.ts
```

**Schema addition** (Phase 2 owns):

```prisma
enum BookingMethod {
  PUBLIC_PACKAGE
  PRIVATE_PREBUILT
  BUILD_FROM_SCRATCH
}

enum ConfigStatus {
  DRAFT          // saved by user, no inventory commitment
  CONFIRMED      // availability/confirm passed, ready to book within TTL
  BOOKED         // converted to a Booking row
  EXPIRED        // TTL elapsed without booking
}

model JourneyConfiguration {
  id            String         @id @default(uuid())
  userId        String
  method        BookingMethod
  tripId        String?        // null for BUILD_FROM_SCRATCH
  snapshot      Json           // full validated journey map at confirmation time
  totalPriceUsd Decimal        @db.Decimal(10, 2)
  expiresAt     DateTime       @db.Timestamptz()  // 7 days for DRAFT; 15 min for CONFIRMED
  status        ConfigStatus
  createdAt     DateTime       @default(now()) @db.Timestamptz()
  updatedAt     DateTime       @updatedAt @db.Timestamptz()
  deletedAt     DateTime?      @db.Timestamptz()

  user          User           @relation(fields: [userId], references: [id])
  trip          Trip?          @relation(fields: [tripId], references: [id])
  booking       Booking?       // 1:1 once converted

  @@index([userId, status])
  @@index([expiresAt, status])
}
```

### Boundary 3 — Shared Booking Commit (the only place that writes `Booking`)

This is what the **current** plan should become — keep almost everything, but rename and re-scope:

```
src/modules/bookings/
├── use-cases/
│   ├── commit-booking.use-case.ts          ← SHARED: takes configurationId, runs atomic TX
│   ├── list-bookings.use-case.ts           ← (current plan — keep)
│   ├── get-booking-detail.use-case.ts      ← (keep)
│   ├── update-booking.use-case.ts          ← HOLD only (keep)
│   ├── cancel-booking.use-case.ts          ← (keep, with refund tiers)
│   ├── get-booking-qr.use-case.ts          ← (keep)
│   ├── get-booking-ical.use-case.ts        ← (keep)
│   └── expire-hold.use-case.ts             ← (keep)
├── utils/                                   ← (keep entire utils plan as-is)
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

#### `commit-booking.use-case.ts` — the single atomic boundary

```ts
async execute(user: JwtPayload, configurationId: string, idempotencyKey?: string): Promise<Booking> {
  // 1. Idempotency check (return cached body if key seen)
  // 2. Load JourneyConfiguration (status === CONFIRMED, not expired, owner = user.sub)
  // 3. prisma.$transaction(async (tx) => {
  //      a. SELECT FOR UPDATE on every resource referenced in the snapshot
  //         (hotel rooms, transportation vehicles, guides) — atomic lock
  //      b. checkOverlap on each → throw 409 BKNG_UNAVAILABLE on any conflict
  //      c. INSERT Booking { status: HOLD, holdExpiresAt: now()+15min, reference }
  //      d. INSERT BookingItem[] (one per leaf resource in the journey map)
  //      e. UPDATE JourneyConfiguration.status = BOOKED
  //      f. INSERT outbox_events (email, push, qr_generation) — pending status
  //    });
  // 4. setHold (Redis TTL 900s, fallback to holdExpiresAt timestamp if Redis down)
  // 5. Emit booking.created event
  // 6. Cache idempotency response
  // 7. Return mapped Booking DTO
}
```

### Boundary 4 — Routing the 3 Methods

| Method | Configuration endpoint | Notes |
|--------|------------------------|-------|
| M1 | `POST /v1/public-packages/:tripId/configurations` | Activity-pool swap only |
| M2 | `POST /v1/private-packages/:tripId/configurations` | Day reorder + full customization, OR `?as_is=true` |
| M3 | `POST /v1/trips/build-from-scratch/configurations` | Multi-step wizard; basics form first |

| Shared endpoint | Purpose |
|-----------------|---------|
| `POST /v1/availability/check` | Fast availability probe (cached 2 min) — used during customization |
| `POST /v1/availability/confirm` | Fresh availability check, freezes a `CONFIRMED` configuration with 15-min TTL |
| `POST /v1/bookings` | Atomic commit — body: `{ configurationId, idempotencyKey? }` |
| `POST /v1/journey-drafts` | Save a `DRAFT` configuration for later (7-day TTL) |
| `GET /v1/journey-drafts` | List user's saved drafts |

This means each method can evolve independently:
- Change M3's skeleton-generation algorithm without touching the booking TX.
- Change refund tiers without touching M1's customization rules.
- Add a new method M4 (e.g., AI-chat booking) by adding one config module — booking commit is unchanged.

---

## 5. Mismatches in Current `feature-specs/2026-05-23-booking-engine/`

| # | Mismatch | Severity | Required Fix |
|---|----------|----------|--------------|
| 1 | Plan books standalone `guide` / `hotel` / `transport` — workflows book composed `TRIP` journeys | 🔴 Blocker | Replace 3 inventory endpoints with single `POST /v1/bookings { configurationId }` |
| 2 | `requirements.md` § "Out of scope" defers trip bookings "until a product decision lands" — the decision IS the workflow docs | 🔴 Blocker | Trip bookings are **in scope**; that's the whole feature |
| 3 | No `JourneyConfiguration` model / module planned | 🔴 Blocker | Add to Phase 2 schema split + new `journey-configurations` module |
| 4 | Decision #13 explicitly skips the `BookingItem` / line-item table | 🔴 Blocker | Multi-resource trips REQUIRE line items (hotel + transport + guide rows per booking) |
| 5 | No `availability/check` or `availability/confirm` endpoints | 🟡 Major | These are the workflow's pre-checkout gate — required for all 3 methods |
| 6 | No `journey-drafts` endpoints | 🟡 Major | "Save my journey" appears in M1 + M2 + M3 |
| 7 | `booking-transaction-methods.md` not in References list | 🟡 Major | This doc dictates the architecture; cite it in `requirements.md` § References |
| 8 | Refund tiers say `< 3 days = 0%` but `flow.md` § 6 says `<24h = 0%` and `1–7 days = 50%` | 🟡 Inconsistency | Reconcile with `CONSTITUTION.md` § 9.3 — pick one and update both |
| 9 | Outbox pattern for side-effects (email/push/QR) not in plan | 🟡 Major | Method 3's selling point — required to keep booking TX fast |
| 10 | No `SELECT FOR UPDATE` per Risk R1 — workflow explicitly uses it | 🟠 Risk acknowledged | Plan documents this as deferred; workflow says it's needed in MVP |
| 11 | Plan ships `POST /v1/transportation/bookings` for raw vehicle booking — no path for trip-with-transport | 🔴 Blocker | Same root cause as #1 |
| 12 | Plan emits `booking.created` only — workflow needs `booking.confirmed` (post-payment) for downstream side effects | 🟡 Minor | Add to event catalog (Phase 6 owns the trigger) |
| 13 | No "hold extension" endpoint (`POST /bookings/:id/extend-hold`) — workflow allows +5 min once | 🟡 Minor | Add to Phase 5 OR defer to Phase 6 (payments) |
| 14 | No `GET /v1/bookings/:id/contacts` endpoint — workflow reveals driver/guide contacts 24h before trip | 🟡 Minor | Could defer to Phase 7 or 8 (notifications) |

---

## 6. Updated NFR Targets (from workflow inspection)

The workflow imposes constraints not currently captured in `requirements.md`:

| Concern | Target | Source |
|---------|--------|--------|
| Configuration creation | < 800 ms p95 | New — based on validation complexity |
| Availability check (cached) | < 100 ms p95 | Implicit in `/availability/check` 2 min cache |
| Availability confirm (fresh) | < 500 ms p95 | Pre-checkout gate, blocking |
| Booking commit (atomic TX) | < 500 ms p95 | Already in `MISSION.md` |
| Outbox processor lag | < 30 s p95 | New — email/push delivery SLA |
| Hold TTL | 900 s exact | `CONSTITUTION.md` § 9.1 |
| Configuration TTL (CONFIRMED) | 900 s | Matches hold TTL |
| Configuration TTL (DRAFT) | 7 days | Workflow `Phase 3: Save or Confirm` |

---

## 7. Recommended Re-Scope Path

Three options, ranked by safety:

### Option 1 (recommended) — Re-scope Phase 5 cleanly

Split into two sub-phases:

**Phase 5a — Booking primitives + commit infrastructure** (this branch)
- Keep: all utils (`check-overlap`, `compute-refund`, `transition-status`, `set-hold`, `release-hold`, `generate-reference`, `idempotency`, `map-booking`, `build-ical`)
- Keep: unified read surface (`GET /v1/bookings`, `GET /v1/bookings/:id`)
- Keep: cancel + update + QR + iCal endpoints
- **Replace:** the 3 creation endpoints with the single `POST /v1/bookings { configurationId }` (commit-booking use case)
- **Add:** `BookingItem` line-item model (Phase 2 dependency)
- **Defer to 5b:** the 3 method config modules + `JourneyConfiguration` schema

**Phase 5b — Method modules + configuration store** (next branch)
- `journey-configurations` shared module
- `public-package-config` (M1)
- `private-prebuilt-config` (M2)
- `build-from-scratch` (M3)
- `availability/check` + `availability/confirm` endpoints
- `journey-drafts` endpoints

**Pros:** Sequential rollout matches the plan's "one module at a time" rule. Each phase is reviewable.
**Cons:** Phase 5a ships a `commit-booking` endpoint with no callers until 5b lands; need to gate it behind a feature flag or seed configurations manually for the smoke test.

---

### Option 2 — Rewrite the spec triplet

Rewrite `requirements.md` / `plan.md` / `validation.md` end-to-end to match Design C with all 3 method modules. Single large branch.

**Pros:** One coherent merge, no orphan endpoints.
**Cons:** Branch grows to ~80 files; violates the "one module at a time" rule; high review burden.

---

### Option 3 — Hybrid: keep current 5 as foundations, add 5b on top

Treat the current plan as "internal helpers" — the use cases stay but are no longer exposed as HTTP endpoints. They become injected helpers consumed by the method modules.

**Pros:** No work thrown away.
**Cons:** Confusing for reviewers ("why are these guide/hotel booking use cases never called?"). Risks dead-code accumulation.

---

## 8. Decision Required

To proceed I need an answer on:

| Question | Default if unanswered |
|----------|----------------------|
| Which re-scope path: Option 1 / 2 / 3? | Option 1 |
| Should the `commit-booking` use case be feature-flagged in 5a? | Yes (off in prod, on in dev) |
| Does Phase 2 schema split include `JourneyConfiguration` + `BookingItem`? | Must — block on senior |
| Refund tier reconciliation: which doc wins (`CONSTITUTION.md` § 9.3 or `flow.md` § 6)? | `CONSTITUTION.md` (it's the source of truth) |
| AI agent booking (Phase 9) — is that a 4th method or does it call M1/M2/M3 internally? | Calls existing methods (preferred) |

---

## 9. References

- `docs/workflows/booking-transaction-methods.md` — **architectural source of truth** (Method 3)
- `docs/workflows/package-booking/01-homepage-search-package-journey.md` — M1 spec
- `docs/workflows/customize-package/01-prebuilt-private-package.md` — M2 spec
- `docs/workflows/customize-package/02-build-from-scratch.md` — M3 spec
- `docs/workflows/package-booking/flow.md` — M1 mermaid diagrams + state machine
- `docs/workflows/customize-package/flow.md` — M2 + M3 mermaid diagrams
- `backend/context/guides/CONSTITUTION.md` § 9 — Booking & Payment Rules
- `backend/context/specs/SCHEMA.md` — current `Booking` model (needs `BookingItem` + `JourneyConfiguration` additions)
- `backend/context/specs/API-CONTRACT.md` § 11 — current contract (needs amendment)
- `backend/context/specs/EVENT-CATALOG.md` — `booking.created` / `booking.cancelled` / `booking.expired` payloads
- `backend/context/feature-specs/2026-05-23-booking-engine/requirements.md` — current Phase 5 requirements (this analysis identifies gaps)
- `backend/context/feature-specs/2026-05-23-booking-engine/plan.md` — current Phase 5 plan (this analysis identifies gaps)
- `backend/context/feature-specs/2026-05-23-booking-engine/validation.md` — current Phase 5 validation matrix
