# Plan: Booking Engine (`feature/2026-05-23-booking-engine`)

> **Phase:** 5 (Booking Engine)
> **Branch:** `feature/2026-05-23-booking-engine`
> **Started:** 2026-05-23
> **Status:** 🟡 In Progress
> **Architecture:** **Use-case pattern**, mirroring `backend/src/modules/auth/` and `backend/src/modules/<catalog>/`. One `*UseCase` class per endpoint, single `execute()` method, injected directly into the controller. **No `<feature>.service.ts` files.**
> **Tests:** **Critical paths only this branch.** Unit tests are required for `check-overlap.util`, `compute-refund.util`, `transition-status.util`, `set-hold.use-case`, and `cancel-booking.use-case`. Controller integration, full E2E (`bookings.e2e-spec.ts`), property-based tests, and the 90 % `TEST-PLAN.md` coverage gate are deferred to a follow-up branch and remain a hard merge prerequisite.

This plan is a series of numbered task groups. Implement top to bottom. Sub-tasks **within** a group may be written in any order, but **groups (1 → 2 → 3 → 4 → 5 → 6 → 7 → 8) must be implemented strictly sequentially**, one at a time, with the per-group gate passed before the next begins. See § "⚠️ Sequential implementation rule" below.

---

## ⚠️ Sequential implementation rule (read before starting any group)

**Implement one group at a time.** After Group 1 (shared booking primitives) lands, build the rest in the order listed (creation → unified read/update → cancel → QR/iCal → cron entrypoint → events → cleanup). Do not begin Group N+1 until Group N has passed its per-group gate.

Each group ends with a **Per-group gate** subsection. The gate is identical for every group:

| # | Check | Command |
|---|-------|---------|
| 1 | Lint clean | `npm run lint` — zero errors / zero warnings |
| 2 | Build clean | `npm run build` succeeds |
| 3 | Type-check clean | `npx tsc --noEmit` — zero type errors |
| 4 | Critical-path unit tests pass (Groups 1, 4 only) | `npm test -- bookings` — zero failures |
| 5 | Endpoints respond (Groups 2, 3, 4, 5, 6) | Run the manual smoke `curl` commands for **this group's** endpoints from `validation.md` |
| 6 | Hold key populates / expires (Group 2 onwards) | `redis-cli KEYS 'booking_hold:*'` shows new keys with TTL ≈ 900 s after a `POST /v1/guides/:id/bookings` call |
| 7 | Update tracker | Tick the relevant boxes in `PROGRESS-TRACKER.md` for **this group only**; flip the group row to 🟢; append a row to "Recent Updates" |
| 8 | Stop & confirm | Pause for review **before** starting the next group |

**Why sequential:** the booking creation flow is the canonical pattern; cancel and update consume the same primitives. Building one group at a time lets a reviewer catch divergence early, keeps PRs reviewable, and matches the user's directive "one module at a time for AI agent to ensure quality."

---

## Code Standard — Use-Case Pattern (canonical)

The `BookingsModule` **must** match this layout (lifted from `src/modules/auth/` and the catalog modules):

```
src/modules/bookings/
  bookings.module.ts             # imports PrismaModule, RedisModule, CommonModule, EventEmitterModule;
                                 # providers: list ALL use cases explicitly
  bookings.controller.ts         # thin: DTO in → useCase.execute() → DTO/JSON out
                                 # @Controller('bookings') for the unified surface
  inventory-bookings.controller.ts  # @Controller() with fully-qualified routes for the
                                    # inventory-prefixed POST endpoints
  dto/
    create-guide-booking.dto.ts
    create-hotel-booking.dto.ts
    create-transportation-booking.dto.ts
    list-bookings-query.dto.ts
    update-booking.dto.ts
    cancel-booking.dto.ts
    index.ts                     # barrel — `export * from './...'`
  interfaces/
    guide-booking.interface.ts
    hotel-booking.interface.ts
    transportation-booking.interface.ts
    unified-booking.interface.ts
    booking-detail.interface.ts
    refund-result.interface.ts
    index.ts                     # barrel — `export type * from './...'`
  use-cases/
    create-guide-booking.use-case.ts
    create-hotel-booking.use-case.ts
    create-transportation-booking.use-case.ts
    list-bookings.use-case.ts
    get-booking-detail.use-case.ts
    update-booking.use-case.ts
    cancel-booking.use-case.ts
    get-booking-qr.use-case.ts
    get-booking-ical.use-case.ts
    expire-hold.use-case.ts
    index.ts                     # barrel
  utils/
    check-overlap.util.ts        # pure: returns boolean given resource bookings + target range
    compute-refund.util.ts       # pure: refund tier from cancellation date + start date
    transition-status.util.ts    # pure: throws on invalid transition
    set-hold.util.ts             # injectable thin Redis writer (used by every creation use case)
    release-hold.util.ts         # injectable: deletes the hold key
    generate-reference.util.ts   # pure: '<KIND>-<BASE32(6)>' from uuid
    map-booking.util.ts          # pure: Prisma row → API DTO mappers (typed/guide/hotel/transport)
    build-ical.util.ts           # pure: Booking row → RFC 5545 string
    idempotency.util.ts          # injectable thin Redis read-write for idem keys
    index.ts                     # barrel
```

### Use-case class template

```ts
import { Injectable, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { checkOverlap } from '../utils/check-overlap.util';
import { generateReference } from '../utils/generate-reference.util';
import { setHold } from '../utils/set-hold.util';
import { mapGuideBooking } from '../utils/map-booking.util';
import type { CreateGuideBookingDto } from '../dto';
import type { GuideBooking } from '../interfaces';
import type { JwtPayload } from '../../auth/interfaces';

@Injectable()
export class CreateGuideBookingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    user: JwtPayload,
    guideId: string,
    dto: CreateGuideBookingDto,
    idempotencyKey?: string,
  ): Promise<GuideBooking> {
    // 1. idempotency check (returns prior result if key seen)
    // 2. validate guide ACTIVE
    // 3. transaction:
    //    - findMany overlapping bookings (HOLD | PENDING_PAYMENT | CONFIRMED)
    //    - throw 409 BKNG_UNAVAILABLE if any
    //    - prisma.booking.create({ status: HOLD, holdExpiresAt: now + 15min })
    // 4. set Redis hold key (TTL 900s)
    // 5. emit 'booking.created' event
    // 6. cache idempotency result
    // 7. return mapped DTO
  }
}
```

### Controller template (thin)

```ts
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly listBookings: ListBookingsUseCase,
    private readonly getBookingDetail: GetBookingDetailUseCase,
    private readonly updateBooking: UpdateBookingUseCase,
    private readonly cancelBooking: CancelBookingUseCase,
    private readonly getBookingQr: GetBookingQrUseCase,
    private readonly getBookingIcal: GetBookingIcalUseCase,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListBookingsQueryDto) {
    return this.listBookings.execute(user, query);
  }
  // ... one route per use case, no business logic in handlers
}
```

### Module template

```ts
@Module({
  imports: [PrismaModule, RedisModule, CommonModule, EventEmitterModule.forRoot()],
  controllers: [BookingsController, InventoryBookingsController],
  providers: [
    CreateGuideBookingUseCase,
    CreateHotelBookingUseCase,
    CreateTransportationBookingUseCase,
    ListBookingsUseCase,
    GetBookingDetailUseCase,
    UpdateBookingUseCase,
    CancelBookingUseCase,
    GetBookingQrUseCase,
    GetBookingIcalUseCase,
    ExpireHoldUseCase,
  ],
  exports: [ExpireHoldUseCase], // Phase 8 cron will consume this
})
export class BookingsModule {}
```

### Conventions (mirrors `src/modules/auth/` and the catalog modules)

1. **One use case per endpoint.** No mega-services. The hold/release/idempotency primitives in `utils/` are consumed by use cases via constructor injection.
2. **Constructor-only DI.** Use cases inject `PrismaService`, `RedisService`, `EventEmitter2`, or **other use cases / utils** — never a feature service (none exist).
3. **Public surface = `execute()`.** No additional public methods on a use case.
4. **Errors:** `throw new <Nest>Exception({ code: ErrorCode.XXX, message })`. The `ErrorCode` registry lives at `src/common/errors/error-codes.ts`. Match the existing auth/catalog style.
5. **Imports:** relative paths only — `../../prisma/prisma.service`, `../../redis/redis.service`, `../../../common/errors/error-codes`, `../utils`, `../dto`, `../interfaces`. Type-only imports use `import type`.
6. **Pure utils** in `utils/` (overlap, refund, transition, reference, mappers, ical) — no DI. Thin Redis-touching helpers (`set-hold.util.ts`, `release-hold.util.ts`, `idempotency.util.ts`) are `@Injectable()` providers consumed by use cases.
7. **Barrels** — every subfolder has an `index.ts` re-exporting its members using `export * from './...'`. `interfaces/index.ts` uses `export type * from './...'`.
8. **Idempotency-Key header parsing** lives in the controller (one line: `@Headers('idempotency-key') idempotencyKey?: string`); the use case takes the key as an optional argument and consults the Redis idem helper.

---

## Folder Structure (target state)

> **What this section is:** the exact tree the working copy should have when this branch is ready to merge. Every file listed is either created (no marker), modified (`(modified)`), or already in place from earlier phases (not listed). Use this as a checklist while implementing.

### Shared kernel additions / changes (`src/common/`)

```
src/common/
  errors/
    error-codes.ts                          (modified — confirm BKNG_* codes are present;
                                                         add any missing from ERROR-REGISTRY.md)
```

> No new shared-kernel infrastructure is needed — `EventEmitterModule` is registered at the app root in Group 7 below.

### BookingsModule (Groups 1–7)

```
src/modules/bookings/
  bookings.module.ts
  bookings.controller.ts
  inventory-bookings.controller.ts
  dto/
    create-guide-booking.dto.ts
    create-hotel-booking.dto.ts
    create-transportation-booking.dto.ts
    list-bookings-query.dto.ts
    update-booking.dto.ts
    cancel-booking.dto.ts
    index.ts
  interfaces/
    guide-booking.interface.ts
    hotel-booking.interface.ts
    transportation-booking.interface.ts
    unified-booking.interface.ts
    booking-detail.interface.ts
    refund-result.interface.ts
    booking-event-payloads.interface.ts     # typed shapes from EVENT-CATALOG.md
    index.ts
  use-cases/
    create-guide-booking.use-case.ts
    create-hotel-booking.use-case.ts
    create-transportation-booking.use-case.ts
    list-bookings.use-case.ts
    get-booking-detail.use-case.ts
    update-booking.use-case.ts
    cancel-booking.use-case.ts
    get-booking-qr.use-case.ts
    get-booking-ical.use-case.ts
    expire-hold.use-case.ts
    index.ts
  utils/
    check-overlap.util.ts
    check-overlap.util.spec.ts              # critical-path unit test
    compute-refund.util.ts
    compute-refund.util.spec.ts             # critical-path unit test
    transition-status.util.ts
    transition-status.util.spec.ts          # critical-path unit test
    set-hold.util.ts
    release-hold.util.ts
    generate-reference.util.ts
    map-booking.util.ts
    build-ical.util.ts
    idempotency.util.ts
    index.ts
```

### Critical-path use-case tests

```
src/modules/bookings/use-cases/
  set-hold.use-case.spec.ts                 # IF set-hold is promoted to a use case;
                                            # otherwise test it via create-guide-booking.use-case.spec.ts
  cancel-booking.use-case.spec.ts           # critical-path unit test (mock Prisma + Redis)
```

> **Decision:** `set-hold.util.ts` stays a thin `@Injectable()` helper (not a use case) and is exercised through a `create-guide-booking.use-case.spec.ts` mock-Redis assertion. The two required critical-path use-case specs are therefore `create-guide-booking.use-case.spec.ts` (asserts the hold key is set) and `cancel-booking.use-case.spec.ts` (asserts refund + status + hold release).

### Files modified outside the bookings module (Group 7)

```
src/app.module.ts                           (modified — import BookingsModule + EventEmitterModule.forRoot())
src/common/errors/error-codes.ts            (modified — confirm/add BKNG_* + GDE_/HTL_/TRNS_ codes)
backend/.env.example                        (modified — add BOOKING_HOLD_TTL_SECONDS=900 if missing)
backend/context/plans/PROGRESS-TRACKER.md   (modified — Phase 5 status)
```

### File-count summary

| Bucket | Files |
|--------|-------|
| Use-case classes (one per endpoint + 1 cron entrypoint) | **10** |
| Module file (`bookings.module.ts`) | 1 |
| Controller files | 2 (`bookings.controller.ts`, `inventory-bookings.controller.ts`) |
| DTO files (excluding barrel) | 6 |
| Interface files (excluding barrel) | 7 |
| Util files (excluding barrel) | 9 |
| Critical-path unit tests | 5 (3 in `utils/`, 2 in `use-cases/`) |
| Barrel `index.ts` files | 4 |
| Modified files | 4 |
| **Total new files (incl. barrels + tests)** | **~44** |

### Conventions reflected in this tree

- Every subfolder has an `index.ts` barrel — required by the use-case pattern.
- One use-case file per endpoint, named `<verb>-<resource>.use-case.ts`. The class is `<VerbResource>UseCase`.
- One DTO file per "shape" (create per kind, list query, update, cancel). DTO classes are `<Verb><Resource>Dto`.
- Pure helpers go in `utils/`, never inline in use cases.
- **No `bookings.service.ts`, `bookings.repository.ts`** in this branch (use-case pattern).
- Critical-path `*.spec.ts` files colocated with their target. No `bookings.controller.spec.ts`, no `bookings.e2e-spec.ts` this branch (deferred).

---

## Group 1 — Shared booking primitives (foundation + critical-path tests)

> **Goal:** Build the pure helpers and thin Redis writers every later use case consumes. **Three of the five required unit tests live in this group.**

| # | File | Action | Notes |
|---|------|--------|-------|
| 1.1 | `src/modules/bookings/utils/check-overlap.util.ts` | **Create** | Pure: `checkOverlap(existing: { startDate: Date; endDate: Date }[], target: { startDate: Date; endDate: Date }): boolean`. Returns true if any existing range overlaps the target. Standard interval-overlap predicate: `existing.startDate < target.endDate && existing.endDate > target.startDate`. Inclusive vs. exclusive boundaries documented in JSDoc one-liner: **start ≤ end**, **adjacent ranges (`existing.endDate == target.startDate`) do not overlap**. |
| 1.2 | `src/modules/bookings/utils/check-overlap.util.spec.ts` | **Create (test)** | Cases: full overlap, partial overlap (left), partial overlap (right), exact equal range, adjacent (no overlap, both directions), empty existing list, single-day target, swapped boundaries throw. |
| 1.3 | `src/modules/bookings/utils/compute-refund.util.ts` | **Create** | Pure: `computeRefund(booking: { startDate: Date; totalPriceUsd: Decimal }, now: Date): { amountUsd: number; percentage: 0 \| 50 \| 100 }`. Implements `CONSTITUTION.md` § 9.3: `> 7 days = 100 %`, `3–7 days = 50 %`, `< 3 days = 0 %`. Use whole-day diff (truncate to midnight UTC). |
| 1.4 | `src/modules/bookings/utils/compute-refund.util.spec.ts` | **Create (test)** | Cases: exact 8 days (100 %), exact 7 days (50 % — boundary), exact 4 days (50 %), exact 3 days (0 % — boundary), exact 2 days (0 %), already-started (0 %), zero amount, decimal preservation. |
| 1.5 | `src/modules/bookings/utils/transition-status.util.ts` | **Create** | Pure: `assertTransition(from: BookingStatus, to: BookingStatus): void`. Throws `BadRequestException({ code: ErrorCode.BKNG_PAYMENT_PENDING / BKNG_ALREADY_CANCELLED / BKNG_EXPIRED, message })` per illegal-transition kind. Legal transitions: `HOLD → PENDING_PAYMENT \| CANCELLED \| EXPIRED`; `PENDING_PAYMENT → CONFIRMED \| CANCELLED \| EXPIRED`; `CONFIRMED → CANCELLED`. |
| 1.6 | `src/modules/bookings/utils/transition-status.util.spec.ts` | **Create (test)** | Test every legal transition succeeds; every illegal transition throws with the documented `BKNG_*` code. |
| 1.7 | `src/modules/bookings/utils/generate-reference.util.ts` | **Create** | Pure: `generateReference(kind: 'GDE' \| 'HTL' \| 'TRN'): string`. Returns `<KIND>-<6CHAR>` where the 6-char body is base32-uppercase from a fresh `crypto.randomUUID()`. |
| 1.8 | `src/modules/bookings/utils/set-hold.util.ts` | **Create** | `@Injectable()` provider. Constructor-injects `RedisService`. Single method `set(bookingId: string, ttlSeconds = 900): Promise<void>` → `redis.setex('booking_hold:' + bookingId, ttl, '1')`. |
| 1.9 | `src/modules/bookings/utils/release-hold.util.ts` | **Create** | `@Injectable()` provider. `release(bookingId: string)` → `redis.del('booking_hold:' + bookingId)`. |
| 1.10 | `src/modules/bookings/utils/idempotency.util.ts` | **Create** | `@Injectable()` provider. Methods: `lookup(userId, key): Promise<{ bookingId: string; response: unknown } \| null>`, `store(userId, key, bookingId, response, ttlSeconds = 86400): Promise<void>`. Redis key shape: `idem:booking:{userId}:{key}`. |
| 1.11 | `src/modules/bookings/utils/map-booking.util.ts` | **Create** | Pure mappers: `mapGuideBooking`, `mapHotelBooking`, `mapTransportationBooking`, `mapBookingDetail`, `mapUnifiedBooking`. Strip Decimal → number for `totalPriceUsd`, ISO strings for dates, no `password` / no `deletedAt` leakage. |
| 1.12 | `src/modules/bookings/utils/build-ical.util.ts` | **Create** | Pure: `buildIcal(booking)` returns RFC 5545 string. `BEGIN:VCALENDAR / VERSION:2.0 / PRODID:-//DerLg//Booking//EN / BEGIN:VEVENT / UID:{reference}@derlg / DTSTART;VALUE=DATE:{YYYYMMDD} / DTEND;VALUE=DATE:{YYYYMMDD} / SUMMARY:{name} / END:VEVENT / END:VCALENDAR`. Newlines are `\r\n` per spec. |
| 1.13 | `src/modules/bookings/utils/index.ts` | **Create** | Barrel: `export * from './check-overlap.util';` etc. Helpers and pure utils both exported. |

### Per-group gate (do not skip)

1. `npm run lint` clean (zero errors / zero warnings)
2. `npm run build` clean
3. `npx tsc --noEmit` clean
4. `npm test -- src/modules/bookings/utils` — three new spec files pass
5. **Stop here.** Do not start Group 2 (Creation) until the gate passes.

---

## Group 2 — Booking creation (3 endpoints)

> **Goal:** All three creation endpoints work end-to-end: HOLD row written, Redis hold set with 900 s TTL, `booking.created` event emitted, idempotency honoured. **Do not start until Group 1 has passed its per-group gate.**

### 2.A Use cases — one file per endpoint

| # | File | Class | `execute(...)` signature |
|---|------|-------|--------------------------|
| 2.1 | `use-cases/create-guide-booking.use-case.ts` | `CreateGuideBookingUseCase` | `(user: JwtPayload, guideId: string, dto: CreateGuideBookingDto, idempotencyKey?: string): Promise<GuideBooking>` — throws `409 BKNG_UNAVAILABLE` on overlap, `403 GDE_SUSPENDED / GDE_INACTIVE` on bad guide state, `400 BKNG_INVALID_DATE_RANGE` on `endDate <= startDate` |
| 2.2 | `use-cases/create-hotel-booking.use-case.ts` | `CreateHotelBookingUseCase` | `(user, hotelId, dto: CreateHotelBookingDto, idempotencyKey?): Promise<HotelBooking>` — `409 BKNG_UNAVAILABLE`, `400 BKNG_EXCEEDS_OCCUPANCY` if `guestsAdults + guestsChildren > room.capacity`, `400 BKNG_INVALID_DATE_RANGE` |
| 2.3 | `use-cases/create-transportation-booking.use-case.ts` | `CreateTransportationBookingUseCase` | `(user, dto: CreateTransportationBookingDto, idempotencyKey?): Promise<TransportationBooking>` — `409 BKNG_UNAVAILABLE`, `400 BKNG_INVALID_DATE_RANGE` |

Each use case follows the same skeleton:

1. Idempotency lookup (return cached body if hit).
2. Validate inventory: `prisma.<resource>.findFirst({ where: { id, deletedAt: null, status: ACTIVE } })` → `404 / 403` per existing `ERROR-REGISTRY.md` codes.
3. `prisma.$transaction(async (tx) => { ... })`:
   - `tx.booking.findMany({ where: { <resourceFK>, status: { in: [HOLD, PENDING_PAYMENT, CONFIRMED] }, deletedAt: null, NOT: { OR: [{ endDate: { lte: dto.startDate } }, { startDate: { gte: dto.endDate } }] } } })`
   - If results: `throw new ConflictException({ code: ErrorCode.BKNG_UNAVAILABLE, message })`
   - `tx.booking.create({ data: { ..., status: HOLD, holdExpiresAt: now() + 15min, reference: generateReference(KIND) } })` (retry on `P2002` ref-unique up to 3×)
4. `setHold.set(booking.id, 900)`
5. `eventEmitter.emit('booking.created', payload)` — payload matches `EVENT-CATALOG.md` § `booking.created`.
6. `idempotency.store(user.sub, key, booking.id, mapped)` — only if `idempotencyKey` was supplied.
7. Return `mapGuideBooking(booking)` / `mapHotelBooking(booking)` / `mapTransportationBooking(booking)`.

### 2.B Supporting files (DTOs + interfaces)

| # | File | Action |
|---|------|--------|
| 2.4 | `dto/create-guide-booking.dto.ts` | `class-validator`: `startDate: ISO date`, `endDate: ISO date`, `linkedTripBookingId?: uuid`, `specialRequests?: string @MaxLength(1000)`. Custom `@AfterDate('startDate')` for `endDate`. |
| 2.5 | `dto/create-hotel-booking.dto.ts` | `roomId: uuid`, `checkInDate: ISO date`, `checkOutDate: ISO date`, `guestsAdults: int @Min(1)`, `guestsChildren?: int @Min(0) @Default(0)`, `specialRequests?`. |
| 2.6 | `dto/create-transportation-booking.dto.ts` | `vehicleId: uuid`, `startDate: ISO`, `endDate: ISO`, `specialRequests?`. |
| 2.7 | `dto/index.ts` | Barrel. |
| 2.8 | `interfaces/guide-booking.interface.ts` | Matches `API-CONTRACT.md` § 11 `GuideBooking`. |
| 2.9 | `interfaces/hotel-booking.interface.ts` | Matches `API-CONTRACT.md` § 11 `HotelBooking`. |
| 2.10 | `interfaces/transportation-booking.interface.ts` | Matches `API-CONTRACT.md` § 11 `TransportationBooking`. |
| 2.11 | `interfaces/booking-event-payloads.interface.ts` | `BookingCreatedEvent`, `BookingCancelledEvent`, `BookingExpiredEvent` shapes verbatim from `EVENT-CATALOG.md`. |
| 2.12 | `interfaces/index.ts` | Barrel using `export type *`. |
| 2.13 | `use-cases/index.ts` | Barrel (only the three creation use cases for now; expand in later groups). |

### 2.C Critical-path unit test for creation

| # | File | Action |
|---|------|--------|
| 2.14 | `use-cases/create-guide-booking.use-case.spec.ts` | **Create (test)** — Mocks `PrismaService` (`$transaction`, `guide.findFirst`, `booking.findMany`, `booking.create`), `RedisService` (capture `setex` call), `EventEmitter2` (capture emit). Asserts: (a) hold key written `booking_hold:<id>` with TTL 900, (b) overlap `findMany` throws `409 BKNG_UNAVAILABLE`, (c) `booking.created` emitted with `EVENT-CATALOG.md` payload shape, (d) idempotent retry returns the cached body. |

### 2.D Inventory-prefixed controller (subset of routes)

| # | File | Action |
|---|------|--------|
| 2.15 | `inventory-bookings.controller.ts` | **Create** with three handlers: `@Post('guides/:guideId/bookings')`, `@Post('hotels/:hotelId/bookings')`, `@Post('transportation/bookings')`. Each is one line: `return this.create<X>.execute(user, ...)`. Auth is default-on from Phase 1's global `JwtAuthGuard`. |

### 2.E Module wiring

| # | File | Action |
|---|------|--------|
| 2.16 | `bookings.module.ts` | **Create** — imports `[PrismaModule, RedisModule, CommonModule, EventEmitterModule.forRoot()]`, controllers `[InventoryBookingsController]` (Group 3 adds `BookingsController`), providers list the three creation use cases + `setHold` + `releaseHold` + `idempotency`. Export `BookingsModule`. |
| 2.17 | `src/app.module.ts` | **Modify** — import `BookingsModule` and `EventEmitterModule.forRoot()` at the top level. (If `EventEmitterModule` is registered inside `BookingsModule`, do not re-register at the root — pick one. Use the root for Phase 8 to consume.) |

### 2.F Per-group gate

1. `npm run lint` clean
2. `npm run build` clean
3. `npx tsc --noEmit` clean
4. `npm test -- src/modules/bookings/use-cases/create-guide-booking.use-case.spec` passes
5. Run the **creation** smoke commands from `validation.md` (`POST /v1/guides/:id/bookings`, `POST /v1/hotels/:id/bookings`, `POST /v1/transportation/bookings`)
6. `redis-cli KEYS 'booking_hold:*'` shows fresh keys; `redis-cli TTL booking_hold:<id>` returns ~900
7. **Stop here.** Do not start Group 3 until the gate passes.

---

## Group 3 — Unified read surface (`GET /v1/bookings`, `GET /v1/bookings/:id`)

> **Goal:** Authenticated users can list their own bookings (paginated, optional `status` filter) and fetch one by id. **Do not start until Group 2 has passed its per-group gate.**

### 3.A Use cases

| # | File | Class |
|---|------|-------|
| 3.1 | `use-cases/list-bookings.use-case.ts` | `ListBookingsUseCase` — `execute(user, query: ListBookingsQueryDto): Promise<PaginatedResponse<UnifiedBooking>>`. `prisma.booking.findMany({ where: { userId: user.sub, deletedAt: null, status: query.status ?? undefined }, orderBy: { createdAt: 'desc' }, skip, take })` + `count`. Uses `mapUnifiedBooking` to flatten `guide.fullName / hotel.name / vehicle.label` into `name`. |
| 3.2 | `use-cases/get-booking-detail.use-case.ts` | `GetBookingDetailUseCase` — `execute(user, id): Promise<BookingDetail>`. `findFirst({ where: { id, deletedAt: null }, include: { guide, hotel, hotelRoom, vehicle } })`. `404 BKNG_NOT_FOUND`; `403 BKNG_NOT_AUTHOR` if `booking.userId !== user.sub`. |

### 3.B Supporting files

| File | Action |
|------|--------|
| `dto/list-bookings-query.dto.ts` | Extends `PageQueryDto`. Optional `status?: BookingStatus`. |
| `interfaces/unified-booking.interface.ts` | Matches `API-CONTRACT.md` § 11 `UnifiedBooking`. |
| `interfaces/booking-detail.interface.ts` | Discriminated-union of guide/hotel/transport detail. |
| `bookings.controller.ts` | **Create** — `@Controller('bookings')` with `@Get()` and `@Get(':id')` handlers. |
| `bookings.module.ts` | **Modify** — register `BookingsController` and the two new use cases as providers. |
| `use-cases/index.ts` | **Modify** — re-export. |

### 3.C Per-group gate

1. Lint / build / type-check clean
2. Smoke `validation.md` § "List + detail" passes (own booking → 200, cross-user → 403, unknown id → 404)
3. **Stop here.**

---

## Group 4 — Update + cancel (refund + critical-path test)

> **Goal:** `PATCH /v1/bookings/:id` updates a HOLD booking; `POST /v1/bookings/:id/cancel` calculates the refund tier, writes status `CANCELLED`, releases the hold, emits `booking.cancelled`. **Two of the five critical-path unit tests close out in this group.**

### 4.A Use cases

| # | File | Class |
|---|------|-------|
| 4.1 | `use-cases/update-booking.use-case.ts` | `UpdateBookingUseCase` — `execute(user, id, dto: UpdateBookingDto): Promise<BookingDetail>`. `403 BKNG_NOT_AUTHOR` if not owner; `403 BKNG_CONFIRMED_CANNOT_MODIFY` if status ≠ `HOLD`. Apply allowed fields (`startDate`, `endDate`, `guestsAdults`, `guestsChildren`, `specialRequests`); re-run overlap check inside `$transaction`. |
| 4.2 | `use-cases/cancel-booking.use-case.ts` | `CancelBookingUseCase` — `execute(user, id, dto: CancelBookingDto): Promise<RefundResult>`. `403 BKNG_NOT_AUTHOR`; `400 BKNG_ALREADY_CANCELLED`; `409 BKNG_PAYMENT_PENDING` if `PaymentStatus.PROCESSING` rows exist. Call `assertTransition(current, CANCELLED)`. Compute `computeRefund(booking, now)`. `prisma.$transaction([booking.update({ status: CANCELLED, cancelledAt }), ...])`. `releaseHold.release(id)`. Emit `booking.cancelled` with `refundAmountUsd / refundPercentage`. |

### 4.B Supporting files

| File | Action |
|------|--------|
| `dto/update-booking.dto.ts` | All fields optional; class-validator. Validate at least one field is present. |
| `dto/cancel-booking.dto.ts` | `reason?: string @MaxLength(500)`. |
| `interfaces/refund-result.interface.ts` | `{ refundAmountUsd: number; refundPercentage: 0 \| 50 \| 100; refundMethod: string \| null }`. |
| `bookings.controller.ts` | **Modify** — add `@Patch(':id')` and `@Post(':id/cancel')`. |

### 4.C Critical-path unit test for cancel

| File | Action |
|------|--------|
| `use-cases/cancel-booking.use-case.spec.ts` | **Create (test)** — Mocks Prisma + Redis + EventEmitter. Cases: 100 % tier (start in 10 days), 50 % tier (start in 5 days), 0 % tier (start in 1 day), already-cancelled throws, payment-processing throws. Asserts hold key released and event emitted with `EVENT-CATALOG.md` payload shape. |

### 4.D Per-group gate

1. Lint / build / type-check clean
2. `npm test -- src/modules/bookings/use-cases/cancel-booking.use-case.spec` passes
3. Smoke `validation.md` § "Update + cancel" passes (own HOLD → patch 200, confirmed → patch 403, cancel pre-7 days → 100 %, cancel inside 3 → 0 %)
4. After cancel, `redis-cli EXISTS booking_hold:<id>` returns 0
5. **Stop here.**

---

## Group 5 — QR + iCal endpoints

> **Goal:** `GET /v1/bookings/:id/qr` returns `{ qrCodeUrl }`. `GET /v1/bookings/:id/ical` returns `text/calendar` content. **Do not start until Group 4 has passed its per-group gate.**

### 5.A Use cases

| # | File | Class |
|---|------|-------|
| 5.1 | `use-cases/get-booking-qr.use-case.ts` | `GetBookingQrUseCase` — `execute(user, id): Promise<{ qrCodeUrl: string }>`. Authorization mirrors detail. URL placeholder: `${FRONTEND_URL}/bookings/${reference}/qr`. |
| 5.2 | `use-cases/get-booking-ical.use-case.ts` | `GetBookingIcalUseCase` — `execute(user, id): Promise<string>`. Returns the RFC 5545 string from `buildIcal`. |

### 5.B Controller wiring

| File | Action |
|------|--------|
| `bookings.controller.ts` | **Modify** — `@Get(':id/qr')`, `@Get(':id/ical')` (latter sets `Content-Type: text/calendar; charset=utf-8` and `Content-Disposition: attachment; filename="<reference>.ics"` via `@Res({ passthrough: true })` or `Reply`). |

### 5.C Per-group gate

1. Lint / build / type-check clean
2. `curl -i http://localhost:3001/v1/bookings/<id>/ical` returns `Content-Type: text/calendar`
3. `curl http://localhost:3001/v1/bookings/<id>/ical | head -1` is `BEGIN:VCALENDAR\r`
4. **Stop here.**

---

## Group 6 — Cron entrypoint (`expire-hold.use-case.ts`)

> **Goal:** Provide the use case that the Phase 8 cleanup cron will call. **Schedule registration is Phase 8.** **Do not start until Group 5 has passed its per-group gate.**

### 6.A Use case

| # | File | Class |
|---|------|-------|
| 6.1 | `use-cases/expire-hold.use-case.ts` | `ExpireHoldUseCase` — `execute(): Promise<{ expired: number }>`. `findMany` bookings where `status === HOLD AND holdExpiresAt < now()`. For each: `assertTransition(HOLD, EXPIRED)`, `update({ status: EXPIRED })`, `releaseHold.release(id)`, emit `booking.expired`. Return count. |

### 6.B Module export

| File | Action |
|------|--------|
| `bookings.module.ts` | **Modify** — register `ExpireHoldUseCase` as a provider AND `exports: [ExpireHoldUseCase]` so Phase 8's `BookingCleanupJob` can inject it. |
| `use-cases/index.ts` | **Modify** — re-export. |

### 6.C Per-group gate

1. Lint / build / type-check clean
2. Manual smoke: insert a `Booking` row with `status: HOLD, holdExpiresAt: now() - 60s`, then call the use case from a one-shot script (`ts-node`) — booking transitions to `EXPIRED`, Redis key gone, event captured.
3. **Stop here.**

---

## Group 7 — Cross-cutting wiring & DoD checks

| # | Item | Action |
|---|------|--------|
| 7.1 | `src/common/errors/error-codes.ts` | Confirm every `BKNG_*` code from `ERROR-REGISTRY.md` lines 117–126 is present (`BKNG_NOT_FOUND`, `BKNG_UNAVAILABLE`, `BKNG_INVALID_DATE_RANGE`, `BKNG_CONFIRMED_CANNOT_MODIFY`, `BKNG_NON_REFUNDABLE_WINDOW`, `BKNG_NOT_AUTHOR`, `BKNG_ALREADY_CANCELLED`, `BKNG_EXPIRED`, `BKNG_PAYMENT_PENDING`, `BKNG_EXCEEDS_OCCUPANCY`). Add any missing. |
| 7.2 | `backend/.env.example` | Add `BOOKING_HOLD_TTL_SECONDS=900` if missing. (Used as a default the `setHold.util.ts` reads via `ConfigService` so the value is overridable in tests / staging.) |
| 7.3 | `src/config/env.validation.ts` | Validate `BOOKING_HOLD_TTL_SECONDS` (Zod `z.coerce.number().int().min(60).max(3600).default(900)`). |
| 7.4 | `src/app.module.ts` | Confirm `BookingsModule` and `EventEmitterModule.forRoot()` are imported. |
| 7.5 | `npm run lint` | Zero errors / warnings. |
| 7.6 | `npm run build` | Compiles clean. |
| 7.7 | `npx tsc --noEmit` | No type errors. |
| 7.8 | `npm test -- src/modules/bookings` | All five critical-path unit tests pass (3 utils + 2 use-cases). |
| 7.9 | Manual smoke (per `validation.md`) | All curl commands succeed against a freshly-seeded local DB. |
| 7.10 | `backend/context/plans/PROGRESS-TRACKER.md` | Mark Phase 5 deliverables 🟢 Complete. Add note: "Tests for critical paths only — controller / E2E / property-based / 90 % coverage gate deferred to follow-up branch." |

---

## Group 8 — Follow-up branch hand-off (documentation only)

> **Not implementation work.** A short note added at the bottom of `PROGRESS-TRACKER.md` and the PR description listing what the follow-up branch must restore:

- `bookings.controller.spec.ts` — controller integration tests
- `bookings.e2e-spec.ts` — TEST-PLAN.md § 3.2 (creation + expiry), § 3.3 (double-book), § 3.6 (idempotency)
- `compute-refund.property.spec.ts` — fast-check property tests for refund tiers
- 90 % unit coverage on every use case in this branch (current branch ships ~5 critical-path specs only)

---

## Files to Create / Modify

### Use-case files (10)

| File |
|------|
| `create-guide-booking.use-case.ts` |
| `create-hotel-booking.use-case.ts` |
| `create-transportation-booking.use-case.ts` |
| `list-bookings.use-case.ts` |
| `get-booking-detail.use-case.ts` |
| `update-booking.use-case.ts` |
| `cancel-booking.use-case.ts` |
| `get-booking-qr.use-case.ts` |
| `get-booking-ical.use-case.ts` |
| `expire-hold.use-case.ts` |

### DTOs (6) + Interfaces (7) + Utils (9) + barrels (4) + module (1) + controllers (2)

See § "Folder Structure (target state)" above for the exhaustive tree.

### Critical-path tests (5)

| File |
|------|
| `utils/check-overlap.util.spec.ts` |
| `utils/compute-refund.util.spec.ts` |
| `utils/transition-status.util.spec.ts` |
| `use-cases/create-guide-booking.use-case.spec.ts` |
| `use-cases/cancel-booking.use-case.spec.ts` |

### Modified files

```
src/app.module.ts                           — import BookingsModule + EventEmitterModule.forRoot()
src/common/errors/error-codes.ts            — confirm/add BKNG_* codes
src/config/env.validation.ts                — validate BOOKING_HOLD_TTL_SECONDS
backend/.env.example                        — add BOOKING_HOLD_TTL_SECONDS=900
backend/context/plans/PROGRESS-TRACKER.md   — Phase 5 status
```

---

## Cache TTL Summary

> Booking endpoints are **not cached** — every request must reflect live status. The only Redis state introduced this branch is the **hold key** and the **idempotency key**.

| Key shape | TTL | Source |
|-----------|-----|--------|
| `booking_hold:{bookingId}` | 900 s (15 min) | `CONSTITUTION.md` § 3.3 + § 9.1, env-overridable via `BOOKING_HOLD_TTL_SECONDS` |
| `idem:booking:{userId}:{key}` | 86 400 s (24 h) | Idempotency window per `CONSTITUTION.md` § 2.5 |

---

## Risk & Decisions

| ID | Risk / Decision | Mitigation / Rationale |
|----|-----------------|------------------------|
| R1 | **Race between two concurrent bookings of the same resource for overlapping dates.** Postgres default isolation is `READ COMMITTED`; without `SELECT FOR UPDATE`, two transactions can both pass the overlap check and both insert. | This branch relies on the overlap predicate inside `prisma.$transaction` plus the fact that Postgres serialises writes on the same row. **Acceptable risk for MVP** because (a) per-resource booking volume is low and (b) `TEST-PLAN.md` § 3.3 (Double Booking Prevention) E2E test will exercise this path in the follow-up branch. **Hardening path (deferred):** add a unique GIST index on `(resource_id, daterange(start_date, end_date))` with status filter, which Postgres enforces atomically. |
| R2 | **Reference collisions on `Booking.reference @unique`.** | Retry-on-`P2002` up to 3× inside `generateReference` consumers. Probability of collision after 3 retries with 6-char base32: `~(1 / 32^6)^3` — astronomically small. |
| R3 | **`booking.created` event consumer (Phase 8) does not yet exist.** Emitting an event no one consumes is harmless (`EventEmitter2` is in-process). | Documented in `requirements.md` § "Decisions" item 16. Phase 8 plugs in by registering `@OnEvent('booking.created')` handlers without touching this branch. |
| R4 | **`@CurrentUser()` shape divergence with Phase 3.** | Use cases consume the `JwtPayload` interface exported from `src/modules/auth/interfaces`. If Phase 3 changed the shape since 2026-05-18, this branch rebases and adjusts at compile time (TypeScript catches it). |
| R5 | **iCal feed-readers may strip `\r` if generated wrong.** | `build-ical.util.ts` produces `\r\n` terminators per RFC 5545. Manual smoke verifies `head -1` shows `BEGIN:VCALENDAR\r`. |
| R6 | **Cancel-while-payment-processing window.** A user could call `POST /:id/cancel` after Stripe accepted the payment intent but before the webhook lands. | `cancel-booking.use-case.ts` queries `prisma.payment.findFirst({ where: { bookingId, status: PROCESSING } })` and throws `409 BKNG_PAYMENT_PENDING` if any. Webhook handler in Phase 6 will reconcile if a `succeeded` event arrives after a cancel. |
| R7 | **Tests deferred to follow-up branch.** | User direction. Critical paths are unit-tested in this branch. Pre-merge gate enforces full restoration of `TEST-PLAN.md` § 2 + § 3.2 + § 3.3 + § 3.6 before this code lands on `main`. |
| D1 | Use-case pattern matching `src/modules/auth/` and catalog modules. | User answer to skill question 3. Consistency over deviation. |
| D2 | Two controllers, one module (`BookingsController` + `InventoryBookingsController`). | URL shapes from `API-CONTRACT.md` § 11 require both `/v1/bookings/*` and `/v1/<resource>/:id/bookings` — splitting the controllers keeps both prefixes clean. |
| D3 | `set-hold.util.ts` is `@Injectable()` not a use case. | It is shared infrastructure (single-line Redis call), not an endpoint. Mirrors `CachedService` from Phase 4. |
| D4 | Cron schedule registration deferred to Phase 8. | ROADMAP § 8 explicitly owns scheduler wiring; this branch ships the use case the cron calls. |
| D5 | No trip-bookings endpoint. | `API-CONTRACT.md` § 11 has no `POST /v1/trips/:id/bookings`. Out of scope until product clarifies. |

---

## Definition of Done

- [ ] **Code matches `src/modules/auth/` and catalog-module layout** — `bookings/` has `module / controllers / dto/ / interfaces/ / use-cases/ / utils/` with barrels, **no `bookings.service.ts`**.
- [ ] One `*UseCase` class per endpoint, single public `execute()` method.
- [ ] Use cases inject only `PrismaService`, `RedisService`, `EventEmitter2`, sibling use cases, or thin `@Injectable()` utils — never a feature service (none exist).
- [ ] Controllers are thin: DTO in → `useCase.execute()` → return.
- [ ] Errors thrown via Nest exceptions with `{ code: ErrorCode.XXX, message }`. All `BKNG_*` codes from `ERROR-REGISTRY.md` are reachable.
- [ ] All endpoints listed in `API-CONTRACT.md` § 11 respond with the `{ success, data }` envelope.
- [ ] Pagination works on `GET /v1/bookings` (`page`, `limit` clamp at 100; default 20).
- [ ] Authorization: every endpoint resolves the booking against `user.sub` from the JWT; cross-user access returns `403 BKNG_NOT_AUTHOR`.
- [ ] `Booking.status` transitions only via `assertTransition`. Illegal transitions throw with the documented `BKNG_*` code.
- [ ] Hold key written on creation (`booking_hold:<id>`, TTL 900 s), released on cancel and on confirmation (Phase 6 owns the latter).
- [ ] `expire-hold.use-case.ts` exported from `BookingsModule` so Phase 8's cron can inject it.
- [ ] `booking.created` / `booking.cancelled` / `booking.expired` emitted with the exact payload shape from `EVENT-CATALOG.md`.
- [ ] Idempotency: identical `POST` retries with the same `Idempotency-Key` return byte-identical responses; no duplicate row.
- [ ] Refund tiers (`> 7 days = 100 %`, `3–7 days = 50 %`, `< 3 days = 0 %`) implemented as a pure function; unit-tested at boundaries.
- [ ] Five critical-path unit tests pass (`check-overlap`, `compute-refund`, `transition-status`, `create-guide-booking`, `cancel-booking`).
- [ ] `npm run lint` and `npm run build` clean; `npx tsc --noEmit` clean.
- [ ] `PROGRESS-TRACKER.md` updated with Phase 5 status and the "tests for critical paths only — follow-up branch required" note.
- [ ] **Pre-merge gate documented:** TEST-PLAN.md § 2 (Bookings = 90 % unit + integration + E2E + property) is unsatisfied this branch and must be restored in a follow-up before merge to `main`.
