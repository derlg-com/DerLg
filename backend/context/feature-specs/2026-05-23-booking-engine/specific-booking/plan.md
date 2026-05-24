# Plan: Specific Booking — Foundation Layer (`feature/2026-05-23-booking-engine`)

> **Phase:** 5a (Specific Booking — single-resource / à-la-carte)
> **Method:** M4 from `../booking-methods.md`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Started:** 2026-05-24
> **Status:** 🟡 In Progress
> **Architecture:** Use-case pattern, mirroring `backend/src/modules/auth/` and `backend/src/modules/<catalog>/`. One `*UseCase` class per endpoint, single `execute()` method, injected directly into the controller. **No `<feature>.service.ts` files.**
> **Tests:** Critical paths only this branch. Unit tests are required for `check-overlap.util`, `compute-refund.util`, `transition-status.util`, `commit-booking.use-case`, and `cancel-booking.use-case`. Controller integration, full E2E, property-based tests, and the 90 % `TEST-PLAN.md` coverage gate are deferred to a follow-up branch and remain a hard merge prerequisite.

This plan is a series of numbered task groups. Implement top to bottom. Sub-tasks **within** a group may be written in any order, but **groups (1 → 2 → 3 → 4 → 5 → 6 → 7 → 8) must be implemented strictly sequentially**, one at a time, with the per-group gate passed before the next begins.

---

## Sequential implementation rule

**Implement one group at a time.** After Group 1 (shared booking primitives) lands, build the rest in order: atomic commit → M4 endpoints → unified read → update/cancel → QR/iCal → cron entrypoint → cross-cutting wiring. Do not begin Group N+1 until Group N has passed its per-group gate.

Each group ends with a per-group gate. The gate is identical for every group:

| # | Check | Command |
|---|-------|---------|
| 1 | Lint clean | `npm run lint` — zero errors / zero warnings |
| 2 | Build clean | `npm run build` succeeds |
| 3 | Type-check clean | `npx tsc --noEmit` — zero type errors |
| 4 | Critical-path unit tests pass (Groups 1, 2, 4 only) | `npm test -- bookings` — zero failures |
| 5 | Endpoints respond (Groups 3, 4, 5, 6) | Manual smoke per `validation.md` |
| 6 | Hold key populates / expires (Group 3 onwards) | `redis-cli KEYS 'booking_hold:*'` shows new keys with TTL ≈ 900 s after a `POST` |
| 7 | Update tracker | Tick the relevant boxes in `PROGRESS-TRACKER.md` for **this group only**; flip the group row to 🟢; append a row to "Recent Updates" |
| 8 | Stop & confirm | Pause for review **before** starting the next group |

---

## Code Standard — Use-Case Pattern (canonical)

Two modules. The first holds shared infrastructure used by **all** booking methods (M1–M4). The second holds **only** M4-specific endpoints.

### `BookingsModule` (shared, lives at `src/modules/bookings/`)

```
src/modules/bookings/
  bookings.module.ts                 # imports PrismaModule, RedisModule, CommonModule, EventEmitterModule;
                                     # providers: list ALL shared use cases + injectable utils
  bookings.controller.ts             # @Controller('bookings') for the unified read/update/cancel surface
  dto/
    list-bookings-query.dto.ts
    update-booking.dto.ts
    cancel-booking.dto.ts
    index.ts
  interfaces/
    commit-input.interface.ts        # CommitInput shape consumed by commit-booking.use-case.ts
    booking-item.interface.ts
    booking-detail.interface.ts
    unified-booking.interface.ts
    refund-result.interface.ts
    booking-event-payloads.interface.ts
    index.ts
  use-cases/
    commit-booking.use-case.ts       # ⭐ THE atomic commit primitive — shared by all methods
    list-bookings.use-case.ts
    get-booking-detail.use-case.ts
    update-booking.use-case.ts
    cancel-booking.use-case.ts
    get-booking-qr.use-case.ts
    get-booking-ical.use-case.ts
    expire-hold.use-case.ts
    index.ts
  utils/
    check-overlap.util.ts            # pure
    check-overlap.util.spec.ts       # critical-path unit test
    compute-refund.util.ts           # pure
    compute-refund.util.spec.ts      # critical-path unit test
    transition-status.util.ts        # pure
    transition-status.util.spec.ts   # critical-path unit test
    set-hold.util.ts                 # @Injectable() — Redis writer
    release-hold.util.ts             # @Injectable() — Redis deleter
    generate-reference.util.ts       # pure: '<KIND>-<6CHAR>' from uuid
    map-booking.util.ts              # pure: Prisma row → API DTO mappers
    build-ical.util.ts               # pure: Booking row → RFC 5545 string
    idempotency.util.ts              # @Injectable() — Redis read/write for idem keys
    index.ts
```

### `SpecificBookingModule` (M4 only, lives at `src/modules/specific-booking/`)

```
src/modules/specific-booking/
  specific-booking.module.ts         # imports BookingsModule (for commit-booking.use-case.ts)
  specific-booking.controller.ts     # @Controller() with fully-qualified routes for the 4 inventory-prefixed POSTs
  dto/
    book-transportation.dto.ts       # M4a
    book-hotel-room.dto.ts           # M4b
    book-guide.dto.ts                # M4c
    book-single-trip.dto.ts          # M4d
    index.ts
  use-cases/
    book-transportation.use-case.ts  # M4a — builds CommitInput, delegates to commit-booking
    book-hotel-room.use-case.ts      # M4b
    book-guide.use-case.ts           # M4c
    book-single-trip.use-case.ts     # M4d
    index.ts
```

### Use-case class template (shared commit primitive)

```ts
import { Injectable, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { checkOverlap } from '../utils/check-overlap.util';
import { generateReference } from '../utils/generate-reference.util';
import { SetHoldUtil } from '../utils/set-hold.util';
import { IdempotencyUtil } from '../utils/idempotency.util';
import { mapBookingDetail } from '../utils/map-booking.util';
import type { CommitInput, BookingDetail } from '../interfaces';
import type { JwtPayload } from '../../auth/interfaces';

@Injectable()
export class CommitBookingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly setHold: SetHoldUtil,
    private readonly idempotency: IdempotencyUtil,
    private readonly events: EventEmitter2,
  ) {}

  async execute(user: JwtPayload, input: CommitInput, idempotencyKey?: string): Promise<BookingDetail> {
    // 1. Idempotency lookup — return cached body if key seen
    // 2. prisma.$transaction(async (tx) => {
    //      a. For each input.items[i], findMany overlapping bookings (HOLD | PENDING_PAYMENT | CONFIRMED)
    //         on (resourceId, daterange). Throw 409 BKNG_UNAVAILABLE on any conflict.
    //      b. tx.booking.create({ data: { ..., status: HOLD, holdExpiresAt: now()+15min,
    //                                     reference, method: input.metadata.method,
    //                                     singleResourceKind: input.metadata.singleResourceKind } })
    //         (retry on P2002 reference-unique up to 3×)
    //      c. tx.bookingItem.createMany({ data: input.items.map(i => ({ bookingId, ...i })) })
    //    })
    // 3. setHold.set(booking.id, 900)
    // 4. eventEmitter.emit('booking.created', { ...payload, method, singleResourceKind })
    // 5. idempotency.store(user.sub, key, mapped) if idempotencyKey supplied
    // 6. return mapBookingDetail(booking, items)
  }
}
```

### Use-case class template (M4 endpoint — thin wrapper)

```ts
@Injectable()
export class BookTransportationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(user: JwtPayload, dto: BookTransportationDto, idempotencyKey?: string) {
    // 1. Validate vehicle ACTIVE
    const vehicle = await this.prisma.transportationVehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!vehicle) throw new NotFoundException({ code: ErrorCode.TRNS_NOT_FOUND, message: '...' });

    // 2. Compute price (vehicle.pricePerDay × days)
    const days = computeDays(dto.startDate, dto.endDate);
    const subtotal = vehicle.pricePerDay.times(days);

    // 3. Build CommitInput with exactly one item
    const input: CommitInput = {
      userId: user.sub,
      reference: generateReference('TRN'),
      totalPriceUsd: subtotal,
      items: [{
        type: 'TRANSPORTATION',
        resourceId: vehicle.id,
        startDate: dto.startDate,
        endDate: dto.endDate,
        quantity: 1,
        unitPriceUsd: vehicle.pricePerDay,
        subtotalUsd: subtotal,
        snapshot: { name: vehicle.label, type: vehicle.type, capacity: vehicle.capacity },
      }],
      metadata: {
        method: 'SINGLE_RESOURCE',
        singleResourceKind: 'TRANSPORTATION',
      },
    };

    // 4. Delegate to commit-booking
    return this.commitBooking.execute(user, input, idempotencyKey);
  }
}
```

### Controller template (specific-booking)

```ts
@Controller()
export class SpecificBookingController {
  constructor(
    private readonly bookTransportation: BookTransportationUseCase,
    private readonly bookHotelRoom: BookHotelRoomUseCase,
    private readonly bookGuide: BookGuideUseCase,
    private readonly bookSingleTrip: BookSingleTripUseCase,
  ) {}

  @Post('transportation/bookings')
  transportation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BookTransportationDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.bookTransportation.execute(user, dto, key);
  }

  @Post('hotels/:hotelId/bookings')
  hotel(
    @CurrentUser() user: JwtPayload,
    @Param('hotelId') hotelId: string,
    @Body() dto: BookHotelRoomDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.bookHotelRoom.execute(user, hotelId, dto, key);
  }

  @Post('guides/:guideId/bookings')
  guide(
    @CurrentUser() user: JwtPayload,
    @Param('guideId') guideId: string,
    @Body() dto: BookGuideDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.bookGuide.execute(user, guideId, dto, key);
  }

  @Post('trips/:tripId/bookings')
  trip(
    @CurrentUser() user: JwtPayload,
    @Param('tripId') tripId: string,
    @Body() dto: BookSingleTripDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.bookSingleTrip.execute(user, tripId, dto, key);
  }
}
```

### Module wiring

```ts
// bookings.module.ts
@Module({
  imports: [PrismaModule, RedisModule, CommonModule, EventEmitterModule.forRoot()],
  controllers: [BookingsController],
  providers: [
    CommitBookingUseCase,
    ListBookingsUseCase,
    GetBookingDetailUseCase,
    UpdateBookingUseCase,
    CancelBookingUseCase,
    GetBookingQrUseCase,
    GetBookingIcalUseCase,
    ExpireHoldUseCase,
    SetHoldUtil,
    ReleaseHoldUtil,
    IdempotencyUtil,
  ],
  exports: [CommitBookingUseCase, ExpireHoldUseCase],
})
export class BookingsModule {}

// specific-booking.module.ts
@Module({
  imports: [PrismaModule, BookingsModule],   // BookingsModule exports CommitBookingUseCase
  controllers: [SpecificBookingController],
  providers: [
    BookTransportationUseCase,
    BookHotelRoomUseCase,
    BookGuideUseCase,
    BookSingleTripUseCase,
  ],
})
export class SpecificBookingModule {}
```

### Conventions

1. **One use case per endpoint.** No mega-services.
2. **Constructor-only DI.** Use cases inject `PrismaService`, `RedisService`, `EventEmitter2`, sibling use cases (e.g. `CommitBookingUseCase`), or thin `@Injectable()` utils.
3. **Public surface = `execute()`.** No additional public methods.
4. **Errors:** `throw new <Nest>Exception({ code: ErrorCode.XXX, message })`. Match auth/catalog style.
5. **Imports:** relative paths only. Type-only imports use `import type`.
6. **Pure utils** in `bookings/utils/` — no DI. Thin Redis-touching helpers (`set-hold`, `release-hold`, `idempotency`) are `@Injectable()` providers.
7. **Barrels** — every subfolder has an `index.ts` re-exporting its members. `interfaces/index.ts` uses `export type * from './...'`.
8. **`Idempotency-Key` header parsing** lives in the controller (one line); the use case takes the key as an optional argument.

---

## Folder Structure (target state)

### Shared kernel additions / changes (`src/common/`)

```
src/common/
  errors/
    error-codes.ts                          (modified — confirm BKNG_* codes are present;
                                                         add any missing from ERROR-REGISTRY.md;
                                                         add TRIP_NO_AVAILABILITY for M4d)
```

### `BookingsModule` (Groups 1, 2, 4, 5, 6, 7)

```
src/modules/bookings/
  bookings.module.ts
  bookings.controller.ts
  dto/
    list-bookings-query.dto.ts
    update-booking.dto.ts
    cancel-booking.dto.ts
    index.ts
  interfaces/
    commit-input.interface.ts                ⭐ Group 2
    booking-item.interface.ts                ⭐ Group 2
    booking-detail.interface.ts
    unified-booking.interface.ts
    refund-result.interface.ts
    booking-event-payloads.interface.ts      # extended: + method + singleResourceKind
    index.ts
  use-cases/
    commit-booking.use-case.ts               ⭐ Group 2
    commit-booking.use-case.spec.ts          ⭐ Group 2 — critical-path unit test
    list-bookings.use-case.ts
    get-booking-detail.use-case.ts
    update-booking.use-case.ts
    cancel-booking.use-case.ts               ⭐ Group 4
    cancel-booking.use-case.spec.ts          ⭐ Group 4 — critical-path unit test
    get-booking-qr.use-case.ts
    get-booking-ical.use-case.ts
    expire-hold.use-case.ts
    index.ts
  utils/
    check-overlap.util.ts                    ⭐ Group 1
    check-overlap.util.spec.ts               ⭐ Group 1 — critical-path unit test
    compute-refund.util.ts                   ⭐ Group 1
    compute-refund.util.spec.ts              ⭐ Group 1 — critical-path unit test
    transition-status.util.ts                ⭐ Group 1
    transition-status.util.spec.ts           ⭐ Group 1 — critical-path unit test
    set-hold.util.ts
    release-hold.util.ts
    generate-reference.util.ts               # supports kinds: TRN, HTL, GDE, TRP (and PKG, PRV, CSM future)
    map-booking.util.ts
    build-ical.util.ts
    idempotency.util.ts
    index.ts
```

### `SpecificBookingModule` (Group 3)

```
src/modules/specific-booking/
  specific-booking.module.ts
  specific-booking.controller.ts
  dto/
    book-transportation.dto.ts
    book-hotel-room.dto.ts
    book-guide.dto.ts
    book-single-trip.dto.ts
    index.ts
  use-cases/
    book-transportation.use-case.ts
    book-hotel-room.use-case.ts
    book-guide.use-case.ts
    book-single-trip.use-case.ts
    index.ts
```

### Files modified outside the booking modules (Group 7)

```
src/app.module.ts                           (modified — import BookingsModule, SpecificBookingModule, EventEmitterModule.forRoot())
src/common/errors/error-codes.ts            (modified — confirm/add BKNG_* + GDE_/HTL_/TRNS_/TRIP_ codes)
prisma/schema.prisma                        (modified — add BookingMethod, SingleResourceKind enums; Booking.method, .singleResourceKind, .configurationId; BookingItem model — IF Phase 2 split has not landed)
backend/.env.example                        (modified — add BOOKING_HOLD_TTL_SECONDS=900 if missing)
backend/context/specs/EVENT-CATALOG.md      (modified — booking.created payload extended with method + singleResourceKind)
backend/context/specs/API-CONTRACT.md       (modified — § 11 add POST /v1/trips/:id/bookings, document method/singleResourceKind in response)
backend/context/plans/PROGRESS-TRACKER.md   (modified — Phase 5a status)
```

### File-count summary

| Bucket | Files |
|--------|-------|
| Shared use-case classes (in `bookings/`) | 8 (commit + list + detail + update + cancel + qr + ical + expire) |
| M4 use-case classes (in `specific-booking/`) | 4 (transportation + hotel + guide + trip) |
| Module files | 2 (`bookings.module.ts`, `specific-booking.module.ts`) |
| Controller files | 2 (`bookings.controller.ts`, `specific-booking.controller.ts`) |
| DTO files (excluding barrels) | 7 (3 shared + 4 M4) |
| Interface files (excluding barrels) | 6 |
| Util files (excluding barrels) | 9 |
| Critical-path unit tests | 5 (3 in `utils/`, 2 in `use-cases/`) |
| Barrel `index.ts` files | 6 |
| Modified files | 7 |
| **Total new files (incl. barrels + tests)** | **~52** |

---

## Group 1 — Shared booking primitives (foundation + critical-path tests)

> **Goal:** Build the pure helpers and thin Redis writers every later use case consumes. Three of the five required unit tests live in this group.

| # | File | Action | Notes |
|---|------|--------|-------|
| 1.1 | `bookings/utils/check-overlap.util.ts` | Create | Pure: `checkOverlap(existing, target): boolean`. Standard interval-overlap predicate: `existing.startDate < target.endDate && existing.endDate > target.startDate`. Adjacent ranges do not overlap. |
| 1.2 | `bookings/utils/check-overlap.util.spec.ts` | Create (test) | Cases: full overlap, partial overlap (left + right), exact equal range, adjacent (no overlap, both directions), empty existing list, single-day target, swapped boundaries. |
| 1.3 | `bookings/utils/compute-refund.util.ts` | Create | Pure: `computeRefund(booking, now): { amountUsd, percentage }`. Implements `CONSTITUTION.md` § 9.3: `> 7 days = 100 %`, `3–7 days = 50 %`, `< 3 days = 0 %`. Whole-day diff (truncate to midnight UTC). |
| 1.4 | `bookings/utils/compute-refund.util.spec.ts` | Create (test) | Cases: exact 8 days (100 %), exact 7 days (50 %), exact 4 days (50 %), exact 3 days (0 %), exact 2 days (0 %), already-started (0 %), zero amount, decimal preservation. |
| 1.5 | `bookings/utils/transition-status.util.ts` | Create | Pure: `assertTransition(from, to): void`. Throws with the corresponding `BKNG_*` code on illegal transitions. Legal: `HOLD → PENDING_PAYMENT \| CANCELLED \| EXPIRED`; `PENDING_PAYMENT → CONFIRMED \| CANCELLED \| EXPIRED`; `CONFIRMED → CANCELLED`. |
| 1.6 | `bookings/utils/transition-status.util.spec.ts` | Create (test) | Test every legal transition succeeds; every illegal one throws. |
| 1.7 | `bookings/utils/generate-reference.util.ts` | Create | Pure: `generateReference(kind: 'TRN' \| 'HTL' \| 'GDE' \| 'TRP' \| 'PKG' \| 'PRV' \| 'CSM'): string`. Returns `<KIND>-<6CHAR>` base32-uppercase from `crypto.randomUUID()`. (M1/M2/M3 prefixes pre-supported for future phases.) |
| 1.8 | `bookings/utils/set-hold.util.ts` | Create | `@Injectable()`. Constructor-injects `RedisService`. `set(bookingId, ttlSeconds = 900): Promise<void>` → `redis.setex('booking_hold:' + bookingId, ttl, '1')`. |
| 1.9 | `bookings/utils/release-hold.util.ts` | Create | `@Injectable()`. `release(bookingId)` → `redis.del('booking_hold:' + bookingId)`. |
| 1.10 | `bookings/utils/idempotency.util.ts` | Create | `@Injectable()`. `lookup(userId, key)`, `store(userId, key, response, ttlSeconds = 86400)`. Redis key shape: `idem:booking:{userId}:{key}`. |
| 1.11 | `bookings/utils/map-booking.util.ts` | Create | Pure mappers: `mapBookingDetail`, `mapUnifiedBooking`. Strip `Decimal` → number, ISO strings for dates, no leakage of `deletedAt`. |
| 1.12 | `bookings/utils/build-ical.util.ts` | Create | Pure: `buildIcal(booking)` returns RFC 5545 string with `\r\n` terminators. |
| 1.13 | `bookings/utils/index.ts` | Create | Barrel. |

### Per-group gate

1. `npm run lint` clean
2. `npm run build` clean
3. `npx tsc --noEmit` clean
4. `npm test -- src/modules/bookings/utils` — three new spec files pass
5. **Stop here.**

---

## Group 2 — Atomic commit primitive (`commit-booking.use-case.ts` + `BookingItem`)

> **Goal:** The single use case that all 4 specific-booking endpoints (and later M1/M2/M3) call to write a `Booking` + `BookingItem[]` atomically. One of the five critical-path unit tests lives here.

### 2.A Schema migration (only if Phase 2 split has not landed)

| # | File | Action |
|---|------|--------|
| 2.1 | `prisma/schema.prisma` | Modify — add `BookingMethod`, `SingleResourceKind` enums; `Booking.method`, `Booking.singleResourceKind`, `Booking.configurationId`; new `BookingItem` model. |
| 2.2 | Run `npx prisma migrate dev --name add_booking_method_and_items` | Generate the migration. |
| 2.3 | `npx prisma generate` | Regenerate the client. |

### 2.B Interfaces

| # | File | Action |
|---|------|--------|
| 2.4 | `bookings/interfaces/commit-input.interface.ts` | Create — discriminated shape: `userId, reference, totalPriceUsd, items: BookingItemInput[], metadata: { method, singleResourceKind?, configurationId? }`. |
| 2.5 | `bookings/interfaces/booking-item.interface.ts` | Create — `BookingItemInput`, `BookingItem` (DTO with `id`, `type`, `resourceId`, dates, prices, snapshot). |
| 2.6 | `bookings/interfaces/booking-detail.interface.ts` | Create — `BookingDetail` returned by commit + read. Includes `items: BookingItem[]`. |
| 2.7 | `bookings/interfaces/booking-event-payloads.interface.ts` | Create — extend `BookingCreatedEvent` with `method` and `singleResourceKind`. |
| 2.8 | `bookings/interfaces/index.ts` | Create barrel using `export type *`. |

### 2.C Use case

| # | File | Action |
|---|------|--------|
| 2.9 | `bookings/use-cases/commit-booking.use-case.ts` | Create. See template above. Includes `P2002` retry on reference uniqueness up to 3×. |

### 2.D Critical-path unit test

| # | File | Action |
|---|------|--------|
| 2.10 | `bookings/use-cases/commit-booking.use-case.spec.ts` | Create — Mocks `PrismaService` (`$transaction`, `bookingItem.findMany`, `booking.create`, `bookingItem.createMany`), `SetHoldUtil`, `IdempotencyUtil`, `EventEmitter2`. Asserts: (a) hold key written `booking_hold:<id>` with TTL 900, (b) overlap `findMany` throws `409 BKNG_UNAVAILABLE`, (c) `BookingItem` rows inserted matching `input.items.length`, (d) `booking.created` emitted with `method` + `singleResourceKind`, (e) idempotent retry returns the cached body. |

### 2.E Module skeleton

| # | File | Action |
|---|------|--------|
| 2.11 | `bookings/bookings.module.ts` | Create — register the commit use case + utils. Controllers list is empty for now (Group 4 adds `BookingsController`). Export `CommitBookingUseCase`. |

### Per-group gate

1. Lint / build / type-check clean
2. `npm test -- src/modules/bookings/use-cases/commit-booking.use-case.spec` passes
3. Manual smoke (bypass HTTP): write a one-shot `ts-node` script that constructs a `CommitInput` with one transportation item, calls `commitBookingUseCase.execute(...)`, and verifies a `Booking` + 1 `BookingItem` row are written + a `booking_hold:*` key exists in Redis with TTL ≈ 900.
4. **Stop here.**

---

## Group 3 — M4 endpoints (`SpecificBookingModule`)

> **Goal:** All four M4 endpoints work end-to-end: HOLD row written, one `BookingItem` per booking, Redis hold set with 900 s TTL, `booking.created` event emitted with `method: SINGLE_RESOURCE`, idempotency honoured.

### 3.A Use cases

| # | File | Class | `execute(...)` signature |
|---|------|-------|--------------------------|
| 3.1 | `specific-booking/use-cases/book-transportation.use-case.ts` | `BookTransportationUseCase` | `(user, dto: BookTransportationDto, idempotencyKey?): Promise<BookingDetail>` — validates vehicle ACTIVE; `400 BKNG_INVALID_DATE_RANGE` on bad dates; throws via `commit-booking`. |
| 3.2 | `specific-booking/use-cases/book-hotel-room.use-case.ts` | `BookHotelRoomUseCase` | `(user, hotelId, dto: BookHotelRoomDto, idempotencyKey?)` — validates hotel + room ACTIVE; `400 BKNG_EXCEEDS_OCCUPANCY` if `guestsAdults + guestsChildren > room.capacity`; `400 BKNG_INVALID_DATE_RANGE`. |
| 3.3 | `specific-booking/use-cases/book-guide.use-case.ts` | `BookGuideUseCase` | `(user, guideId, dto: BookGuideDto, idempotencyKey?)` — validates guide ACTIVE; `403 GDE_SUSPENDED / GDE_INACTIVE` on bad state; `400 BKNG_INVALID_DATE_RANGE`. |
| 3.4 | `specific-booking/use-cases/book-single-trip.use-case.ts` | `BookSingleTripUseCase` | `(user, tripId, dto: BookSingleTripDto, idempotencyKey?)` — validates trip ACTIVE; copies the trip's default journey-map snapshot into the single `BookingItem.snapshot`; `400 BKNG_INVALID_DATE_RANGE`. |

Each use case skeleton:

1. Validate inventory: `prisma.<resource>.findFirst({ where: { id, deletedAt: null, status: ACTIVE } })` → `404 / 403` per existing `ERROR-REGISTRY.md` codes.
2. Compute price (one resource, multiplied by duration where applicable).
3. Build `CommitInput` with exactly one `items[]` element and `metadata.method = 'SINGLE_RESOURCE'`, `metadata.singleResourceKind = '<KIND>'`.
4. `return this.commitBooking.execute(user, input, idempotencyKey)`.

### 3.B DTOs

| # | File | Action |
|---|------|--------|
| 3.5 | `specific-booking/dto/book-transportation.dto.ts` | `vehicleId: uuid`, `startDate: ISO`, `endDate: ISO`, `specialRequests?: string @MaxLength(1000)`. Custom `@AfterDate('startDate')` for `endDate`. |
| 3.6 | `specific-booking/dto/book-hotel-room.dto.ts` | `roomId: uuid`, `checkInDate: ISO`, `checkOutDate: ISO`, `guestsAdults: int @Min(1)`, `guestsChildren?: int @Min(0) @Default(0)`, `specialRequests?`. |
| 3.7 | `specific-booking/dto/book-guide.dto.ts` | `startDate: ISO`, `endDate: ISO`, `specialRequests?`. |
| 3.8 | `specific-booking/dto/book-single-trip.dto.ts` | `startDate: ISO`, `travelers: { adults: int @Min(1); children?: int @Min(0) @Default(0) }`, `specialRequests?`. |
| 3.9 | `specific-booking/dto/index.ts` | Barrel. |

### 3.C Controller

| # | File | Action |
|---|------|--------|
| 3.10 | `specific-booking/specific-booking.controller.ts` | Create — `@Controller()` with the four `@Post('<inventory>/bookings')` handlers. Auth is default-on from Phase 1's global `JwtAuthGuard`. |

### 3.D Module wiring

| # | File | Action |
|---|------|--------|
| 3.11 | `specific-booking/specific-booking.module.ts` | Create — imports `[PrismaModule, BookingsModule]`, controllers `[SpecificBookingController]`, providers list the four M4 use cases. |
| 3.12 | `specific-booking/use-cases/index.ts` | Create barrel. |
| 3.13 | `src/app.module.ts` | Modify — import `BookingsModule`, `SpecificBookingModule`, `EventEmitterModule.forRoot()` at the top level. |

### Per-group gate

1. Lint / build / type-check clean
2. Run the **creation** smoke commands from `validation.md` (all 4 M4 endpoints — 201 responses)
3. `redis-cli KEYS 'booking_hold:*'` shows fresh keys; `redis-cli TTL booking_hold:<id>` returns ~900
4. `prisma studio` → confirm one `BookingItem` row inserted per booking
5. **Stop here.**

---

## Group 4 — Unified read + update + cancel (`BookingsController`)

> **Goal:** Authenticated users can list / detail / update / cancel any of their bookings (M4 in this branch; M1/M2/M3 in 5b/5c). Two of the five critical-path unit tests close out in this group.

### 4.A Use cases

| # | File | Class |
|---|------|-------|
| 4.1 | `bookings/use-cases/list-bookings.use-case.ts` | `ListBookingsUseCase` — `execute(user, query): Promise<PaginatedResponse<UnifiedBooking>>`. `prisma.booking.findMany({ where: { userId: user.sub, deletedAt: null, status: query.status ?? undefined, method: query.method ?? undefined }, include: { items: true }, orderBy: { createdAt: 'desc' }, skip, take })` + `count`. |
| 4.2 | `bookings/use-cases/get-booking-detail.use-case.ts` | `GetBookingDetailUseCase` — `execute(user, id)`. Includes `items` + nested resource snapshots. `404 BKNG_NOT_FOUND`; `403 BKNG_NOT_AUTHOR`. |
| 4.3 | `bookings/use-cases/update-booking.use-case.ts` | `UpdateBookingUseCase` — HOLD only. `403 BKNG_CONFIRMED_CANNOT_MODIFY` if status ≠ `HOLD`. Re-runs overlap inside `$transaction`. |
| 4.4 | `bookings/use-cases/cancel-booking.use-case.ts` | `CancelBookingUseCase` — `execute(user, id, dto)`. `assertTransition(current, CANCELLED)`. `computeRefund(booking, now)`. `prisma.$transaction([booking.update({ status: CANCELLED, cancelledAt }), ...])`. `releaseHold.release(id)`. Emit `booking.cancelled` with `refundAmountUsd / refundPercentage`. |

### 4.B DTOs + interfaces

| File | Action |
|------|--------|
| `bookings/dto/list-bookings-query.dto.ts` | Extends `PageQueryDto`. Optional `status?: BookingStatus`, `method?: BookingMethod`. |
| `bookings/dto/update-booking.dto.ts` | All fields optional; class-validator. Validate at least one field present. |
| `bookings/dto/cancel-booking.dto.ts` | `reason?: string @MaxLength(500)`. |
| `bookings/interfaces/refund-result.interface.ts` | `{ refundAmountUsd, refundPercentage: 0 \| 50 \| 100, refundMethod: string \| null }`. |
| `bookings/interfaces/unified-booking.interface.ts` | Includes `method`, `singleResourceKind`, item count, price summary. |

### 4.C Controller

| File | Action |
|------|--------|
| `bookings/bookings.controller.ts` | Create — `@Controller('bookings')` with `@Get()`, `@Get(':id')`, `@Patch(':id')`, `@Post(':id/cancel')`. |
| `bookings/bookings.module.ts` | Modify — register `BookingsController` + the four use cases. |

### 4.D Critical-path unit test

| File | Action |
|------|--------|
| `bookings/use-cases/cancel-booking.use-case.spec.ts` | Create — Mocks Prisma + Redis + EventEmitter. Cases: 100 % tier (start in 10 days), 50 % tier (5 days), 0 % tier (1 day), already-cancelled throws, payment-processing throws. Asserts hold key released and event emitted with `EVENT-CATALOG.md` payload. |

### Per-group gate

1. Lint / build / type-check clean
2. `npm test -- src/modules/bookings/use-cases/cancel-booking.use-case.spec` passes
3. Smoke `validation.md` § "List + detail + update + cancel" passes
4. After cancel, `redis-cli EXISTS booking_hold:<id>` returns 0
5. **Stop here.**

---

## Group 5 — QR + iCal endpoints

> **Goal:** `GET /v1/bookings/:id/qr` returns `{ qrCodeUrl }`. `GET /v1/bookings/:id/ical` returns `text/calendar` content.

### 5.A Use cases

| # | File | Class |
|---|------|-------|
| 5.1 | `bookings/use-cases/get-booking-qr.use-case.ts` | `GetBookingQrUseCase` — `execute(user, id): Promise<{ qrCodeUrl: string }>`. URL placeholder `${FRONTEND_URL}/bookings/${reference}/qr`. |
| 5.2 | `bookings/use-cases/get-booking-ical.use-case.ts` | `GetBookingIcalUseCase` — `execute(user, id): Promise<string>`. RFC 5545 string. |

### 5.B Controller

| File | Action |
|------|--------|
| `bookings/bookings.controller.ts` | Modify — `@Get(':id/qr')`, `@Get(':id/ical')`. iCal sets `Content-Type: text/calendar; charset=utf-8` and `Content-Disposition: attachment; filename="<reference>.ics"`. |

### Per-group gate

1. Lint / build / type-check clean
2. `curl -i .../bookings/<id>/ical` returns `Content-Type: text/calendar`
3. iCal first line is `BEGIN:VCALENDAR\r`
4. **Stop here.**

---

## Group 6 — Cron entrypoint (`expire-hold.use-case.ts`)

> **Goal:** Provide the use case that the Phase 8 cleanup cron will call. Schedule registration is Phase 8.

### 6.A Use case

| # | File | Class |
|---|------|-------|
| 6.1 | `bookings/use-cases/expire-hold.use-case.ts` | `ExpireHoldUseCase` — `execute(): Promise<{ expired: number }>`. `findMany` bookings where `status === HOLD AND holdExpiresAt < now()`. For each: `assertTransition(HOLD, EXPIRED)`, `update({ status: EXPIRED })`, `releaseHold.release(id)`, emit `booking.expired`. |

### 6.B Module export

| File | Action |
|------|--------|
| `bookings/bookings.module.ts` | Modify — `exports: [CommitBookingUseCase, ExpireHoldUseCase]`. |

### Per-group gate

1. Lint / build / type-check clean
2. Manual smoke: insert a `Booking` row with `status: HOLD, holdExpiresAt: now() - 60s`, then call the use case from a one-shot `ts-node` script — booking transitions to `EXPIRED`, Redis key gone, event captured.
3. **Stop here.**

---

## Group 7 — Cross-cutting wiring & DoD

| # | Item | Action |
|---|------|--------|
| 7.1 | `src/common/errors/error-codes.ts` | Confirm every `BKNG_*` code from `ERROR-REGISTRY.md` is present. Add `TRIP_NO_AVAILABILITY` if missing. |
| 7.2 | `backend/.env.example` | Add `BOOKING_HOLD_TTL_SECONDS=900` if missing. |
| 7.3 | `src/config/env.validation.ts` | Validate `BOOKING_HOLD_TTL_SECONDS` (Zod `z.coerce.number().int().min(60).max(3600).default(900)`). |
| 7.4 | `src/app.module.ts` | Confirm `BookingsModule`, `SpecificBookingModule`, `EventEmitterModule.forRoot()` are imported. |
| 7.5 | `backend/context/specs/EVENT-CATALOG.md` | Update `booking.created` payload to include `method` + `singleResourceKind`. |
| 7.6 | `backend/context/specs/API-CONTRACT.md` | § 11 — add `POST /v1/trips/:id/bookings`; document `method` + `singleResourceKind` in responses. |
| 7.7 | `npm run lint` | Zero errors / warnings. |
| 7.8 | `npm run build` | Compiles clean. |
| 7.9 | `npx tsc --noEmit` | No type errors. |
| 7.10 | `npm test -- src/modules/bookings` | All five critical-path unit tests pass (3 utils + 2 use-cases). |
| 7.11 | Manual smoke (per `validation.md`) | All curl commands succeed against a freshly-seeded local DB. |
| 7.12 | `backend/context/plans/PROGRESS-TRACKER.md` | Mark Phase 5a deliverables 🟢 Complete. Note: "Tests for critical paths only — controller / E2E / property-based / 90 % coverage gate deferred to follow-up branch. M1/M2/M3 method modules deferred to Phase 5b/5c." |

---

## Group 8 — Follow-up branch hand-off (documentation only)

A short note added to `PROGRESS-TRACKER.md` and the PR description listing what the follow-up branches must restore:

- **Test coverage follow-up** (same scope, separate branch):
  - `bookings.controller.spec.ts` — controller integration tests
  - `specific-booking.controller.spec.ts` — controller integration tests
  - `bookings.e2e-spec.ts` — `TEST-PLAN.md` § 3.2, § 3.3, § 3.6
  - `compute-refund.property.spec.ts` — fast-check property tests
  - 90 % unit coverage on every use case in this branch

- **Phase 5b — Package Booking** (new feature folder `package-booking/`):
  - M1 + M2 method modules
  - `JourneyConfiguration` model + module
  - `availability/check`, `availability/confirm`, `journey-drafts`, unified `POST /v1/bookings { configurationId }`

- **Phase 5c — Build From Scratch** (new feature folder `build-from-scratch/`):
  - M3 method module (basics form, skeleton generator, per-day wizard)

---

## Files to Create / Modify

### Use-case files (12)

| Module | File |
|--------|------|
| bookings | `commit-booking.use-case.ts` |
| bookings | `list-bookings.use-case.ts` |
| bookings | `get-booking-detail.use-case.ts` |
| bookings | `update-booking.use-case.ts` |
| bookings | `cancel-booking.use-case.ts` |
| bookings | `get-booking-qr.use-case.ts` |
| bookings | `get-booking-ical.use-case.ts` |
| bookings | `expire-hold.use-case.ts` |
| specific-booking | `book-transportation.use-case.ts` |
| specific-booking | `book-hotel-room.use-case.ts` |
| specific-booking | `book-guide.use-case.ts` |
| specific-booking | `book-single-trip.use-case.ts` |

### DTOs (7) + Interfaces (6) + Utils (9) + barrels (6) + modules (2) + controllers (2)

See § "Folder Structure (target state)" for the exhaustive tree.

### Critical-path tests (5)

| File |
|------|
| `bookings/utils/check-overlap.util.spec.ts` |
| `bookings/utils/compute-refund.util.spec.ts` |
| `bookings/utils/transition-status.util.spec.ts` |
| `bookings/use-cases/commit-booking.use-case.spec.ts` |
| `bookings/use-cases/cancel-booking.use-case.spec.ts` |

### Modified files

```
prisma/schema.prisma                        — add BookingMethod, SingleResourceKind, BookingItem (if Phase 2 split not landed)
src/app.module.ts                           — import BookingsModule + SpecificBookingModule + EventEmitterModule.forRoot()
src/common/errors/error-codes.ts            — confirm/add BKNG_* codes
src/config/env.validation.ts                — validate BOOKING_HOLD_TTL_SECONDS
backend/.env.example                        — add BOOKING_HOLD_TTL_SECONDS=900
backend/context/specs/EVENT-CATALOG.md      — booking.created payload + method/singleResourceKind
backend/context/specs/API-CONTRACT.md       — § 11 add POST /v1/trips/:id/bookings
backend/context/plans/PROGRESS-TRACKER.md   — Phase 5a status
```

---

## Cache TTL Summary

> Booking endpoints are not cached — every request must reflect live status. The only Redis state introduced this branch is the **hold key** and the **idempotency key**.

| Key shape | TTL | Source |
|-----------|-----|--------|
| `booking_hold:{bookingId}` | 900 s (15 min) | `CONSTITUTION.md` § 3.3 + § 9.1, env-overridable via `BOOKING_HOLD_TTL_SECONDS` |
| `idem:booking:{userId}:{key}` | 86 400 s (24 h) | Idempotency window per `CONSTITUTION.md` § 2.5 |

---

## Risk & Decisions

| ID | Risk / Decision | Mitigation / Rationale |
|----|-----------------|------------------------|
| R1 | **Race between two concurrent bookings of the same resource for overlapping dates.** Postgres default isolation is `READ COMMITTED`; without `SELECT FOR UPDATE`, two transactions can both pass the overlap check and both insert. | This branch relies on the overlap predicate inside `prisma.$transaction` plus Postgres write serialisation on the same row. Acceptable for MVP because per-resource booking volume is low. **Hardening path (deferred):** add a unique GIST index on `(resource_id, daterange(start_date, end_date))` filtered by `status IN (HOLD, PENDING_PAYMENT, CONFIRMED)`. The follow-up E2E branch (`TEST-PLAN.md` § 3.3) exercises this path. |
| R2 | **Reference collisions on `Booking.reference @unique`.** | Retry-on-`P2002` up to 3× inside `commit-booking`. Probability after 3 retries with 6-char base32: `~(1 / 32^6)^3` — astronomically small. |
| R3 | **`booking.created` event consumer (Phase 8) does not yet exist.** | Emitting an event no one consumes is harmless (`EventEmitter2` is in-process). Phase 8 plugs in by registering `@OnEvent('booking.created')` handlers without touching this branch. |
| R4 | **`@CurrentUser()` shape divergence with Phase 3.** | Use cases consume the `JwtPayload` interface exported from `src/modules/auth/interfaces`. TypeScript catches any drift at compile time. |
| R5 | **iCal feed-readers may strip `\r` if generated wrong.** | `build-ical.util.ts` produces `\r\n` terminators per RFC 5545. Manual smoke verifies `head -1` shows `BEGIN:VCALENDAR\r`. |
| R6 | **Cancel-while-payment-processing window.** | `cancel-booking.use-case.ts` queries `prisma.payment.findFirst({ where: { bookingId, status: PROCESSING } })` and throws `409 BKNG_PAYMENT_PENDING`. Phase 6 webhook reconciles a late `succeeded` event. |
| R7 | **Tests deferred to follow-up branch.** | User direction. Critical paths are unit-tested. Pre-merge gate enforces full restoration of `TEST-PLAN.md` § 2 + § 3.2 + § 3.3 + § 3.6 before this code lands on `main`. |
| R8 | **Phase 2 schema split has not landed.** | This branch ships its own forward-compatible migration. The model fields (`method`, `singleResourceKind`, `configurationId`, `BookingItem`) are stable and will not change when senior's full split lands. |
| D1 | Two modules: `bookings/` (shared) + `specific-booking/` (M4). | `commit-booking` is shared by all 4 methods; isolating M4 endpoints from shared infrastructure is the boundary that makes Phase 5b/5c plug-and-play. |
| D2 | Always insert ≥ 1 `BookingItem` (M4 = 1, M1/M2/M3 = many). | Uniform data model. Read queries don't need method-conditional joins. |
| D3 | `commit-booking.use-case.ts` lives in `bookings/`, not in `specific-booking/`. | M1/M2/M3 modules will import it without depending on `specific-booking/`. |
| D4 | Event payload extended with `method` + `singleResourceKind`. | Phase 8 handlers route by method without parsing the booking row. Adding the discriminator now costs zero. |
| D5 | Cron schedule registration deferred to Phase 8. | ROADMAP § 8 explicitly owns scheduler wiring. |
| D6 | Reference prefix per kind (`TRN-`, `HTL-`, `GDE-`, `TRP-`). | Customer-support routing — the prefix tells the agent which inventory team to escalate to. |

---

## Definition of Done

- [ ] `bookings/` module has `commit-booking` + read/update/cancel/qr/ical/expire use cases, all 9 utils, and the unified `BookingsController`.
- [ ] `specific-booking/` module has 4 thin use cases delegating to `commit-booking` and one controller carrying 4 inventory-prefixed routes.
- [ ] `commit-booking.use-case.ts` is the only place that writes `Booking` rows in this branch.
- [ ] Every booking row has ≥ 1 `BookingItem` (M4 = exactly 1).
- [ ] Use cases inject only `PrismaService`, `RedisService`, `EventEmitter2`, sibling use cases, or thin `@Injectable()` utils — never a feature service (none exist).
- [ ] Controllers are thin: DTO in → `useCase.execute()` → return.
- [ ] Errors thrown via Nest exceptions with `{ code: ErrorCode.XXX, message }`. All `BKNG_*` codes from `ERROR-REGISTRY.md` are reachable.
- [ ] All endpoints respond with the `{ success, data }` envelope.
- [ ] Pagination works on `GET /v1/bookings` (`page`, `limit` clamp at 100; default 20).
- [ ] Authorization: every endpoint resolves the booking against `user.sub` from the JWT; cross-user access returns `403 BKNG_NOT_AUTHOR`.
- [ ] `Booking.status` transitions only via `assertTransition`. Illegal transitions throw with the documented `BKNG_*` code.
- [ ] Hold key written on creation (`booking_hold:<id>`, TTL 900 s), released on cancel and on confirmation (Phase 6 owns the latter).
- [ ] `expire-hold.use-case.ts` exported from `BookingsModule` so Phase 8's cron can inject it.
- [ ] `booking.created` / `booking.cancelled` / `booking.expired` emitted with the exact payload shape from `EVENT-CATALOG.md` (extended with `method` + `singleResourceKind`).
- [ ] Idempotency: identical `POST` retries with the same `Idempotency-Key` return byte-identical responses; no duplicate row.
- [ ] Refund tiers (`> 7 days = 100 %`, `3–7 days = 50 %`, `< 3 days = 0 %`) implemented as a pure function; unit-tested at boundaries.
- [ ] Five critical-path unit tests pass (`check-overlap`, `compute-refund`, `transition-status`, `commit-booking`, `cancel-booking`).
- [ ] `npm run lint` and `npm run build` clean; `npx tsc --noEmit` clean.
- [ ] `EVENT-CATALOG.md` and `API-CONTRACT.md` updated.
- [ ] `PROGRESS-TRACKER.md` updated with Phase 5a status and the deferral note.
- [ ] Pre-merge gate documented: `TEST-PLAN.md` § 2 (Bookings = 90 %) is unsatisfied this branch and must be restored in a follow-up before merge to `main`.
