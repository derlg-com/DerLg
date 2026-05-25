# Plan: M4c — Guide Booking

> **Sub-method:** M4c
> **Endpoint:** `POST /v1/guides/:guideId/bookings`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Status:** 🟡 Spec drafted, implementation not started
> **Prerequisite:** `../shared-foundation/` 🟢 Complete

This plan implements M4c only. The atomic commit, hold/idempotency/refund utilities, and the unified read/update/cancel surface come from `../shared-foundation/` and are not rebuilt here.

---

## Implementation order

| Group | Theme | Per-group gate |
|-------|-------|----------------|
| 1 | DTO + class-validator rules | Lint + type-check clean |
| 2 | `BookGuideUseCase` | Lint + type-check + skeleton compiles |
| 3 | Controller route + module wiring | `POST /v1/guides/:guideId/bookings` returns 201 on a valid payload |
| 4 | Error code additions + DTO smoke | `validation.md` smoke commands all pass |

---

## Group 1 — DTO

| # | File | Action | Notes |
|---|------|--------|-------|
| 1.1 | `specific-booking/dto/book-guide.dto.ts` | Create | Class-validator decorators; `endDate ≥ startDate`. |
| 1.2 | `specific-booking/dto/index.ts` | Modify | Export the new DTO. |

### DTO contents

```ts
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AfterDate } from '../../../common/validators/after-date.decorator';

export class BookGuideDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  @AfterDate('startDate', { allowSameDay: true })
  endDate!: string;

  @IsOptional()
  @IsUUID('4')
  linkedTripBookingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
```

`allowSameDay: true` because half-day-equivalent bookings (start === end) are valid (charged as 1 day per pricing rule).

---

## Group 2 — Use case

| # | File | Action |
|---|------|--------|
| 2.1 | `specific-booking/use-cases/book-guide.use-case.ts` | Create — see `requirements.md` § "Use case skeleton" |
| 2.2 | `specific-booking/use-cases/index.ts` | Modify — export the new use case |

### Implementation rules

1. Inject only `PrismaService` and `CommitBookingUseCase`.
2. Distinct errors for guide states: `GDE_NOT_FOUND` (404, missing/deleted), `GDE_INACTIVE` (403), `GDE_SUSPENDED` (403). Do **not** collapse to a single 404.
3. `linkedTripBookingId` validation lives in a private method (`validateLinkedTrip`) on the use case — keeps `execute()` readable.
4. Use the shared `generate-reference.util.ts` with kind `'GDE'`.
5. Compute `days = Math.max(1, Math.ceil((endDate - startDate) / 86_400_000))`.
6. Use `Prisma.Decimal` arithmetic.
7. Snapshot must match the shape in `requirements.md` exactly (no contact info — that's read-side).

---

## Group 3 — Controller route + module wiring

| # | File | Action |
|---|------|--------|
| 3.1 | `specific-booking/specific-booking.controller.ts` | Modify — add `@Post('guides/:guideId/bookings')` handler |
| 3.2 | `specific-booking/specific-booking.module.ts` | Modify — register `BookGuideUseCase` in `providers` |

### Controller handler

```ts
@Post('guides/:guideId/bookings')
guide(
  @CurrentUser() user: JwtPayload,
  @Param('guideId', ParseUUIDPipe) guideId: string,
  @Body() dto: BookGuideDto,
  @Headers('idempotency-key') key?: string,
) {
  return this.bookGuide.execute(user, guideId, dto, key);
}
```

---

## Group 4 — Error codes + DTO smoke

| # | File | Action |
|---|------|--------|
| 4.1 | `src/common/errors/error-codes.ts` | Modify — confirm/add `GDE_NOT_FOUND`, `GDE_INACTIVE`, `GDE_SUSPENDED`, `GDE_INVALID_TRIP_LINK` |
| 4.2 | `backend/context/specs/ERROR-REGISTRY.md` | Modify — same |
| 4.3 | `backend/context/specs/API-CONTRACT.md` § 11 | Modify — add request/response example for `POST /v1/guides/:guideId/bookings`, document `linkedTripBookingId` semantics |
| 4.4 | `validation.md` smoke commands | Run | All curl commands in this spec's `validation.md` succeed |

---

## Out of scope (do not build in this spec)

- Schema migrations (foundation owns)
- Hold key, idempotency, refund, reference generation (foundation owns)
- Guide contact reveal at 24h-before (read-side, in foundation)
- Half-day pricing
- Female-only / verified-only filtering (catalog endpoint, not booking)
- Guide payout / commission accounting (Phase 6+)
- Property tests, controller integration tests, E2E (deferred branch)

---

## File-count summary

| Bucket | Files |
|--------|-------|
| New | 1 DTO + 1 use case = **2** |
| Modified | 1 controller + 1 module + 1 DTO barrel + 1 use-case barrel + `error-codes.ts` + 2 doc files = **7** |

---

## Definition of Done

- [ ] `BookGuideDto` validates required fields and rejects `endDate < startDate` with `400 BKNG_INVALID_DATE_RANGE`
- [ ] `BookGuideUseCase` returns distinct errors for `INACTIVE` (403) and `SUSPENDED` (403) guides
- [ ] `linkedTripBookingId` validation rejects: missing booking (400), wrong owner (400), wrong booking type (400), out-of-range dates (400) — all with `GDE_INVALID_TRIP_LINK`
- [ ] `POST /v1/guides/:guideId/bookings` returns `201` with `Booking` (status `HOLD`, ref `GDE-XXXXXX`, exactly 1 `BookingItem` of type `GUIDE`)
- [ ] Two overlapping requests for the same `guideId` → second returns `409 BKNG_UNAVAILABLE`
- [ ] Same `Idempotency-Key` retried → identical response, no duplicate row
- [ ] `BookingItem.snapshot.linkedTripBookingId` is set when supplied, `null` otherwise
- [ ] `BookingItem.snapshot` does **not** contain phone or email (verified by inspecting the row)
- [ ] `ERROR-REGISTRY.md`, `API-CONTRACT.md` updated
- [ ] `validation.md` smoke commands all pass
