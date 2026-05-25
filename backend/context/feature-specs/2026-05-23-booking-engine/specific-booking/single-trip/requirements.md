# Requirements: M4d — Single Trip Booking (As-Is)

> **Sub-method:** M4d (Single-Resource — Trip)
> **Resource:** `Trip`
> **Endpoint:** `POST /v1/trips/:tripId/bookings`
> **Reference prefix:** `TRP-`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Date:** 2026-05-25

This spec details **only** what is different about booking a trip **as-is** (no journey-map customization). The atomic commit, hold, idempotency, refund tiers, status state machine, and the unified `GET / PATCH / cancel / qr / ical` endpoints are owned by the **shared foundation** spec (`../shared-foundation/`) and consumed here.

> **Boundary with M1/M2/M3:** This is **not** the customizable trip flow. M4d is for users who pick a published trip ("Angkor Wat 1-Day Tour") and book it without changing anything — same dates the trip publishes, same itinerary, same activities. Customizable trip flows (journey-map, day reordering, activity swapping) are M1/M2/M3 in Phase 5b — they go through `JourneyConfiguration`, not this endpoint.

---

## Scope

### In scope

- `POST /v1/trips/:tripId/bookings` — single endpoint
- `BookSingleTripDto` — request body validation
- `BookSingleTripUseCase` — assembles `CommitInput` and delegates to `commit-booking.use-case.ts`
- Per-person pricing: `priceUsd × (adults + children)` (no child discount in MVP)
- `endDate` derived from `startDate + trip.durationDays`
- Max-guests cap (`adults + children ≤ trip.maxGuests`)
- Snapshot of trip's default itinerary into `BookingItem.snapshot`
- Trip status validation (`ACTIVE` only)

### Out of scope (handled elsewhere)

- The `commit-booking` atomic primitive — `../shared-foundation/`
- Hold key, idempotency, reference generation, refund tiers — `../shared-foundation/`
- The `GET /v1/bookings*` read/update/cancel/qr/ical surface — `../shared-foundation/`
- **Customization** — choosing different days, reordering, swapping activities, changing the hotel — M1/M2/M3 in Phase 5b
- **Multi-day journey map** — same as above; M4d uses the trip's default itinerary as a static snapshot
- Child discount pricing — Phase 6 (decision documented below)
- Group discount / promo codes / loyalty redemption — Phase 6 / Phase 7
- Trip availability calendar (per-date capacity tracking) — Phase 5b
- Multiple departure dates — MVP assumes any future date is bookable

---

## Endpoint

### `POST /v1/trips/:tripId/bookings`

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT (default-on `JwtAuthGuard`) |
| Idempotency-Key | Required |
| Reference prefix | `TRP-` |
| `BookingItem` count | Exactly 1 (`itemType: TRIP`) |
| Hold TTL | 900 s (shared default) |
| Response status | `201` with `Booking` in `HOLD` |

### Request body — `BookSingleTripDto`

```ts
{
  startDate: string;           // ISO date (YYYY-MM-DD), required, must be in the future
  travelers: {
    adults: number;            // int ≥ 1, required
    children?: number;         // int ≥ 0, default 0
  };
  specialRequests?: string;    // optional, max 1000 chars
}
```

`tripId` comes from the URL path. `endDate` is **not** in the body — it is computed as `startDate + trip.durationDays - 1day` (a `durationDays: 3` trip starting on the 1st ends on the 3rd).

### Response — `Booking` envelope

`BookingItem.snapshot` carries:

```ts
{
  tripId: string;
  slug: string;                // e.g. "angkor-wat-1-day"
  name: string;
  category: string;            // 'Temples' | 'Nature' | 'Culture' | 'Adventure' | 'Food'
  durationDays: number;
  travelersAdults: number;
  travelersChildren: number;
  totalTravelers: number;
  pricePerPersonUsd: number;
  meetingPoint: string;        // GPS + description from trips.meeting_point
  cancellationPolicySnapshot: string;
  includedItems: string[];
  excludedItems: string[];
  itinerarySnapshot: Json;     // trips.translations.itinerary_days for current accept-language (frozen at booking time)
  coverImageUrl: string;
}
```

The `itinerarySnapshot` freezes the published itinerary at booking time. If the operations team later edits the trip (e.g., changes lunch venue), the user's already-booked tour shows what they signed up for, not the new version.

---

## Pricing

| Quantity | Computation |
|----------|-------------|
| `totalTravelers` | `adults + (children ?? 0)` |
| `pricePerPersonUsd` | `trip.priceUsd` (current value at booking time) |
| `subtotalUsd` | `pricePerPersonUsd × totalTravelers` |
| `totalPriceUsd` | `subtotalUsd` |

**No child discount in MVP.** A child counts as one full traveler. Documented in Decisions and explicitly called out in the `BookingItem.snapshot` (so refund / receipt math is unambiguous). Phase 6 may introduce age-based pricing tiers — that would change the snapshot to `{ adults: { count, unitPrice }, children: { count, unitPrice } }`.

---

## Date semantics

| Computation | Rule |
|-------------|------|
| `startDate` | From DTO; must be ≥ `today` (UTC midnight) |
| `endDate` (for overlap check, BookingItem, iCal) | `startDate + (trip.durationDays - 1) days` |

A 1-day trip starting `2026-09-01` has `endDate = 2026-09-01` (same day). A 3-day trip starting `2026-09-01` has `endDate = 2026-09-03`.

For overlap checking, M4d uses the **same** interval predicate as M4a/c. A trip is treated as a single resource — two overlapping bookings of the **same** `tripId` for the same dates by the same user is rejected with `BKNG_UNAVAILABLE`. Different users booking the same trip for the same dates is **allowed** (trips are not capacity-limited in MVP — see "Out of scope: Trip availability calendar").

> **Note:** This is intentionally permissive. Real trip-capacity enforcement requires a per-date inventory model (similar to hotels), which is a Phase 5b enhancement. In MVP, `Trip.maxGuests` is a **per-booking** cap, not a per-date capacity.

---

## Validation Errors

| Code | HTTP | Trigger |
|------|------|---------|
| `BKNG_INVALID_DATE_RANGE` | 400 | `startDate < today` |
| `TRIP_NOT_FOUND` | 404 | Trip doesn't exist, soft-deleted, or `status ≠ ACTIVE` |
| `BKNG_EXCEEDS_GUESTS` | 400 | `adults + children > trip.maxGuests` |
| `BKNG_UNAVAILABLE` | 409 | Same user already has a HOLD/PENDING_PAYMENT/CONFIRMED booking on this `tripId` for overlapping dates |
| `BKNG_INVALID_INPUT` | 400 | DTO validation fails |

`BKNG_EXCEEDS_GUESTS` is **new** — must be added to `ERROR-REGISTRY.md` and `error-codes.ts`. (Distinct from `BKNG_EXCEEDS_OCCUPANCY` which is hotel-room-specific.)

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **`endDate` is derived, not user-supplied.** | A trip is published with a fixed `durationDays`. M4d is the "as-is" path — the user picks the start date, duration is fixed by the trip. Letting users specify an end date would either be redundant (must equal derived) or invalid (creates a customized trip, which is M2/M3 territory). |
| 2 | **No child discount in MVP.** | `Trip.priceUsd` is documented as "Base price per person" (`docs/modules/trip-discovery/requirements.md`). No child-pricing column exists. Adding one is a schema change — defer to Phase 6. Frontend should display "$X per person, all ages" so the user isn't surprised. |
| 3 | **`maxGuests` is per-booking, not per-date.** | MVP simplification. Two separate users can each book "Angkor Wat 1-Day Tour" for `2026-09-01` with 5 travelers each — even if `maxGuests = 8`. Real per-date capacity tracking is Phase 5b. |
| 4 | **Same-user overlap on same trip → 409.** | Prevents accidental double-booking. If a user genuinely wants two parties on the same trip on the same date, they make two separate bookings on different dates or accept that they'll show up as one party. |
| 5 | **`startDate` must be ≥ today (UTC midnight).** | Past-dated trips can't be sold. Today is allowed (walk-in same-day book). |
| 6 | **`itinerarySnapshot` freezes the published itinerary.** | Marketing / ops can edit the trip at any time; the user's confirmation must always show what they paid for. iCal export and reviews depend on the snapshot, not the live row. |
| 7 | **No `linkedHotelBookingId` or `linkedTransportBookingId`.** | Composing trip + hotel + transport at booking time is M1/M2/M3 territory. M4d is strictly "trip alone, as published." If a user wants a guide alongside, they use M4c with `linkedTripBookingId`. |
| 8 | **`category` and `coverImageUrl` are in the snapshot.** | Used by the read-side and iCal — avoids a JOIN on every booking detail load. |
| 9 | **Trip's `Trip.tripType` (`PUBLIC | PRIVATE`) does not affect M4d.** | Both can be booked as-is via M4d. The customization difference (PUBLIC = limited customization, PRIVATE = full customization) is an M1 vs M2 concern in Phase 5b. M4d ignores the distinction. |

---

## Use case skeleton

```ts
@Injectable()
export class BookSingleTripUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    tripId: string,
    dto: BookSingleTripDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    // 1. Validate startDate is not in the past
    const startDate = new Date(dto.startDate);
    const todayUtcMidnight = new Date(new Date().toISOString().slice(0, 10));
    if (startDate < todayUtcMidnight) {
      throw new BadRequestException({ code: ErrorCode.BKNG_INVALID_DATE_RANGE });
    }

    // 2. Fetch trip
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!trip) throw new NotFoundException({ code: ErrorCode.TRIP_NOT_FOUND });

    // 3. Guest count cap
    const adults = dto.travelers.adults;
    const children = dto.travelers.children ?? 0;
    const total = adults + children;
    if (total > trip.maxGuests) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_EXCEEDS_GUESTS,
        message: `Trip allows up to ${trip.maxGuests} travelers; got ${total}`,
      });
    }

    // 4. Derive endDate
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + trip.durationDays - 1);

    // 5. Compute price
    const subtotal = trip.priceUsd.times(total);

    // 6. Build CommitInput
    const input: CommitInput = {
      userId: user.sub,
      reference: generateReference('TRP'),
      totalPriceUsd: subtotal,
      items: [{
        type: 'TRIP',
        resourceId: trip.id,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        quantity: total,
        unitPriceUsd: trip.priceUsd,
        subtotalUsd: subtotal,
        snapshot: {
          tripId: trip.id,
          slug: trip.slug,
          name: trip.translations.en?.name ?? trip.slug,
          category: trip.category,
          durationDays: trip.durationDays,
          travelersAdults: adults,
          travelersChildren: children,
          totalTravelers: total,
          pricePerPersonUsd: trip.priceUsd.toNumber(),
          meetingPoint: trip.meetingPoint,
          cancellationPolicySnapshot: trip.cancellationPolicy,
          includedItems: trip.includedItems,
          excludedItems: trip.excludedItems,
          itinerarySnapshot: trip.translations,  // freeze full translations
          coverImageUrl: trip.coverImageUrl,
        },
      }],
      metadata: {
        method: 'SINGLE_RESOURCE',
        singleResourceKind: 'TRIP',
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
| `../shared-foundation/` | Must land first | `commit-booking.use-case.ts`, `check-overlap.util.ts`, `generate-reference.util.ts` (kind `TRP`) |
| Phase 4 — `Trip` model | 🟢 Complete | `priceUsd`, `durationDays`, `maxGuests`, `meetingPoint`, `includedItems`, `excludedItems`, `cancellationPolicy`, `translations` |
| `ERROR-REGISTRY.md` update | This spec | Add `BKNG_EXCEEDS_GUESTS` and confirm `TRIP_NOT_FOUND` |

---

## Risk

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | **Two users book the same trip for the same date — appears overbooked but isn't tracked.** Per Decision #3, MVP doesn't enforce per-date capacity. Operations team must monitor. | Phase 5b adds per-date trip capacity. In the meantime, `Trip.maxGuests` enforcement at the booking level prevents one party from booking more travelers than the trip can handle, which is the more dangerous failure mode. |
| R2 | **Itinerary edited mid-flight.** Ops team edits the trip while a HOLD is open. | The snapshot freezes at commit time, so the booking is unaffected. New bookings see the new itinerary. No mitigation needed — this is intentional. |
| R3 | **Translations payload is large.** Snapshotting `trip.translations` (EN + ZH + KM) into `BookingItem.snapshot` could bloat the JSONB column. | `translations` for a typical 3-day trip is < 50 KB. JSONB handles this fine. If trips ever exceed 500 KB, snapshot only the user's accept-language and store a pointer to a frozen `trip_versions` table — Phase 6+. |

---

## References

- Parent: `../requirements.md` (Phase 5a overview)
- Foundation: `../shared-foundation/requirements.md`
- Module spec: `docs/modules/trip-discovery/requirements.md`
- Method definition: `../../booking-methods.md` § 1 (M4d), § 5 (URL shape)
