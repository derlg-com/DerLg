# Requirements: Specific Booking + Admin Inventory Management (Foundation Layer)

> **Feature:** Phase 5a — (1) Specific Booking (single-resource / à-la-carte customer bookings) + (2) Admin Inventory Management (CRUD for the inventory M4 books against)
> **Customer scope:** Method **M4** from `../booking-methods.md` (M4a transportation, M4b hotel, M4c guide, M4d single-trip-as-is)
> **Admin scope:** CRUD + status management for `TransportationVehicle`, `Hotel`, `HotelRoom`, `Guide`, `Trip` — paired with M4 so admins can keep the bookable catalog current. Without this, the catalog is frozen on whatever Phase 2 seeded.
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a
> **Date:** 2026-05-24
> **Tests:** Critical paths only this branch. Unit tests are required for the high-risk pieces (overlap detection, hold TTL behaviour, refund tier calculation, status state machine, atomic commit, **admin role guard**). Controller-level and full E2E coverage are deferred to a follow-up branch and remain a hard prerequisite of `TEST-PLAN.md` (Bookings = 90 % unit + integration + E2E + property) before merge to `main`.

---

## Scope

### In scope (foundation layer — M4 + Admin Inventory)

This branch ships **two coordinated parts** that share the same atomic-commit primitive and the same resource models:

- **Part A — Customer M4 bookings** (`SpecificBookingModule`): a tourist books a single inventory item directly.
- **Part B — Admin inventory management** (`AdminInventoryModule`): an admin creates / updates / deactivates the inventory items M4 books against (vehicles, hotels, rooms, guides, trips).

Both parts are required for a working foundation. Without Part B, admins cannot add a new tuk-tuk to the fleet, mark a hotel room as out-of-service for maintenance, or temporarily suspend a guide — all critical to keeping M4 honest.

---

### Part A — Customer M4 Bookings

#### Modules

- **`BookingsModule`** — shared read/update/cancel surface + atomic commit primitive. Lives at `src/modules/bookings/`.
- **`SpecificBookingModule`** — M4 customer endpoints only. Lives at `src/modules/specific-booking/`. Each use case builds a `CommitInput` and delegates to `commit-booking.use-case.ts` in `BookingsModule`.

#### Booking-creation endpoints (4 — one per resource kind)

| Method | Endpoint | Reference prefix | Notes |
|--------|----------|------------------|-------|
| M4a | `POST /v1/transportation/bookings` | `TRN-` | Body: `{ vehicleId, startDate, endDate, specialRequests? }` |
| M4b | `POST /v1/hotels/:hotelId/bookings` | `HTL-` | Body: `{ roomId, checkInDate, checkOutDate, guestsAdults, guestsChildren?, specialRequests? }` |
| M4c | `POST /v1/guides/:guideId/bookings` | `GDE-` | Body: `{ startDate, endDate, specialRequests? }` |
| M4d | `POST /v1/trips/:tripId/bookings` | `TRP-` | Body: `{ startDate, travelers: { adults, children? }, specialRequests? }`. The trip is booked **as-is** (default journey map snapshot copied into one `BookingItem`) — no customization. |

Each endpoint:
1. Honours `Idempotency-Key` header (per `CONSTITUTION.md` § 2.5).
2. Validates inventory exists, is `ACTIVE`, and not soft-deleted.
3. Calls `commit-booking.use-case.ts` with a `CommitInput` carrying exactly **one** `BookingItem`.
4. Returns `Booking` (status `HOLD`) with `holdExpiresAt`, `reference`, and the inserted line item.

#### Unified booking surface (read + lifecycle, shared across all methods)

- `GET /v1/bookings` — list current user's bookings (paginated, optional `status` and `method` filters)
- `GET /v1/bookings/:id` — booking detail (includes `BookingItem[]`)
- `PATCH /v1/bookings/:id` — update before confirmation (HOLD only — adjust dates / guests / notes)
- `POST /v1/bookings/:id/cancel` — cancel with tiered refund calculation
- `GET /v1/bookings/:id/qr` — booking QR code (uses existing reference)
- `GET /v1/bookings/:id/ical` — iCalendar export (`text/calendar`)

#### Atomic commit primitive (`commit-booking.use-case.ts`)

Single use case in `BookingsModule` that all 4 specific-booking endpoints (and later M1/M2/M3) call. Performs:

1. Idempotency lookup (return cached body if `Idempotency-Key` already seen for this user).
2. Inside `prisma.$transaction`:
   - For every leaf resource in `CommitInput.items`, query existing `Booking → BookingItem` rows in `HOLD`, `PENDING_PAYMENT`, `CONFIRMED` for the same resource id and overlapping date range. Conflict → throw `409 BKNG_UNAVAILABLE`.
   - Insert `Booking` row (`status: HOLD`, `holdExpiresAt: now() + 15min`, `reference`, `method`, `singleResourceKind`).
   - Insert one `BookingItem` per element of `CommitInput.items` (M4 always = exactly 1; M1/M2/M3 will pass many).
3. Set Redis hold key `booking_hold:{bookingId}` with TTL 900 s.
4. Emit `booking.created` event with payload conforming to `EVENT-CATALOG.md` (extended with `method` field — see § Decisions #6).
5. Cache idempotency response.
6. Return mapped `Booking` DTO.

#### Schema additions (Phase 2 dependency)

The Phase 2 schema split (in progress by senior) **must** add:

- `BookingMethod` enum: `PUBLIC_PACKAGE`, `PRIVATE_PREBUILT`, `BUILD_FROM_SCRATCH`, `SINGLE_RESOURCE`.
- `SingleResourceKind` enum: `TRANSPORTATION`, `HOTEL`, `GUIDE`, `TRIP`.
- `Booking.method: BookingMethod` (non-null).
- `Booking.singleResourceKind: SingleResourceKind?` (set only when `method = SINGLE_RESOURCE`).
- `Booking.configurationId: String?` (null for M4; set for M1/M2/M3 in Phase 5b).
- New `BookingItem` model (line items, one row per leaf resource per booking). Fields: `bookingId`, `itemType` (`HOTEL | TRANSPORTATION | GUIDE | TRIP | ACTIVITY`), `resourceId`, `startDate`, `endDate`, `quantity`, `unitPriceUsd`, `subtotalUsd`, `snapshot: Json` (resource snapshot at booking time), `createdAt`.

This branch builds **against** that schema. If senior has not landed the split when this branch starts, this branch ships its own minimal migration adding `Booking.method`, `Booking.singleResourceKind`, `Booking.configurationId` (nullable for now), and the `BookingItem` model. The migration is forward-compatible with whatever full split senior eventually merges.

#### Shared utilities (in `bookings/utils/`)

- `check-overlap.util.ts` — pure boolean overlap predicate (used by `commit-booking`).
- `compute-refund.util.ts` — pure refund tier calculation (`> 7 days = 100 %`, `3–7 days = 50 %`, `< 3 days = 0 %` per `CONSTITUTION.md` § 9.3).
- `transition-status.util.ts` — pure state-machine guard.
- `set-hold.util.ts` — `@Injectable()` Redis writer.
- `release-hold.util.ts` — `@Injectable()` Redis deleter.
- `generate-reference.util.ts` — `<KIND>-<6CHAR>` from `crypto.randomUUID()`, base32-uppercase.
- `idempotency.util.ts` — `@Injectable()` Redis read/write for `idem:booking:{userId}:{key}`.
- `map-booking.util.ts` — pure mappers (Prisma row → DTO).
- `build-ical.util.ts` — pure RFC 5545 builder.

#### Authorization

Every endpoint resolves the booking via the `userId` claim from the JWT. `BKNG_NOT_AUTHOR` (403) for cross-user access. `@CurrentUser()` from Phase 1 used throughout. `@Public()` is **not** used anywhere in this branch.

#### Soft delete awareness

Every query filters `deletedAt: null` on `Booking`, `BookingItem`, and the inventory tables (`HotelRoom`, `TransportationVehicle`, `Guide`, `Trip`).

#### Response envelope

`{ success, data }` via the existing global `TransformInterceptor`.

#### Critical-path unit tests

| File | Asserts |
|------|---------|
| `bookings/utils/check-overlap.util.spec.ts` | Full / partial / equal / adjacent / empty / single-day / swapped boundaries. |
| `bookings/utils/compute-refund.util.spec.ts` | Tier boundaries (exact 3 days, exact 7 days, future-bound dates, zero amount, decimal preservation). |
| `bookings/utils/transition-status.util.spec.ts` | Every legal transition succeeds; every illegal one throws with the documented `BKNG_*` code. |
| `bookings/use-cases/commit-booking.use-case.spec.ts` | Hold key written `booking_hold:<id>` with TTL 900; overlap throws `409 BKNG_UNAVAILABLE`; one `BookingItem` inserted per element of `CommitInput.items`; `booking.created` emitted with `method` field; idempotent retry returns cached body. |
| `bookings/use-cases/cancel-booking.use-case.spec.ts` | 100 % / 50 % / 0 % refund tiers; already-cancelled throws `BKNG_ALREADY_CANCELLED`; payment-processing throws `BKNG_PAYMENT_PENDING`; hold key released; `booking.cancelled` emitted. |

#### Domain event emission stubs

`booking.created`, `booking.cancelled`, `booking.expired` are emitted via `EventEmitter2`. Phase 8 owns wiring + handlers; this branch only emits the typed payloads. The `booking.created` payload is extended with `method: BookingMethod` and (when applicable) `singleResourceKind: SingleResourceKind` so downstream handlers can route by method.

---

### Part B — Admin Inventory Management

#### Module

- **`AdminInventoryModule`** — admin-only CRUD + status management for the inventory tables M4 books against. Lives at `src/modules/admin-inventory/`. Mounted under the `/v1/admin/*` URL prefix. **Strictly separated from the customer modules** so admin code paths never accidentally execute on customer requests.

#### Resources covered

Five inventory types — exactly the set M4 books against:

| Resource | Customer use (M4) | Admin endpoints |
|----------|-------------------|-----------------|
| `TransportationVehicle` | M4a books it | List / Create / Detail / Update / Soft-delete / Set status |
| `Hotel` | M4b books rooms inside it | List / Create / Detail / Update / Soft-delete / Set status |
| `HotelRoom` | M4b books a specific room | List under hotel / Create / Detail / Update / Soft-delete / Set status |
| `Guide` | M4c books it | List / Create / Detail / Update / Soft-delete / Set status |
| `Trip` | M4d books it as-is | List / Create / Detail / Update / Soft-delete / Set status |

#### Admin endpoints (per resource — uniform shape)

The same 6-endpoint pattern applies to every resource. Replace `<resource>` with `transportation`, `hotels`, `hotels/:hotelId/rooms`, `guides`, or `trips`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/v1/admin/<resource>` | Paginated list (admin view — includes `INACTIVE` and `SUSPENDED` rows that customer endpoints filter out) |
| `POST` | `/v1/admin/<resource>` | Create — body matches the resource schema; new rows default to `status: ACTIVE` |
| `GET` | `/v1/admin/<resource>/:id` | Detail (full row including audit fields) |
| `PATCH` | `/v1/admin/<resource>/:id` | Partial update — every field on the resource is mutable except `id`, `createdAt`, `createdBy` |
| `DELETE` | `/v1/admin/<resource>/:id` | Soft-delete (`deletedAt = now()`); returns `204` on success |
| `POST` | `/v1/admin/<resource>/:id/status` | Transition status (`ACTIVE → INACTIVE / SUSPENDED → ACTIVE` etc.) |

That's **30 endpoints total** (6 endpoints × 5 resources). Each is implemented as a single use-case class delegating to `PrismaService` directly.

#### Authorization

- **All admin endpoints require `role: 'ADMIN'`** in the JWT payload (or `role: 'SUPER_ADMIN'` if the `Role` enum already supports it from Phase 3).
- Implemented via a new `RolesGuard` (in `src/common/guards/roles.guard.ts`) and a `@Roles('ADMIN')` decorator. The guard runs **after** the global `JwtAuthGuard` from Phase 1.
- Non-admin requests return `403 ADMIN_FORBIDDEN`.
- Missing/invalid token returns `401 AUTH_UNAUTHORIZED` (already provided by Phase 1).
- The decorator is applied at the **controller** level on `AdminInventoryController` so it cannot be forgotten on individual handlers.

#### Status state machine (per resource)

All five inventory types share a uniform status enum (`ResourceStatus`):

```
ACTIVE       — bookable by customers
INACTIVE     — admin-disabled (not visible in customer listings, blocks new M4 bookings)
SUSPENDED    — temporarily suspended (e.g., guide on leave, vehicle under maintenance)
```

Legal transitions (enforced by a pure helper `assertResourceTransition(from, to)`):
- `ACTIVE → INACTIVE | SUSPENDED`
- `INACTIVE → ACTIVE`
- `SUSPENDED → ACTIVE | INACTIVE`

Illegal transitions throw `400 ADMIN_INVALID_STATUS_TRANSITION`.

#### Customer-impact rules (status changes)

When an admin transitions a resource away from `ACTIVE`:

| Trigger | Effect on existing bookings | Effect on new bookings |
|---------|----------------------------|------------------------|
| `ACTIVE → INACTIVE` | Existing `HOLD` / `PENDING_PAYMENT` / `CONFIRMED` bookings keep their status (admin cannot retroactively cancel customer bookings here — that's Phase 11 admin-cancel) | New M4 attempts return `409 BKNG_UNAVAILABLE` |
| `ACTIVE → SUSPENDED` | Same as above | Same as above |
| Soft-delete (`DELETE`) | Same as above | New M4 attempts return `404 <RES>_NOT_FOUND` |

> **Decision:** Admin-initiated cancellation of existing customer bookings (with refund flow) is out of scope for this branch — it lands in Phase 11 (admin booking surfaces). This branch's admin endpoints affect only **future** booking attempts.

#### Validation (per resource)

Each resource has its own DTO with class-validator rules matching the existing Phase 4 catalog DTOs. Examples:

- **Transportation:** `label` (string, 1–120 chars), `type` ∈ `VAN | PRIVATE_CAR | TUK_TUK | BUS`, `capacity` (int, 1–50), `pricePerDayUsd` (Decimal, ≥ 0), `licensePlate` (regex), `images` (array of URLs), `description?`.
- **Hotel:** `name` (string), `location` (lat/lng), `address`, `description`, `amenities` (string[]), `images`.
- **HotelRoom:** `hotelId` (uuid, parent), `roomType` (string), `capacity` (int, 1–10), `pricePerNightUsd` (Decimal, ≥ 0), `bedConfiguration` (enum), `images`.
- **Guide:** `fullName`, `languages` (array of ISO codes), `specialities` (string[]), `pricePerDayUsd` (Decimal, ≥ 0), `bio?`, `avatarUrl?`.
- **Trip:** `name`, `slug` (kebab-case, unique), `tripType` ∈ `PUBLIC | PRIVATE`, `durationDays` (int, ≥ 1), `priceUsd` (Decimal, ≥ 0), `category`, `location`, `defaultJourneyMap` (JSONB validated against the journey-map schema in `SCHEMA.md`).

All Update DTOs use `PartialType()` from `@nestjs/mapped-types` so admins can patch any subset of fields.

#### Audit logging

Every admin write (`POST`, `PATCH`, `DELETE`, `POST /status`) emits an audit record via the Phase 1 `AuditLog` writer (or scaffolds one if Phase 1 didn't ship it):

```ts
{
  actorId: user.sub,           // admin user UUID
  actorRole: 'ADMIN',
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE',
  resourceType: 'TransportationVehicle' | 'Hotel' | 'HotelRoom' | 'Guide' | 'Trip',
  resourceId: '<uuid>',
  diff: { before: {...}, after: {...} },  // null for CREATE; full row for DELETE
  occurredAt: <timestamp>,
}
```

- Uses an `audit_logs` table (already in `SCHEMA.md` per `CONSTITUTION.md` § Audit Logging). If Phase 1 didn't land it, this branch ships the migration.
- The audit write is **inside the same `prisma.$transaction`** as the resource mutation — no risk of an unwritten audit on a successful change.

#### Idempotency (admin)

- Admin `POST` endpoints (create) honour `Idempotency-Key` (per `CONSTITUTION.md` § 2.5), reusing the same `idempotency.util.ts` from Part A but with a different namespace: `idem:admin:{userId}:{key}` (TTL 24 h).
- Admin `PATCH`, `DELETE`, `POST /status` are **naturally idempotent** by URL semantics — no header required.

#### Admin module endpoints (full list)

```
# Transportation
GET    /v1/admin/transportation
POST   /v1/admin/transportation
GET    /v1/admin/transportation/:id
PATCH  /v1/admin/transportation/:id
DELETE /v1/admin/transportation/:id
POST   /v1/admin/transportation/:id/status

# Hotels
GET    /v1/admin/hotels
POST   /v1/admin/hotels
GET    /v1/admin/hotels/:id
PATCH  /v1/admin/hotels/:id
DELETE /v1/admin/hotels/:id
POST   /v1/admin/hotels/:id/status

# Hotel rooms (nested under hotel)
GET    /v1/admin/hotels/:hotelId/rooms
POST   /v1/admin/hotels/:hotelId/rooms
GET    /v1/admin/hotels/:hotelId/rooms/:roomId
PATCH  /v1/admin/hotels/:hotelId/rooms/:roomId
DELETE /v1/admin/hotels/:hotelId/rooms/:roomId
POST   /v1/admin/hotels/:hotelId/rooms/:roomId/status

# Guides
GET    /v1/admin/guides
POST   /v1/admin/guides
GET    /v1/admin/guides/:id
PATCH  /v1/admin/guides/:id
DELETE /v1/admin/guides/:id
POST   /v1/admin/guides/:id/status

# Trips
GET    /v1/admin/trips
POST   /v1/admin/trips
GET    /v1/admin/trips/:id
PATCH  /v1/admin/trips/:id
DELETE /v1/admin/trips/:id
POST   /v1/admin/trips/:id/status
```

#### Critical-path unit tests (Part B)

| File | Asserts |
|------|---------|
| `common/guards/roles.guard.spec.ts` | Allows `ADMIN`; allows `SUPER_ADMIN`; denies `USER` (403); denies missing role claim (403); denies missing user (the global `JwtAuthGuard` already returned 401, but the guard fails closed). |
| `admin-inventory/utils/assert-resource-transition.util.spec.ts` | Every legal transition succeeds; every illegal transition throws `400 ADMIN_INVALID_STATUS_TRANSITION`. |
| `admin-inventory/use-cases/admin-update-transportation.use-case.spec.ts` | Verifies happy-path UPDATE writes the audit log row (with correct `before` / `after` diff) inside the same transaction. (One representative use case — UPDATE on transportation — covers the audit-log integrity for the entire admin module.) |

The full controller integration tests for all 30 admin endpoints are **deferred** to the same follow-up branch as the customer-side coverage gate.

#### Domain event emission (Part B)

For now, no admin-specific events are emitted by this branch. (Phase 11 admin surfaces will add `inventory.created` / `inventory.deactivated` / etc. when an admin dashboard needs real-time updates.) The audit log is the only persistent record this branch ships.

---

### Out of scope

- **M1 / M2 / M3 method modules** (composed-trip flows with journey-map customization) — separate folders + branches:
  - `package-booking/` (Phase 5b)
  - `build-from-scratch/` (Phase 5c)
- **`JourneyConfiguration` model and module** — Phase 5b owns. M4 does not need it.
- **`POST /v1/availability/check` and `/v1/availability/confirm`** — Phase 5b. M4 single-shots availability inside the commit transaction.
- **`POST /v1/journey-drafts`** — Phase 5b. M4 has no draft concept.
- **The unified `POST /v1/bookings` body that takes `{ configurationId }`** — Phase 5b. This branch only ships the four inventory-prefixed M4 endpoints + the shared read/update/cancel/qr/ical surface.
- **Cron scheduler for hold expiry** — the scheduler ships in Phase 8. This branch ships the use case the cron will call (`expire-hold.use-case.ts`).
- **Stripe payment intent creation, webhooks, refund processor calls** — Phase 6. This branch's `cancel` endpoint calculates the refund **amount and percentage** and persists `Booking.status = CANCELLED`. The actual Stripe `refunds.create` call lands in Phase 6 and consumes the `booking.cancelled` event payload.
- **Hold extension (`POST /v1/bookings/:id/extend-hold`)** — Phase 6 (decision in `../booking-methods.md` § 9 Q3). Coupled with payment retry semantics.
- **Notification emails / push** — Phase 8 consumes the events. This branch only emits.
- **Loyalty point accrual on confirmation** — Phase 7. `booking.confirmed` is emitted on payment-side; this branch does not handle confirmation transition (that fires from `payment.completed` in Phase 6).
- **Reviews / favourites against bookings** — Phase 7.
- **Admin booking surfaces** — Phase 11. Specifically: admin-initiated cancellation of **existing customer bookings** (with refund flow), admin search across all users' bookings, admin override of overlap checks, admin force-confirm. Part B in this branch only covers **inventory** management (the rows M4 books against), not customer bookings.
- **Admin user management** (creating other admin users, role escalation, RBAC tuning) — Phase 11. This branch assumes Phase 3 already ships an admin-role-capable JWT.
- **Admin dashboard / UI** — frontend phase. This branch ships only the API surface.
- **Real-time admin events** (`inventory.created`, `inventory.deactivated`) — Phase 11 when an admin dashboard needs live updates.
- **Bulk admin operations** (CSV import, bulk status change) — out of scope for this branch; per-row endpoints only.
- **Property-based tests, full E2E (`bookings.e2e-spec.ts`), controller integration tests, 90 % coverage gate** — deferred to a follow-up branch by user direction. `TEST-PLAN.md` § 2 (Bookings = 90 %) and § 3.2 / § 3.3 / § 3.6 are **not** satisfied by this branch and must be restored before merge to `main`.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Two modules, not one.** `BookingsModule` (shared infrastructure: commit primitive, read/update/cancel surface, utilities) + `SpecificBookingModule` (4 M4 endpoints, each a thin DTO-mapper that builds `CommitInput` and delegates). | Keeps M4-specific code isolated so Phase 5b modules (M1/M2/M3) can import the same `commit-booking.use-case.ts` without depending on M4. Mirrors the boundary rule in `../booking-methods.md` § 4: only `commit-booking` writes to `Booking`. |
| 2 | **Use-case pattern** matching `src/modules/auth/` and `src/modules/<catalog>/` — one `*UseCase` class per endpoint, single `execute()`, **no `<feature>.service.ts`**. | Consistent with Phase 3 + Phase 4. Makes per-use-case unit tests trivial. |
| 3 | **`commit-booking.use-case.ts` lives in `bookings/use-cases/`**, not in `specific-booking/`. | It is **the** atomic commit primitive — shared by all 4 methods (M1–M4). Putting it in `specific-booking/` would force M1/M2/M3 to import from a method-specific module. |
| 4 | **`SpecificBookingModule` controllers carry inventory-prefixed routes**, e.g. `@Controller()` with `@Post('transportation/bookings')`, `@Post('hotels/:hotelId/bookings')`, `@Post('guides/:guideId/bookings')`, `@Post('trips/:tripId/bookings')`. | Matches the URL shapes in `../booking-methods.md` § 5. Frontend already calls these paths. |
| 5 | **Always insert exactly one `BookingItem` per M4 booking.** Even though it's redundant when there's only one resource, it keeps the data model uniform across all 4 methods. | M1/M2/M3 will write many `BookingItem` rows per `Booking`. If M4 wrote zero, every read query would need a method-conditional `JOIN`. Uniformity beats one row of duplication. |
| 6 | **Extend `booking.created` event payload with `method` and `singleResourceKind`**. | Phase 8 handlers route by method (e.g., M4 transport-only confirmation email is shorter than M1 multi-day journey). Adding the discriminator now costs zero; retrofitting later would require a versioned event. `EVENT-CATALOG.md` must be updated alongside. |
| 7 | **Reference prefix per resource kind** (`TRN-`, `HTL-`, `GDE-`, `TRP-`) for M4. M1/M2/M3 will use `PKG-`, `PRV-`, `CSM-` respectively in Phase 5b. | Customer support routing — the prefix tells the agent which inventory team to escalate to. Generator takes a `kind` argument; collision retry up to 3× on `P2002`. |
| 8 | **Overlap check inside `prisma.$transaction`** with `findMany({ where: { resource_match, status: { in: [HOLD, PENDING_PAYMENT, CONFIRMED] }, NOT: overlap_predicate } })`, then `create` in the same transaction. | `CONSTITUTION.md` § 9.1 spec. Prevents TOCTOU. Postgres default isolation (`READ COMMITTED`) is acceptable for MVP; hardening with `SELECT FOR UPDATE` or unique GIST index on `(resource_id, daterange)` is deferred (see Risk R1). |
| 9 | **Redis hold key `booking_hold:{bookingId}` TTL = 900 s**, env-overridable via `BOOKING_HOLD_TTL_SECONDS`. | `CONSTITUTION.md` § 3.3 + § 9.1 verbatim. Single source of truth for "is this hold still alive". |
| 10 | **Idempotency via Redis** (`idem:booking:{userId}:{key}` → response body, TTL 24 h). | `CONSTITUTION.md` § 2.5: idempotency required for booking creation. Redis is already in the stack. |
| 11 | **iCal generation is a pure util** (`build-ical.util.ts`) producing an RFC 5545 string. | Avoids pulling in `ical-generator` for one endpoint. The format is small and stable. |
| 12 | **QR code returns the `qrCodeUrl` field** populated as `${FRONTEND_URL}/bookings/${reference}/qr` (placeholder until Phase 6 hooks Bakong/ABA). | Matches `API-CONTRACT.md` § 11 response shape. Phase 6 swaps the URL for a CDN-hosted PNG. |
| 13 | **Cron entrypoint shipped, schedule deferred**. `expire-hold.use-case.ts` lives here so it can be unit-tested. The `@Cron` registration lands in Phase 8. | ROADMAP § 8 explicitly owns scheduler wiring. |
| 14 | **Admin inventory ships in the same branch as M4 customer bookings.** Two coordinated parts (`SpecificBookingModule` + `AdminInventoryModule`) but one merge. | The two are tightly coupled — M4 bookings are useless without admins to seed and update inventory. Shipping them together avoids a stub period where customers can book frozen catalog rows. The boundary is enforced by separate modules + URL prefixes (`/v1/...` vs `/v1/admin/...`), not by separate branches. |
| 15 | **`AdminInventoryModule` lives at `src/modules/admin-inventory/`** under a single module containing all five resource controllers. | Five tightly-related controllers with identical 6-endpoint shapes — splitting them into five modules adds boilerplate without isolation benefit. They share the same `RolesGuard`, the same audit-log writer, the same status state machine helper. |
| 16 | **`/v1/admin/*` URL prefix is mandatory for all admin endpoints.** No admin endpoint mounts on the customer prefix. | Operational firewall: `nginx` / API-gateway rules (and observability dashboards) can apply different rate limits, IP allowlists, and audit verbosity to anything matching `/v1/admin/*`. Mixing the two prefixes makes that filter impossible. |
| 17 | **`@Roles('ADMIN')` decorator + `RolesGuard` applied at controller level**, not per-handler. | Defence-in-depth: a developer adding a new handler to `AdminInventoryController` cannot forget the auth decorator — it's already on the class. |
| 18 | **Audit log writes happen inside the same Prisma transaction as the resource mutation.** | `CONSTITUTION.md` § Audit Logging guarantees no successful change goes unaudited. Pulling the audit write out into a follow-up `await` would lose this guarantee on a server crash. |
| 19 | **Admin-initiated cancellation of customer bookings is deferred to Phase 11.** This branch's admin status changes affect only **future** booking attempts; existing `HOLD` / `PENDING_PAYMENT` / `CONFIRMED` rows are untouched. | Customer-booking cancellation requires the refund flow (Phase 6) and notifications (Phase 8). Coupling this branch to those is out of proportion. |
| 20 | **Uniform `ResourceStatus` enum (`ACTIVE`, `INACTIVE`, `SUSPENDED`) across all five inventory types.** | Single state-machine helper, single guard, uniform tests. The product-level distinction between "guide on leave" and "vehicle under maintenance" is metadata on the row, not a status value. |
| 21 | **Admin endpoints reuse the customer-side `idempotency.util.ts`** with namespace `idem:admin:{userId}:{key}`. | One implementation, one cache, two namespaces. Avoids accidental key collision between an admin and a customer with the same `userId` (which can't happen but the namespacing makes it explicit). |

---

## Context

### Why this matters

#### Part A — Customer M4

The "specific booking" path is the **shortest** path from app-open to QR-ticket. For tourists already in Cambodia who discover DerLg on the ground (taxi recommendation, hotel concierge, AI chat referral), the M4 flow is what they'll use. It must be:

- **Fast** — < 30 s median time-to-book (no journey map, no wizard).
- **Atomic** — no partial state, no orphan reservations.
- **Composable** — the primitives it builds (`commit-booking`, hold, refund, reference, idempotency) are reused by every other method in later phases.

#### Part B — Admin Inventory

Without admin endpoints, the catalog is **frozen on whatever Phase 2 seeded**. That breaks the foundation in three concrete ways:

1. **Operational reality** — vehicles break down, guides go on leave, hotel rooms are taken out of service for maintenance. The system has no way to express "this vehicle is unbookable for the next two weeks" without an admin status change.
2. **Catalog growth** — DerLg cannot onboard new partners (hotels, guide collectives, transport operators) without admin create endpoints. The product cannot launch with a static catalog.
3. **Data correctness** — pricing changes (`pricePerDayUsd`), description fixes, image updates all require an UPDATE path. Without it, every typo is a database migration.

Without this branch:
- Frontend's "Book now" buttons on inventory listing pages have no backend (Part A).
- Phase 6 has nothing to attach a `PaymentIntent` to (every payment row is keyed by `bookingId`) (Part A).
- The AI agent (Phase 9) has no `POST /v1/ai-tools/bookings` to wrap (its tool is a thin pass-through to M4 endpoints) (Part A).
- Operations team has **no way** to keep the bookable catalog current (Part B) — they would have to file engineering tickets for every status change.
- Phase 5b (M1/M2/M3) cannot start because `commit-booking.use-case.ts` is the use case it would call (Part A).

### What already exists (assumptions this branch leans on)

- **Phase 1 shared kernel:** `PrismaService`, `RedisService`, `CachedService`, `TransformInterceptor`, `AllExceptionsFilter`, `JwtAuthGuard` (default-on), `@CurrentUser()`, `@Public()`, `PageQueryDto`, `PaginatedResponse<T>`, `ApiResponse<T>`, `ErrorCode` registry under `src/common/errors/error-codes.ts`. All available.
- **Phase 3 auth:** Bearer JWT validation works, `req.user` carries the typed `JwtPayload`. The payload includes `role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'`. `@CurrentUser()` returns it. **If Phase 3 did not ship the role claim**, this branch is blocked until it does — see `Dependencies`.
- **Phase 4 catalog modules:** `Guide`, `Hotel`, `HotelRoom`, `TransportationVehicle`, `Trip` resources are listable / detail-fetchable on the **customer** side (filtered to `status = ACTIVE`, `deletedAt: null`). The booking-creation use cases here will `findFirst({ where: { id, deletedAt: null, status: ACTIVE } })` against the same models. The admin endpoints in Part B query the **same tables** but include `INACTIVE` / `SUSPENDED` / soft-deleted rows.
- **Schema:** `Booking` model in `prisma/schema.prisma` exists. This branch adds `method`, `singleResourceKind`, `configurationId`, the new `BookingItem` model, and a uniform `ResourceStatus` enum on every inventory table (or rebases onto Phase 2's split if it lands first). `audit_logs` table from `CONSTITUTION.md` § Audit Logging is created here if Phase 1 didn't ship it.
- **Error registry:** `BKNG_*` codes (10) already documented in `ERROR-REGISTRY.md`. Adjacent prerequisite codes (`GDE_UNAVAILABLE`, `HTL_EXCEEDS_OCCUPANCY`, `TRNS_UNAVAILABLE`, `TRIP_NO_AVAILABILITY`, etc.) also present. New codes added by this branch: `ADMIN_FORBIDDEN`, `ADMIN_INVALID_STATUS_TRANSITION`, `ADMIN_RESOURCE_HAS_ACTIVE_BOOKINGS` (informational warning, not a hard block).
- **Event catalog:** `booking.created`, `booking.cancelled`, `booking.expired` payload shapes locked in `EVENT-CATALOG.md`. This branch extends the `booking.created` payload with `method` and `singleResourceKind` (catalog update required). No admin events emitted from this branch.

### NFR targets (from `MISSION.md` + `../booking-methods.md` § 6)

| Concern | Target | Notes |
|---------|--------|-------|
| Booking creation (M4) | < 500 ms p95 | Informal smoke; not gated this branch |
| Cancellation | < 300 ms p95 | Informal smoke |
| Time-to-book median (M4) | < 30 s | Frontend metric, but backend latency budget supports it |
| Admin list / detail | < 300 ms p95 | Indexed queries on `(deletedAt, status)` |
| Admin write (`POST` / `PATCH` / `DELETE` / status) | < 500 ms p95 | Includes audit-log write inside the same TX |
| Response envelope | < 1 s even under cold cache | Hard constraint |

### Token / auth posture

- All **customer** endpoints in this branch are authenticated (default-on `JwtAuthGuard` from Phase 1). No `@Public()`. `@CurrentUser()` injects the JWT payload; the user's `sub` (uuid) is the single source of authorship.
- All **admin** endpoints additionally require `role: 'ADMIN'` (or `'SUPER_ADMIN'`) via `@Roles('ADMIN')` + `RolesGuard`. The guard runs after `JwtAuthGuard`. Non-admin requests return `403 ADMIN_FORBIDDEN`.

---

## Dependencies

Per `ROADMAP.md` → Dependency Graph, Phase 5a depends on:

| Prior Phase | Status | What this branch consumes |
|-------------|--------|---------------------------|
| Phase 1 — Foundation & Shared Kernel | 🟢 Complete | `PrismaService`, `RedisService`, `CachedService`, `JwtAuthGuard`, `@CurrentUser()`, `TransformInterceptor`, `AllExceptionsFilter`, `ErrorCode` registry, `PageQueryDto`, `PaginatedResponse<T>`. **`AuditLog` writer** (preferred — if not present this branch ships the migration + writer). |
| Phase 3 — Auth & Users | 🟢 Complete | `JwtAuthGuard` issues the user identity every booking endpoint requires. **The JWT payload must include `role` claim** (`'USER' | 'ADMIN' | 'SUPER_ADMIN'`) — required by Part B's `RolesGuard`. **If Phase 3 did not ship the role claim**, this branch is blocked until it does (~30 min change in `auth/strategies/jwt.strategy.ts`). |
| Phase 4 — Core Inventory | 🟢 Complete | `Guide`, `Hotel`, `HotelRoom`, `TransportationVehicle`, `Trip` rows must exist to be booked. The use cases re-query these directly via `PrismaService` (no cross-module imports). Part B mutates the same tables; the customer-side modules are unaffected because Part B never touches the customer controllers. |

> **Note:** Phase 2 (Database Schema, multi-file split) is `🟡 In Progress (Senior)` per `PROGRESS-TRACKER.md`. If Phase 2 has not landed when this branch starts, this branch ships its own minimal migration for `Booking.method`, `Booking.singleResourceKind`, `Booking.configurationId`, `BookingItem`, `ResourceStatus` enum on each inventory table, and `audit_logs`. The migration is forward-compatible with senior's eventual full split (the model fields are stable).

### What this branch unblocks

| Downstream | Why it needs this branch |
|------------|--------------------------|
| Phase 5b — Package Booking (M1 + M2) | Needs `commit-booking.use-case.ts` + `BookingItem` to write multi-resource trip bookings |
| Phase 5c — Build-from-Scratch (M3) | Same |
| Phase 6 — Payments | `PaymentIntent` attaches to `bookingId`; refund flow consumes `booking.cancelled` event |
| Phase 8 — Notifications + Cron | Consumes `booking.created` / `booking.cancelled` / `booking.expired` events; cron wires `expire-hold.use-case.ts` |
| Phase 9 — AI Agent | `POST /v1/ai-tools/bookings` wraps the M4 use cases as service-key-authenticated tool endpoints |
| **Operations / partner onboarding (immediate)** | Part B unblocks the operations team — they can add new vehicles, hotels, guides, trips and mark items inactive without engineering involvement |
| Phase 11 — Admin Booking Surfaces | Reuses `RolesGuard`, `@Roles()` decorator, `audit_logs` infrastructure shipped here |

---

## References

- `../analysis.md` — booking-engine architecture audit (Design C — configuration + commit chosen)
- `../booking-methods.md` — definitive 4-method model (M4 is this folder)
- `docs/workflows/booking-transaction-methods.md` — Method 3 architectural decision
- `backend/context/plans/ROADMAP.md` — Phase 5 (tasks 5.1 – 5.8)
- `backend/context/guides/MISSION.md` — § Target State, NFR budgets
- `backend/context/guides/CONSTITUTION.md` — § 1 Module structure, § 2.5 Idempotency, § 3.3 Redis key conventions, § 9 Booking & Payment Rules, **§ Audit Logging (admin writes)**, **§ RBAC (admin role enforcement)**
- `backend/context/guides/CODE-STANDARD.md` — DTO rules, NestJS patterns, **`PartialType()` usage for admin update DTOs**
- `backend/context/guides/TECH-STACK.md` — Prisma 6, ioredis, EventEmitter2 versions, **`@nestjs/mapped-types` for `PartialType()`**
- `backend/context/specs/SCHEMA.md` — `Booking` model (lines 458–507), `BookingStatus` enum (lines 54–60). New `BookingMethod`, `SingleResourceKind`, `BookingItem`, **uniform `ResourceStatus` enum on inventory tables**, **`audit_logs` table** to be added.
- `backend/context/specs/API-CONTRACT.md` — § 11 Bookings (lines 726–900). M4d `POST /v1/trips/:id/bookings` to be added. **Entire `/v1/admin/*` section to be added** (30 admin endpoints).
- `backend/context/specs/ERROR-REGISTRY.md` — `BKNG_*` codes (10), `GDE_*` / `HTL_*` / `TRNS_*` / `TRIP_*` adjacent codes. New: `ADMIN_FORBIDDEN`, `ADMIN_INVALID_STATUS_TRANSITION`, `ADMIN_RESOURCE_HAS_ACTIVE_BOOKINGS`.
- `backend/context/specs/EVENT-CATALOG.md` — `booking.created` / `booking.cancelled` / `booking.expired` payloads. Update required to add `method` + `singleResourceKind` to `booking.created`. No admin events this branch.
- `backend/context/plans/TEST-PLAN.md` — § 2 Coverage Gates (Bookings = 90 %), § 3.2 / § 3.3 / § 3.6 critical E2E flows (deferred this branch). **Admin coverage gate** also deferred to follow-up branch.
- `backend/context/feature-specs/2026-05-20-core-inventory/` — pattern reference for plan/requirements/validation triplet
- `backend/context/feature-specs/2026-05-17-auth-users/` — pattern reference for an authenticated module + JWT role claim shape
