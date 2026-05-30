# Plan: M4d — Single Trip Booking (As-Is)

> **Sub-method:** M4d
> **Endpoint:** `POST /v1/trips/:tripId/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Status:** 🟡 Spec drafted, implementation not started
> **Prerequisite:** `../shared-foundation/` 🟢 Complete

This plan implements M4d only. The atomic commit, hold/idempotency/refund utilities, and the unified read/update/cancel surface come from `../shared-foundation/` and are not rebuilt here.

---

## Implementation order

| Group | Theme | Per-group gate |
|-------|-------|----------------|
| 1 | DTO + class-validator rules | Lint + type-check clean |
| 2 | `BookSingleTripUseCase` | Lint + type-check + skeleton compiles |
| 3 | Controller route + module wiring | `POST /v1/trips/:tripId/bookings` returns 201 on a valid payload |
| 4 | Error code additions + DTO smoke | `validation.md` smoke commands all pass |

---

## Group 1 — DTO

| # | File | Action | Notes |
|---|------|--------|-------|
| 1.1 | `specific-booking/dto/book-single-trip.dto.ts` | Create | Class-validator decorators; nested `travelers` validation. |
| 1.2 | `specific-booking/dto/index.ts` | Modify | Export the new DTO. |

### DTO contents

```ts
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class TravelersDto {
  @IsInt()
  @Min(1)
  adults!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;
}

export class BookSingleTripDto {
  @IsDateString()
  startDate!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TravelersDto)
  travelers!: TravelersDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
```

`endDate` is **not** in the DTO — derived from `trip.durationDays`.

---

## Group 2 — Use case

| # | File | Action |
|---|------|--------|
| 2.1 | `specific-booking/use-cases/book-single-trip.use-case.ts` | Create — see `requirements.md` § "Use case skeleton" |
| 2.2 | `specific-booking/use-cases/index.ts` | Modify — export the new use case |

### Implementation rules

1. Inject only `PrismaService` and `CommitBookingUseCase`.
2. Past-date check uses UTC midnight as the reference (`new Date(new Date().toISOString().slice(0, 10))`). Avoid local timezone — server runs UTC, frontend dates are ISO `YYYY-MM-DD`.
3. `endDate` derivation: `endDate = startDate + (durationDays - 1) days`. A 1-day trip ends the same day.
4. Total travelers cap: `adults + (children ?? 0) > trip.maxGuests` → `400 BKNG_EXCEEDS_GUESTS`.
5. Pricing: `subtotal = trip.priceUsd × totalTravelers`. No child discount in MVP — both adults and children pay `pricePerPersonUsd`.
6. Snapshot must include `itinerarySnapshot: trip.translations` (frozen). This is the most important snapshot — without it, refund and confirmation views break when ops edit a trip.
7. Use the shared `generate-reference.util.ts` with kind `'TRP'`.
8. Use `Prisma.Decimal` arithmetic.

---

## Group 3 — Controller route + module wiring

| # | File | Action |
|---|------|--------|
| 3.1 | `specific-booking/specific-booking.controller.ts` | Modify — add `@Post('trips/:tripId/bookings')` handler |
| 3.2 | `specific-booking/specific-booking.module.ts` | Modify — register `BookSingleTripUseCase` in `providers` |

### Controller handler

```ts
@Post('trips/:tripId/bookings')
trip(
  @CurrentUser() user: JwtPayload,
  @Param('tripId', ParseUUIDPipe) tripId: string,
  @Body() dto: BookSingleTripDto,
  @Headers('idempotency-key') key?: string,
) {
  return this.bookSingleTrip.execute(user, tripId, dto, key);
}
```

---

## Group 4 — Error codes + DTO smoke

| # | File | Action |
|---|------|--------|
| 4.1 | `src/common/errors/error-codes.ts` | Modify — add `BKNG_EXCEEDS_GUESTS` (400). Confirm `TRIP_NOT_FOUND` exists (likely from Phase 4). |
| 4.2 | `backend/context/specs/ERROR-REGISTRY.md` | Modify — add `BKNG_EXCEEDS_GUESTS` |
| 4.3 | `backend/context/specs/API-CONTRACT.md` § 11 | Modify — add request/response example for `POST /v1/trips/:tripId/bookings`, document `endDate` derivation and the `itinerarySnapshot` shape |
| 4.4 | `validation.md` smoke commands | Run | All curl commands in this spec's `validation.md` succeed |

---

## Out of scope (do not build in this spec)

- Schema migrations (foundation owns)
- Hold key, idempotency, refund, reference generation (foundation owns)
- Customizable trip flow (M1/M2/M3) — Phase 5b
- Per-date trip capacity tracking — Phase 5b
- Child-discount pricing — Phase 6
- Group / promo / loyalty discounts — Phase 6/7
- Multiple departure dates per trip
- Property tests, controller integration tests, E2E (deferred branch)

---

## File-count summary

| Bucket | Files |
|--------|-------|
| New | 1 DTO (with nested `TravelersDto`) + 1 use case = **2** |
| Modified | 1 controller + 1 module + 1 DTO barrel + 1 use-case barrel + `error-codes.ts` + 2 doc files = **7** |

---

## Definition of Done

- [ ] `BookSingleTripDto` validates required fields with nested `travelers` validation
- [ ] `BookSingleTripUseCase` rejects past-dated `startDate` with `400 BKNG_INVALID_DATE_RANGE`
- [ ] Use case rejects `adults + children > trip.maxGuests` with `400 BKNG_EXCEEDS_GUESTS`
- [ ] `POST /v1/trips/:tripId/bookings` returns `201` with `Booking` (status `HOLD`, ref `TRP-XXXXXX`, exactly 1 `BookingItem` of type `TRIP`)
- [ ] `BookingItem.endDate === startDate + (durationDays - 1) days`
- [ ] `BookingItem.totalPriceUsd === trip.priceUsd × (adults + children)` (no child discount)
- [ ] `BookingItem.snapshot.itinerarySnapshot` contains the trip's `translations` payload (frozen)
- [ ] Same user trying to book the same trip on overlapping dates → `409 BKNG_UNAVAILABLE`
- [ ] Different users can book the same trip on the same dates (no per-date capacity in MVP)
- [ ] Same `Idempotency-Key` retried → identical response, no duplicate row
- [ ] `ERROR-REGISTRY.md`, `API-CONTRACT.md` updated
- [ ] `validation.md` smoke commands all pass
