# Plan: M4a — Transportation Booking

> **Sub-method:** M4a
> **Endpoint:** `POST /v1/transportation/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Status:** 🟡 Spec drafted, implementation not started
> **Prerequisite:** `../shared-foundation/` must be 🟢 Complete

This plan implements M4a only. Schema changes, the atomic commit primitive, hold/idempotency/refund utilities, and the unified read/update/cancel surface come from `../shared-foundation/` and are **not** rebuilt here.

---

## Implementation order

| Group | Theme | Per-group gate |
|-------|-------|----------------|
| 1 | DTO + class-validator rules | Lint + type-check clean |
| 2 | `BookTransportationUseCase` | Lint + type-check + skeleton compiles |
| 3 | Controller route + module wiring | `POST /v1/transportation/bookings` returns 201 on a valid payload |
| 4 | Error code additions + DTO smoke | `validation.md` smoke commands all pass |

---

## Group 1 — DTO

| # | File | Action | Notes |
|---|------|--------|-------|
| 1.1 | `specific-booking/dto/book-transportation.dto.ts` | Create | Class-validator decorators for every field; custom `@AfterDate('startDate')` for `endDate`. |
| 1.2 | `specific-booking/dto/index.ts` | Modify | Export the new DTO. |

### DTO contents

```ts
import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { AfterDate } from '../../../common/validators/after-date.decorator';

export class BookTransportationDto {
  @IsUUID('4')
  vehicleId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @AfterDate('startDate', { allowSameDay: true })
  endDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  pickupLocation!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  dropoffLocation!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  stops?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDistanceKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
```

### `@AfterDate` decorator

If `../../../common/validators/after-date.decorator.ts` does not exist, create it as part of `../shared-foundation/`. Do not duplicate the file in M4a.

---

## Group 2 — Use case

| # | File | Action |
|---|------|--------|
| 2.1 | `specific-booking/use-cases/book-transportation.use-case.ts` | Create — see `requirements.md` § "Use case skeleton" |
| 2.2 | `specific-booking/use-cases/index.ts` | Modify — export the new use case |

### Implementation rules

1. Inject only `PrismaService` and `CommitBookingUseCase`. No service-layer.
2. Public surface = `execute()`. No helpers exposed.
3. Errors thrown via Nest exceptions with `{ code: ErrorCode.X }` shape.
4. Use the shared `generate-reference.util.ts` with kind `'TRN'`.
5. Use `Prisma.Decimal` arithmetic — never `Number`.
6. Compute `days = Math.max(1, Math.ceil((endDate - startDate) / 86_400_000))`. Treat same-day as 1 day.
7. The snapshot object must match the shape in `requirements.md` § "Response — `Booking` envelope" exactly.

### Pricing decision matrix (in code)

```ts
if (vehicle.pricePerDayUsd) {
  // PER_DAY path
} else if (vehicle.pricePerKmUsd) {
  // PER_KM path — requires dto.estimatedDistanceKm
} else {
  // misconfigured row — should never happen if Phase 4 catalog DTOs reject this
}
```

---

## Group 3 — Controller route + module wiring

| # | File | Action |
|---|------|--------|
| 3.1 | `specific-booking/specific-booking.controller.ts` | Modify — add `@Post('transportation/bookings')` handler |
| 3.2 | `specific-booking/specific-booking.module.ts` | Modify — register `BookTransportationUseCase` in `providers` |

### Controller handler

```ts
@Post('transportation/bookings')
transportation(
  @CurrentUser() user: JwtPayload,
  @Body() dto: BookTransportationDto,
  @Headers('idempotency-key') key?: string,
) {
  return this.bookTransportation.execute(user, dto, key);
}
```

The controller is shared across all four M4 endpoints (per `../plan.md`). Only add the route — do not create a per-resource controller.

---

## Group 4 — Error codes + DTO smoke

| # | File | Action |
|---|------|--------|
| 4.1 | `src/common/errors/error-codes.ts` | Modify — add `TRNS_PRICING_REQUIRES_DISTANCE` (400) and `TRNS_PRICING_MISCONFIGURED` (500) |
| 4.2 | `backend/context/specs/ERROR-REGISTRY.md` | Modify — add the two new codes with descriptions |
| 4.3 | `backend/context/specs/API-CONTRACT.md` § 11 | Modify — add request/response example for `POST /v1/transportation/bookings` |
| 4.4 | `validation.md` smoke commands | Run | All curl commands in this spec's `validation.md` succeed |

---

## Out of scope (do not build in this spec)

- Schema migrations (foundation owns)
- Hold key set/release (foundation owns)
- Idempotency lookup/store (foundation owns)
- The `BookingItem.snapshot` type definition (foundation owns)
- Driver assignment / driver-reveal-at-24h logic (read-side, in foundation)
- Distance API integration
- Half-day pricing paths
- Property tests, controller integration tests, E2E (deferred branch — same as foundation)

---

## File-count summary

| Bucket | Files |
|--------|-------|
| New | 1 DTO + 1 use case = **2** |
| Modified | 1 controller + 1 module + 1 DTO barrel + 1 use-case barrel + `error-codes.ts` + 2 doc files = **7** |

---

## Definition of Done

- [ ] `BookTransportationDto` validates all required fields and rejects invalid date ranges with `400 BKNG_INVALID_DATE_RANGE`
- [ ] `BookTransportationUseCase` correctly resolves per-day vs per-km pricing and throws `TRNS_PRICING_REQUIRES_DISTANCE` when needed
- [ ] `POST /v1/transportation/bookings` returns `201` with `Booking` (status `HOLD`, ref `TRN-XXXXXX`, exactly 1 `BookingItem` of type `TRANSPORTATION`)
- [ ] Two overlapping requests for the same `vehicleId` → second returns `409 BKNG_UNAVAILABLE`
- [ ] Same `Idempotency-Key` retried → identical response, no duplicate row
- [ ] `BookingItem.snapshot` matches the shape in `requirements.md`
- [ ] `ERROR-REGISTRY.md`, `API-CONTRACT.md` updated
- [ ] `validation.md` smoke commands all pass
