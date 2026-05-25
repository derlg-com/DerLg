# Requirements: M4a — Transportation Booking

> **Sub-method:** M4a (Single-Resource — Transportation)
> **Resource:** `TransportationVehicle`
> **Endpoint:** `POST /v1/transportation/bookings`
> **Reference prefix:** `TRN-`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Date:** 2026-05-25

This spec details **only** what is different about booking a transportation vehicle. The atomic commit, hold, idempotency, refund tiers, status state machine, and the unified `GET / PATCH / cancel / qr / ical` endpoints are owned by the **shared foundation** spec (`../shared-foundation/`) and consumed here.

---

## Scope

### In scope

- `POST /v1/transportation/bookings` — single endpoint
- `BookTransportationDto` — request body validation
- `BookTransportationUseCase` — assembles `CommitInput` and delegates to `commit-booking.use-case.ts`
- Pricing logic for per-day **and** per-km vehicles (vehicle row decides)
- Pickup / dropoff / optional stops capture
- Distance estimation at booking time (used for per-km pricing)
- Snapshot fields for `BookingItem.snapshot` (vehicle label, type, capacity, plate suffix)
- Driver reveal **policy** at 24h-before (the read-side hides driver fields when `now < startDate - 24h`)

### Out of scope (handled elsewhere)

- The `commit-booking` atomic primitive — `../shared-foundation/`
- Hold key, idempotency, reference generation, refund tiers — `../shared-foundation/`
- The `GET /v1/bookings*` read/update/cancel/qr/ical surface — `../shared-foundation/`
- Driver assignment / dispatching — Phase 7 (driver portal)
- Distance API integration (Mapbox / Google Maps Matrix) — Phase 6+
- Real-time driver location — Phase 8
- Surge pricing / dynamic pricing — out of MVP
- Multi-vehicle bookings (one DTO that books a fleet) — never; one vehicle = one booking

---

## Endpoint

### `POST /v1/transportation/bookings`

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT (default-on `JwtAuthGuard`) |
| Idempotency-Key | Required — honored via `idempotency.util.ts` |
| Reference prefix | `TRN-` |
| `BookingItem` count | Exactly 1 (`itemType: TRANSPORTATION`) |
| Hold TTL | 900 s (shared default) |
| Response status | `201` with `Booking` in `HOLD` |

### Request body — `BookTransportationDto`

```ts
{
  vehicleId: string;          // uuid, required
  startDate: string;          // ISO date (YYYY-MM-DD), required
  endDate: string;            // ISO date, required, must be ≥ startDate
  pickupLocation: string;     // required, 1–500 chars
  dropoffLocation: string;    // required, 1–500 chars
  stops?: string[];           // optional, max 10 entries, each 1–500 chars
  estimatedDistanceKm?: number; // optional int ≥ 0, required if vehicle is per-km only
  specialRequests?: string;   // optional, max 1000 chars
}
```

### Response — `Booking` envelope

The response shape is the unified `Booking` DTO from `../shared-foundation/`. The `BookingItem.snapshot` field carries:

```ts
{
  vehicleId: string;
  label: string;              // e.g. "Comfort Van — Toyota HiAce"
  type: 'VAN' | 'PRIVATE_CAR' | 'TUK_TUK' | 'BUS';
  capacity: number;
  pricingModel: 'PER_DAY' | 'PER_KM' | 'PER_HALF_DAY';
  pickupLocation: string;
  dropoffLocation: string;
  stops: string[];            // [] if none
  estimatedDistanceKm: number | null;
  hasAc: boolean;
  hasWifi: boolean;
}
```

`driverId` is **not** in the snapshot. It is resolved at read time and gated by the 24h reveal policy (see § Driver Reveal).

---

## Pricing

The vehicle row carries `pricePerDayUsd` and/or `pricePerKmUsd` (one or both can be non-null per `docs/modules/transportation/requirements.md`). Pricing rule:

| Vehicle row | Computation |
|-------------|-------------|
| `pricePerDayUsd` non-null, `pricePerKmUsd` null | `pricePerDayUsd × days` (where `days = max(1, ceil((endDate - startDate) / 1day))`) |
| `pricePerKmUsd` non-null, `pricePerDayUsd` null | `pricePerKmUsd × estimatedDistanceKm` (DTO must include `estimatedDistanceKm`) |
| Both non-null | Use `pricePerDayUsd × days` by default; future enhancement may pick the cheaper path |

Edge case — **half-day tuk-tuk** (`docs/modules/transportation/requirements.md` "Pricing Models"): out of MVP scope. Tuk-tuk bookings pay full-day rate even for sub-day trips. Decision documented to revisit in Phase 6.

---

## Availability check

Single-resource overlap (the shared `check-overlap.util.ts` predicate). A vehicle is **one** physical resource — two overlapping bookings on the same `vehicleId` is a conflict, full stop. No counting, no inventory pool.

Inside `commit-booking`'s transaction:

```sql
-- Conflict if any existing BookingItem on this vehicleId overlaps the requested range
SELECT 1 FROM booking_items bi
JOIN bookings b ON b.id = bi.booking_id
WHERE bi.resource_id = :vehicleId
  AND bi.item_type = 'TRANSPORTATION'
  AND b.status IN ('HOLD', 'PENDING_PAYMENT', 'CONFIRMED')
  AND b.deleted_at IS NULL
  AND bi.start_date < :endDate
  AND bi.end_date > :startDate
```

If any row returns → throw `409 BKNG_UNAVAILABLE`.

---

## Driver Reveal Policy

The frontend should never see `driverId`, driver name, contact, or vehicle plate **before** `startDate - 24h`. The read-side use case (`get-booking-detail.use-case.ts` in shared foundation) is responsible for redaction; this spec only documents the rule:

| Time relative to startDate | Fields visible in `Booking.driver` |
|----------------------------|-------------------------------------|
| `> 24h before startDate` | `null` (entire object hidden) |
| `≤ 24h before startDate` and not yet started | `{ name, phone, vehiclePlateSuffix }` (full reveal) |
| Past `endDate` | Same as ≤ 24h |

The rule is enforced in the **read** path and does not affect this booking creation endpoint. M4a creation simply persists the booking — driver assignment happens later (Phase 7).

---

## Validation Errors

| Code | HTTP | Trigger |
|------|------|---------|
| `BKNG_INVALID_DATE_RANGE` | 400 | `endDate < startDate` |
| `TRNS_NOT_FOUND` | 404 | Vehicle doesn't exist, soft-deleted, or `status ≠ ACTIVE` |
| `TRNS_PRICING_REQUIRES_DISTANCE` | 400 | Vehicle is per-km only and `estimatedDistanceKm` missing |
| `BKNG_UNAVAILABLE` | 409 | Overlap with existing HOLD / PENDING_PAYMENT / CONFIRMED booking |
| `BKNG_INVALID_INPUT` | 400 | DTO validation fails (class-validator) |

`TRNS_PRICING_REQUIRES_DISTANCE` is **new** — must be added to `ERROR-REGISTRY.md` and `error-codes.ts`.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Pickup, dropoff are NOT NULL on the DTO.** | `transportation_bookings.pickup_location` and `dropoff_location` are NOT NULL in `docs/modules/transportation/requirements.md`. Driver dispatch requires these. |
| 2 | **`stops[]` is captured at booking time, not editable mid-trip.** | Drivers need a fixed itinerary for routing. Mid-trip changes are a Phase 7 concern. |
| 3 | **Distance estimate (`estimatedDistanceKm`) is the user's responsibility for now.** | No Mapbox integration in 5a. Frontend can compute from selected pickup/dropoff via its own map SDK. Backend just stores what it's told. |
| 4 | **Driver reveal at 24h is enforced in the read-side, not at creation.** | Creation has no driver assigned yet. Reveal is a presentation rule on the unified `GET /v1/bookings/:id`. |
| 5 | **Half-day tuk-tuk pricing deferred.** | Module doc lists `$15 half-day, $25 full-day` for tuk-tuk. M4a charges full-day for any tuk-tuk booking in MVP. Documented as a Phase 6 revisit. |
| 6 | **One vehicle per booking.** | If a customer needs two tuk-tuks they make two bookings. The `BookingItem` table supports multi-resource — that's M1/M2/M3 territory, not M4. |
| 7 | **No `linkedTripBookingId`.** | Unlike M4c (guide), there's no documented use case for linking a transportation booking to a trip booking. If needed later, the `BookingItem.snapshot` JSON can carry it without a schema change. |

---

## Use case skeleton

```ts
@Injectable()
export class BookTransportationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    dto: BookTransportationDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    // 1. Validate dates
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException({ code: ErrorCode.BKNG_INVALID_DATE_RANGE });
    }

    // 2. Fetch vehicle
    const vehicle = await this.prisma.transportationVehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!vehicle) throw new NotFoundException({ code: ErrorCode.TRNS_NOT_FOUND });

    // 3. Resolve pricing
    const days = computeDays(dto.startDate, dto.endDate);
    let unitPrice: Decimal;
    let pricingModel: 'PER_DAY' | 'PER_KM';
    if (vehicle.pricePerDayUsd) {
      unitPrice = vehicle.pricePerDayUsd;
      pricingModel = 'PER_DAY';
    } else if (vehicle.pricePerKmUsd) {
      if (!dto.estimatedDistanceKm) {
        throw new BadRequestException({ code: ErrorCode.TRNS_PRICING_REQUIRES_DISTANCE });
      }
      unitPrice = vehicle.pricePerKmUsd;
      pricingModel = 'PER_KM';
    } else {
      throw new InternalServerErrorException({ code: ErrorCode.TRNS_PRICING_MISCONFIGURED });
    }

    const subtotal = pricingModel === 'PER_DAY'
      ? unitPrice.times(days)
      : unitPrice.times(dto.estimatedDistanceKm!);

    // 4. Build CommitInput
    const input: CommitInput = {
      userId: user.sub,
      reference: generateReference('TRN'),
      totalPriceUsd: subtotal,
      items: [{
        type: 'TRANSPORTATION',
        resourceId: vehicle.id,
        startDate: dto.startDate,
        endDate: dto.endDate,
        quantity: pricingModel === 'PER_DAY' ? days : dto.estimatedDistanceKm!,
        unitPriceUsd: unitPrice,
        subtotalUsd: subtotal,
        snapshot: {
          vehicleId: vehicle.id,
          label: vehicle.name,
          type: vehicle.type,
          capacity: vehicle.capacity,
          pricingModel,
          pickupLocation: dto.pickupLocation,
          dropoffLocation: dto.dropoffLocation,
          stops: dto.stops ?? [],
          estimatedDistanceKm: dto.estimatedDistanceKm ?? null,
          hasAc: vehicle.hasAc,
          hasWifi: vehicle.hasWifi,
        },
      }],
      metadata: {
        method: 'SINGLE_RESOURCE',
        singleResourceKind: 'TRANSPORTATION',
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
| `../shared-foundation/` | Must land before this spec | `commit-booking.use-case.ts`, `generate-reference.util.ts` (with `TRN` kind), `BookingItem` schema, `Booking.method`/`singleResourceKind` columns |
| Phase 4 — `TransportationVehicle` model | 🟢 Complete | Source of truth for vehicle + pricing + status |
| `ERROR-REGISTRY.md` update | This spec | Add `TRNS_PRICING_REQUIRES_DISTANCE`, `TRNS_PRICING_MISCONFIGURED` |

---

## References

- Parent: `../requirements.md` (Phase 5a overview)
- Foundation: `../shared-foundation/requirements.md`
- Module spec: `docs/modules/transportation/requirements.md`
- API contract: `docs/modules/transportation/api.yaml`
- Method definition: `../../booking-methods.md` § 1 (M4a)
