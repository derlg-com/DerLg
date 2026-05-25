# Plan: M4b — Hotel Room Booking

> **Sub-method:** M4b
> **Endpoint:** `POST /v1/hotels/:hotelId/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Status:** 🟡 Spec drafted, implementation not started
> **Prerequisite:** `../shared-foundation/` 🟢 Complete (specifically `check-room-availability.util.ts` + the HOTEL dispatch in `commit-booking.use-case.ts`)

This plan implements M4b only. The per-night inventory counter is built in `../shared-foundation/` because Phase 5b composed-booking will reuse it. Build M4b **last** of the four M4 endpoints since the foundation primitive it depends on is the most complex.

---

## Implementation order

| Group | Theme | Per-group gate |
|-------|-------|----------------|
| 1 | DTO + class-validator rules | Lint + type-check clean |
| 2 | `BookHotelRoomUseCase` | Lint + type-check + skeleton compiles |
| 3 | Controller route + module wiring | `POST /v1/hotels/:hotelId/bookings` returns 201 on a valid payload |
| 4 | Error code additions + DTO smoke | `validation.md` smoke commands all pass |

---

## Group 1 — DTO

| # | File | Action | Notes |
|---|------|--------|-------|
| 1.1 | `specific-booking/dto/book-hotel-room.dto.ts` | Create | Class-validator decorators; `checkOutDate` must be strictly after `checkInDate`. |
| 1.2 | `specific-booking/dto/index.ts` | Modify | Export the new DTO. |

### DTO contents

```ts
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { AfterDate } from '../../../common/validators/after-date.decorator';

export class BookHotelRoomDto {
  @IsUUID('4')
  roomId!: string;

  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  @AfterDate('checkInDate', { allowSameDay: false })
  checkOutDate!: string;

  @IsInt()
  @Min(1)
  guestsAdults!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  guestsChildren?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
```

Note `allowSameDay: false` — checkout must be at least 1 day after check-in (nights ≥ 1).

---

## Group 2 — Use case

| # | File | Action |
|---|------|--------|
| 2.1 | `specific-booking/use-cases/book-hotel-room.use-case.ts` | Create — see `requirements.md` § "Use case skeleton" |
| 2.2 | `specific-booking/use-cases/index.ts` | Modify — export the new use case |

### Implementation rules

1. Inject `PrismaService` and `CommitBookingUseCase`. No service layer.
2. Two DB lookups before commit: hotel by id, room by id+hotelId. Both filtered to `deletedAt: null, status: 'ACTIVE'`.
3. Occupancy guard runs **before** the commit transaction — fail-fast on bad input.
4. Compute `nights = Math.floor((checkOutDate - checkInDate) / 86_400_000)`. Treat as integer days; partial nights are rejected by the DTO.
5. Use `Prisma.Decimal` arithmetic for `subtotal`.
6. The snapshot must include `cancellationPolicySnapshot`, `checkInTime`, `checkOutTime` from the **hotel** row at the moment of booking.
7. The use case **does not** call `check-room-availability.util.ts` directly. The shared `commit-booking.use-case.ts` dispatches based on `itemType` — see `../shared-foundation/requirements.md`.

---

## Group 3 — Controller route + module wiring

| # | File | Action |
|---|------|--------|
| 3.1 | `specific-booking/specific-booking.controller.ts` | Modify — add `@Post('hotels/:hotelId/bookings')` handler |
| 3.2 | `specific-booking/specific-booking.module.ts` | Modify — register `BookHotelRoomUseCase` in `providers` |

### Controller handler

```ts
@Post('hotels/:hotelId/bookings')
hotel(
  @CurrentUser() user: JwtPayload,
  @Param('hotelId', ParseUUIDPipe) hotelId: string,
  @Body() dto: BookHotelRoomDto,
  @Headers('idempotency-key') key?: string,
) {
  return this.bookHotelRoom.execute(user, hotelId, dto, key);
}
```

`ParseUUIDPipe` rejects malformed `:hotelId` with `400` before the use case runs.

---

## Group 4 — Error codes + DTO smoke

| # | File | Action |
|---|------|--------|
| 4.1 | `src/common/errors/error-codes.ts` | Modify — add `HTL_ROOM_NOT_FOUND` if not already present from Phase 4 |
| 4.2 | `backend/context/specs/ERROR-REGISTRY.md` | Modify — confirm/add `HTL_NOT_FOUND`, `HTL_ROOM_NOT_FOUND`, `BKNG_EXCEEDS_OCCUPANCY` |
| 4.3 | `backend/context/specs/API-CONTRACT.md` § 11 | Modify — add request/response example for `POST /v1/hotels/:hotelId/bookings`, document the `BookingItem.snapshot` shape for HOTEL |
| 4.4 | `validation.md` smoke commands | Run | All curl commands in this spec's `validation.md` succeed |

---

## Out of scope (do not build in this spec)

- `check-room-availability.util.ts` — built in `../shared-foundation/`
- `Serializable` isolation level dispatch in `commit-booking` — built in `../shared-foundation/`
- Schema migrations (foundation owns)
- Hold key, idempotency, refund — foundation owns
- `GET /v1/hotels/:hotelId/rooms/:roomId/availability` — Phase 5b
- Per-night dynamic pricing
- Tax / fee line items
- Room upgrades / amenity add-ons
- Property tests, controller integration tests, E2E (deferred branch)

---

## File-count summary

| Bucket | Files |
|--------|-------|
| New | 1 DTO + 1 use case = **2** |
| Modified | 1 controller + 1 module + 1 DTO barrel + 1 use-case barrel + `error-codes.ts` + 2 doc files = **7** |

---

## Definition of Done

- [ ] `BookHotelRoomDto` validates required fields and rejects `checkOutDate ≤ checkInDate` with `400 BKNG_INVALID_DATE_RANGE`
- [ ] `BookHotelRoomUseCase` rejects `guestsAdults + guestsChildren > room.maxOccupancy` with `400 BKNG_EXCEEDS_OCCUPANCY`
- [ ] Use case rejects rooms that don't belong to `:hotelId` with `404 HTL_ROOM_NOT_FOUND`
- [ ] `POST /v1/hotels/:hotelId/bookings` returns `201` with `Booking` (status `HOLD`, ref `HTL-XXXXXX`, exactly 1 `BookingItem` of type `HOTEL`)
- [ ] `BookingItem.snapshot` contains `cancellationPolicySnapshot`, `checkInTime`, `checkOutTime`, `nights`, `pricePerNightUsd`
- [ ] Booking N+1 of the same room (where N = `totalRooms` already booked for those nights) returns `409 BKNG_UNAVAILABLE`
- [ ] Booking N (where N ≤ `totalRooms`) succeeds — concurrent bookings of the same room type are legal up to inventory
- [ ] Same `Idempotency-Key` retried → identical response, no duplicate row
- [ ] `ERROR-REGISTRY.md`, `API-CONTRACT.md` updated
- [ ] `validation.md` smoke commands all pass
