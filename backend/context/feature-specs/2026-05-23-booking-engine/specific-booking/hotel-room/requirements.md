# Requirements: M4b — Hotel Room Booking

> **Sub-method:** M4b (Single-Resource — Hotel Room)
> **Resource:** `HotelRoom` (room *type*, not a single physical room)
> **Endpoint:** `POST /v1/hotels/:hotelId/bookings`
> **Reference prefix:** `HTL-`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Date:** 2026-05-25

This spec details **only** what is different about booking a hotel room. The atomic commit, hold, idempotency, refund tiers, status state machine, and the unified `GET / PATCH / cancel / qr / ical` endpoints are owned by the **shared foundation** spec (`../shared-foundation/`) and consumed here.

> **⚠️ Algorithmic note:** Unlike M4a (transportation) and M4c (guide), hotel rooms are an **inventory pool**, not a single physical resource. `HotelRoom.totalRooms` represents how many of this room type the hotel has. Availability is a **per-night counting problem**, not an interval-overlap problem. This is the largest deviation from the shared foundation's default behaviour and is documented in detail below.

---

## Scope

### In scope

- `POST /v1/hotels/:hotelId/bookings` — single endpoint
- `BookHotelRoomDto` — request body validation
- `BookHotelRoomUseCase` — assembles `CommitInput` and delegates to `commit-booking.use-case.ts`
- **Per-night inventory counter** (new — replaces interval overlap for this resource)
- Per-night pricing (rate × nights, no per-night variation in MVP)
- Occupancy validation (`adults + children ≤ room.maxOccupancy`)
- Snapshot fields for `BookingItem.snapshot`
- Hotel + room status validation (both must be `ACTIVE`)
- Check-in / check-out time snapshot (for iCal + confirmation)

### Out of scope (handled elsewhere)

- The `commit-booking` atomic primitive — `../shared-foundation/`
- Hold key, idempotency, reference generation, refund tiers — `../shared-foundation/`
- The `GET /v1/bookings*` read/update/cancel/qr/ical surface — `../shared-foundation/`
- `GET /v1/hotels/:hotelId/rooms/:roomId/availability` — Phase 5b (composed-booking availability check)
- Per-night dynamic pricing (peak / off-peak / weekend) — Phase 6
- Multi-room bookings in one request — never; one DTO = one room type, one stay
- Hotel partner portal / inventory dashboards — Phase 11

---

## Endpoint

### `POST /v1/hotels/:hotelId/bookings`

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT (default-on `JwtAuthGuard`) |
| Idempotency-Key | Required |
| Reference prefix | `HTL-` |
| `BookingItem` count | Exactly 1 (`itemType: HOTEL`) |
| Hold TTL | 900 s (shared default) |
| Response status | `201` with `Booking` in `HOLD` |

### Request body — `BookHotelRoomDto`

```ts
{
  roomId: string;             // uuid, required (must belong to :hotelId in path)
  checkInDate: string;        // ISO date (YYYY-MM-DD), required
  checkOutDate: string;       // ISO date, required, must be > checkInDate (nights ≥ 1)
  guestsAdults: number;       // int ≥ 1, required
  guestsChildren?: number;    // int ≥ 0, default 0
  specialRequests?: string;   // optional, max 1000 chars
}
```

### Response — `Booking` envelope

`BookingItem.snapshot` carries:

```ts
{
  hotelId: string;
  hotelName: string;
  roomId: string;
  roomName: string;           // e.g. "Deluxe Double Room"
  bedConfiguration: string;   // e.g. "1 King Bed"
  maxOccupancy: number;
  guestsAdults: number;
  guestsChildren: number;
  checkInTime: string;        // "14:00" — from hotels.check_in_time
  checkOutTime: string;       // "12:00" — from hotels.check_out_time
  cancellationPolicySnapshot: string;  // hotels.cancellation_policy at booking time
  nights: number;
  pricePerNightUsd: number;
}
```

The check-in/out times are snapshotted because hotels may change their policies later — the booking should always honour what was published at booking time.

---

## Pricing

| Quantity | Computation |
|----------|-------------|
| `nights` | `floor((checkOutDate - checkInDate) / 1day)` (must be ≥ 1) |
| `unitPriceUsd` | `room.pricePerNightUsd` (current value at booking time) |
| `subtotalUsd` | `unitPriceUsd × nights` |
| `totalPriceUsd` | `subtotalUsd` (no taxes/fees in MVP — defer to Phase 6) |

No per-night variation in MVP — every night charges the same `pricePerNightUsd`. Variable pricing is a Phase 6 enhancement and would change `BookingItem` to support per-night line items.

---

## Availability — per-night inventory counter

This is the **single biggest divergence** from M4a / M4c / M4d. Read carefully.

### Why it's different

`HotelRoom.totalRooms` is the inventory count of this room **type**. Two customers can book "Deluxe Double Room" for the same dates as long as `confirmed_bookings + new_booking ≤ totalRooms`. The shared `check-overlap.util.ts` (boolean overlap predicate) does **not** apply here.

### Algorithm

For the requested `[checkInDate, checkOutDate)` range and `roomId`:

```sql
-- For each night in [checkInDate, checkOutDate), count existing bookings.
WITH date_series AS (
  SELECT generate_series(:checkInDate::date, :checkOutDate::date - interval '1 day', '1 day')::date AS night
),
nightly_load AS (
  SELECT ds.night, COUNT(bi.id) AS booked
  FROM date_series ds
  LEFT JOIN booking_items bi
    ON bi.resource_id = :roomId
    AND bi.item_type = 'HOTEL'
    AND bi.start_date <= ds.night
    AND bi.end_date > ds.night
  LEFT JOIN bookings b
    ON b.id = bi.booking_id
    AND b.status IN ('HOLD', 'PENDING_PAYMENT', 'CONFIRMED')
    AND b.deleted_at IS NULL
  GROUP BY ds.night
)
SELECT night, booked FROM nightly_load WHERE booked >= :totalRooms;
```

If any row returned → throw `409 BKNG_UNAVAILABLE` with the offending night in the response detail.

### Where the algorithm lives

A new util `bookings/utils/check-room-availability.util.ts` lives in the **shared foundation** (because Phase 5b composed-booking will need it too). It is `@Injectable()` (takes `PrismaService`) — not pure — because it queries the DB. M4b consumes it inside the `commit-booking` transaction.

The shared foundation's `CommitBookingUseCase` is extended to dispatch on `itemType`:

| `itemType` | Availability strategy |
|------------|------------------------|
| `TRANSPORTATION`, `GUIDE`, `TRIP` | `check-overlap.util.ts` (interval predicate) |
| `HOTEL` | `check-room-availability.util.ts` (per-night counter) |

This dispatch is implemented in `commit-booking.use-case.ts` — see `../shared-foundation/requirements.md` § "Availability dispatch".

---

## Validation Errors

| Code | HTTP | Trigger |
|------|------|---------|
| `BKNG_INVALID_DATE_RANGE` | 400 | `checkOutDate ≤ checkInDate` (nights = 0) |
| `BKNG_EXCEEDS_OCCUPANCY` | 400 | `guestsAdults + guestsChildren > room.maxOccupancy` |
| `HTL_NOT_FOUND` | 404 | Hotel doesn't exist, soft-deleted, or `status ≠ ACTIVE` |
| `HTL_ROOM_NOT_FOUND` | 404 | Room doesn't exist, doesn't belong to `:hotelId`, soft-deleted, or `status ≠ ACTIVE` |
| `BKNG_UNAVAILABLE` | 409 | At least one night in range has `booked ≥ totalRooms` |
| `BKNG_INVALID_INPUT` | 400 | DTO validation fails |

`HTL_ROOM_NOT_FOUND` is **new** — must be added to `ERROR-REGISTRY.md` and `error-codes.ts`. (`HTL_NOT_FOUND` likely already exists from Phase 4.)

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Per-night inventory counter, not interval overlap.** | `HotelRoom.totalRooms > 1` is the documented MVP shape (`docs/modules/hotel-booking/requirements.md` "Availability Logic"). Overlap predicate would forbid concurrent bookings of the same room type, which is wrong. |
| 2 | **Date semantics: `[checkInDate, checkOutDate)`** — half-open interval. The night of `checkInDate` is occupied; the night of `checkOutDate` is not (the guest leaves that morning). | Industry-standard. Matches how `nights` is computed. |
| 3 | **Room must belong to the `:hotelId` in the path.** | Defence in depth — caller can't book "Phnom Penh Royal" room via `:hotelId = "Siem Reap Riverside"`. Throws `HTL_ROOM_NOT_FOUND` on mismatch. |
| 4 | **Snapshot `cancellationPolicy`, `checkInTime`, `checkOutTime` at booking time.** | Hotels can change policies later; refund / iCal logic must use the policy in effect when the user committed. |
| 5 | **No taxes/fees in MVP.** | Tax module is not yet specced. `totalPriceUsd === subtotalUsd`. Phase 6 introduces a `taxes` line via additional `BookingItem` rows or a separate `Booking.taxesUsd` column. |
| 6 | **Children count is captured but does not affect price.** | MVP simplification. Most room rates are per-room, not per-person. Phase 6 can add child-extra-bed pricing. |
| 7 | **`maxOccupancy` is the hard cap (`adults + children ≤ maxOccupancy`).** | Module spec uses `max_occupancy` per room. Children are not exempt — a 4-person room is 4 people total, age irrelevant. |
| 8 | **One `BookingItem` per stay regardless of nights.** | Uniform with M4a/c/d. Per-night line items are a Phase 6 concern when dynamic pricing arrives. |
| 9 | **No `linkedTripBookingId`.** | M4b is the simplest hotel booking. Hotels-as-part-of-package is an M1/M2/M3 concern (composed booking) — that path produces multiple `BookingItem` rows, not a single hotel booking with a link. |

---

## Use case skeleton

```ts
@Injectable()
export class BookHotelRoomUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    hotelId: string,
    dto: BookHotelRoomDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    // 1. Validate dates → at least 1 night
    const nights = computeNights(dto.checkInDate, dto.checkOutDate);
    if (nights < 1) {
      throw new BadRequestException({ code: ErrorCode.BKNG_INVALID_DATE_RANGE });
    }

    // 2. Fetch hotel
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!hotel) throw new NotFoundException({ code: ErrorCode.HTL_NOT_FOUND });

    // 3. Fetch room — must belong to hotel
    const room = await this.prisma.hotelRoom.findFirst({
      where: { id: dto.roomId, hotelId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!room) throw new NotFoundException({ code: ErrorCode.HTL_ROOM_NOT_FOUND });

    // 4. Occupancy guard
    const totalGuests = dto.guestsAdults + (dto.guestsChildren ?? 0);
    if (totalGuests > room.maxOccupancy) {
      throw new BadRequestException({ code: ErrorCode.BKNG_EXCEEDS_OCCUPANCY });
    }

    // 5. Compute price
    const subtotal = room.pricePerNightUsd.times(nights);

    // 6. Build CommitInput — commit-booking dispatches to per-night counter on itemType=HOTEL
    const input: CommitInput = {
      userId: user.sub,
      reference: generateReference('HTL'),
      totalPriceUsd: subtotal,
      items: [{
        type: 'HOTEL',
        resourceId: room.id,
        startDate: dto.checkInDate,
        endDate: dto.checkOutDate,
        quantity: nights,
        unitPriceUsd: room.pricePerNightUsd,
        subtotalUsd: subtotal,
        snapshot: {
          hotelId: hotel.id,
          hotelName: hotel.name,
          roomId: room.id,
          roomName: room.name,
          bedConfiguration: room.bedConfiguration,
          maxOccupancy: room.maxOccupancy,
          guestsAdults: dto.guestsAdults,
          guestsChildren: dto.guestsChildren ?? 0,
          checkInTime: hotel.checkInTime,
          checkOutTime: hotel.checkOutTime,
          cancellationPolicySnapshot: hotel.cancellationPolicy,
          nights,
          pricePerNightUsd: room.pricePerNightUsd.toNumber(),
        },
      }],
      metadata: {
        method: 'SINGLE_RESOURCE',
        singleResourceKind: 'HOTEL',
      },
    };

    return this.commitBooking.execute(user, input, idempotencyKey);
  }
}
```

---

## Dependencies

| Prerequisite | Status | Used for |
|--------------|--------|----------|
| `../shared-foundation/` | Must land first | `commit-booking.use-case.ts`, `check-room-availability.util.ts` (HOTEL dispatch), `BookingItem` schema |
| Phase 4 — `Hotel`, `HotelRoom` models | 🟢 Complete | `totalRooms`, `pricePerNightUsd`, `maxOccupancy`, `checkInTime`, `checkOutTime`, `cancellationPolicy` |
| `ERROR-REGISTRY.md` update | This spec | Add `HTL_ROOM_NOT_FOUND` if missing |

---

## Risk

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | **Two concurrent bookings each see `booked < totalRooms` and both insert.** Without `SELECT FOR UPDATE` or a serializable transaction, the per-night counter is racy. | Inside `commit-booking`'s `prisma.$transaction`, use `Prisma.TransactionIsolationLevel.Serializable`. Catch the serialization-failure error and retry up to 3× with exponential backoff. Document in `../shared-foundation/requirements.md` since the same pattern serves any future inventory-pool resources. Hardening path: a partial unique GIST index on `(resource_id, daterange)` does **not** apply here (rooms are pooled) — instead, an aggregate trigger or row-versioned `room_availability` table is the long-term fix. Out of MVP. |
| R2 | **`totalRooms` changed by admin between hold creation and payment confirmation.** Admin reduces inventory; existing HOLD becomes "over-allocated" relative to the new ceiling. | Admin status changes (Part B in parent spec) only affect **future** booking attempts. Existing HOLD/CONFIRMED rows are honoured. Documented as Phase 11 admin-cancel. |

---

## References

- Parent: `../requirements.md` (Phase 5a overview)
- Foundation: `../shared-foundation/requirements.md` § "Availability dispatch", § `check-room-availability.util.ts`
- Module spec: `docs/modules/hotel-booking/requirements.md` § "Availability Logic"
- API contract: `docs/modules/hotel-booking/api.yaml` § `POST /hotels/{hotelId}/bookings`
- Method definition: `../../booking-methods.md` § 1 (M4b)
