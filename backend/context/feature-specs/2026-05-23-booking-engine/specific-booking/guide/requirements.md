# Requirements: M4c — Guide Booking

> **Sub-method:** M4c (Single-Resource — Guide)
> **Resource:** `Guide`
> **Endpoint:** `POST /v1/guides/:guideId/bookings`
> **Reference prefix:** `GDE-`
> **Branch:** `feature/2026-05-23-booking-engine`
> **Phase:** 5a — Specific Booking
> **Date:** 2026-05-25

This spec details **only** what is different about booking a tour guide. The atomic commit, hold, idempotency, refund tiers, status state machine, and the unified `GET / PATCH / cancel / qr / ical` endpoints are owned by the **shared foundation** spec (`../shared-foundation/`) and consumed here.

A guide is a **single physical person** — like a vehicle, two overlapping bookings of the same `guideId` is a hard conflict (no inventory pool). Availability is the same interval-overlap predicate as M4a.

---

## Scope

### In scope

- `POST /v1/guides/:guideId/bookings` — single endpoint
- `BookGuideDto` — request body validation
- `BookGuideUseCase` — assembles `CommitInput` and delegates to `commit-booking.use-case.ts`
- Pricing: `pricePerDayUsd × days`
- Optional `linkedTripBookingId` — soft FK to a sibling trip booking (documented MVP capability)
- Snapshot fields for `BookingItem.snapshot` (guide name, languages, specialties, primary location)
- Guide status validation (`ACTIVE` only — `INACTIVE` and `SUSPENDED` blocked with distinct errors)
- Contact reveal **policy** at 24h-before (read-side concern, documented here)

### Out of scope (handled elsewhere)

- The `commit-booking` atomic primitive — `../shared-foundation/`
- Hold key, idempotency, reference generation, refund tiers — `../shared-foundation/`
- The `GET /v1/bookings*` read/update/cancel/qr/ical surface — `../shared-foundation/`
- Half-day vs full-day pricing — Phase 6 (MVP charges full day for any booking)
- Female-only / verified-only filtering at booking time — handled by the catalog listing, not the booking endpoint
- Guide-app / partner portal — Phase 11
- Guide payout / commission accounting — Phase 6+

---

## Endpoint

### `POST /v1/guides/:guideId/bookings`

| Concern | Value |
|---------|-------|
| Auth | Bearer JWT (default-on `JwtAuthGuard`) |
| Idempotency-Key | Required |
| Reference prefix | `GDE-` |
| `BookingItem` count | Exactly 1 (`itemType: GUIDE`) |
| Hold TTL | 900 s (shared default) |
| Response status | `201` with `Booking` in `HOLD` |

### Request body — `BookGuideDto`

```ts
{
  startDate: string;           // ISO date (YYYY-MM-DD), required
  endDate: string;             // ISO date, required, must be ≥ startDate
  linkedTripBookingId?: string;  // uuid, optional — must belong to same user, status HOLD/PENDING_PAYMENT/CONFIRMED
  specialRequests?: string;    // optional, max 1000 chars (dietary, accessibility, interests)
}
```

`guideId` comes from the URL path parameter, not the body.

### Response — `Booking` envelope

`BookingItem.snapshot` carries:

```ts
{
  guideId: string;
  name: string;                    // e.g. "Sothea Pich"
  languages: string[];             // ['EN', 'ZH']
  specialties: string[];           // ['Temples', 'History']
  location: string;                // primary province
  gender: string | null;
  experienceYears: number | null;
  isVerified: boolean;
  pricePerDayUsd: number;
  days: number;
  linkedTripBookingId: string | null;
}
```

Guide contact (phone, email) is **not** in the snapshot. Same 24h-reveal rule as M4a's driver:

| Time relative to startDate | Fields visible |
|----------------------------|----------------|
| `> 24h before startDate` | `null` |
| `≤ 24h before startDate` and not yet ended | `{ phone, email }` returned by read-side |
| Past `endDate` | Same as ≤ 24h |

The reveal is enforced in `get-booking-detail.use-case.ts` (foundation), not in this creation endpoint.

---

## Pricing

| Quantity | Computation |
|----------|-------------|
| `days` | `max(1, ceil((endDate - startDate) / 1day))` — same-day = 1 day |
| `unitPriceUsd` | `guide.pricePerDayUsd` (current value at booking time) |
| `subtotalUsd` | `unitPriceUsd × days` |
| `totalPriceUsd` | `subtotalUsd` |

No half-day pricing in MVP — a 4-hour booking pays a full day. Documented as a Phase 6 enhancement that would require a `pricingUnit: 'DAY' | 'HALF_DAY'` field on `Guide`.

---

## Availability check

Single-resource overlap. A guide can only be in one place at a time — two overlapping bookings on the same `guideId` is a conflict.

The shared `check-overlap.util.ts` is used inside `commit-booking`'s transaction. M4c does **not** introduce any new availability primitive (unlike M4b).

---

## `linkedTripBookingId` validation

When provided, the use case must verify:

1. The linked booking exists, is owned by the same `user.sub`, and is `HOLD | PENDING_PAYMENT | CONFIRMED` (not `CANCELLED | EXPIRED`).
2. The linked booking's `singleResourceKind` is `TRIP` **OR** the linked booking's `method` is `PUBLIC_PACKAGE | PRIVATE_PREBUILT | BUILD_FROM_SCRATCH` (a composed trip).
3. Date range is **contained** within the linked booking's date range — guide dates must satisfy `linkedBooking.startDate ≤ guide.startDate AND linkedBooking.endDate ≥ guide.endDate`.

If any check fails, throw `400 GDE_INVALID_TRIP_LINK` with a message describing which check.

The link is **soft** — stored only in `BookingItem.snapshot.linkedTripBookingId`, not as a foreign key. This avoids cascading-cancel headaches (Phase 11 admin-cancel decides what happens when a linked trip is cancelled).

---

## Validation Errors

| Code | HTTP | Trigger |
|------|------|---------|
| `BKNG_INVALID_DATE_RANGE` | 400 | `endDate < startDate` |
| `GDE_NOT_FOUND` | 404 | Guide doesn't exist or is soft-deleted |
| `GDE_INACTIVE` | 403 | Guide `status: INACTIVE` |
| `GDE_SUSPENDED` | 403 | Guide `status: SUSPENDED` |
| `GDE_INVALID_TRIP_LINK` | 400 | `linkedTripBookingId` fails any of the three checks above |
| `BKNG_UNAVAILABLE` | 409 | Overlap with existing HOLD / PENDING_PAYMENT / CONFIRMED guide booking |
| `BKNG_INVALID_INPUT` | 400 | DTO validation fails |

`GDE_INACTIVE`, `GDE_SUSPENDED`, and `GDE_INVALID_TRIP_LINK` may need to be added to `ERROR-REGISTRY.md`.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Two distinct errors for `INACTIVE` vs `SUSPENDED`.** | Customer support workflow differs — `INACTIVE` is a permanent retirement (offer alternative guides); `SUSPENDED` is temporary (try again next week). Module spec lists both as separate states. |
| 2 | **`linkedTripBookingId` is a documented MVP capability.** | `docs/modules/tour-guide/requirements.md US-F33-03 AC2` calls it out: "link to an existing trip booking or book standalone." Skipping it would drop a documented feature. |
| 3 | **Link is stored in snapshot, not as a foreign key.** | Forward-compatible — the link is informational, used at read time to surface "this guide is part of your Angkor Trip." No cascading rules needed in 5a. |
| 4 | **Date containment for linked trip — strict.** | A guide booking that extends past the linked trip is meaningless. If the user wants a longer guide engagement, they can book the guide standalone. |
| 5 | **No half-day pricing in MVP.** | Module doc lists `price_per_day_usd` only; half/full-day is industry norm but not in the schema. Phase 6 schema change. |
| 6 | **Contact reveal at 24h enforced in read-side, not creation.** | Same pattern as M4a driver. Booking creation simply persists the booking. |
| 7 | **No verified-only / female-only filter at booking time.** | Filtering happens on the catalog listing endpoint. Once the user has chosen a `guideId`, that's their explicit choice. Booking honours it. |
| 8 | **Special requests max 1000 chars.** | Industry-typical free-text field. Larger payloads (>1KB) are signs of misuse — block at validation. |

---

## Use case skeleton

```ts
@Injectable()
export class BookGuideUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    guideId: string,
    dto: BookGuideDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    // 1. Validate dates
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException({ code: ErrorCode.BKNG_INVALID_DATE_RANGE });
    }

    // 2. Fetch guide
    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId, deletedAt: null },
    });
    if (!guide) throw new NotFoundException({ code: ErrorCode.GDE_NOT_FOUND });
    if (guide.status === 'INACTIVE') throw new ForbiddenException({ code: ErrorCode.GDE_INACTIVE });
    if (guide.status === 'SUSPENDED') throw new ForbiddenException({ code: ErrorCode.GDE_SUSPENDED });

    // 3. If linked trip booking provided, validate it
    if (dto.linkedTripBookingId) {
      await this.validateLinkedTrip(user, dto);
    }

    // 4. Compute price
    const days = computeDays(dto.startDate, dto.endDate);
    const subtotal = guide.pricePerDayUsd.times(days);

    // 5. Build CommitInput
    const input: CommitInput = {
      userId: user.sub,
      reference: generateReference('GDE'),
      totalPriceUsd: subtotal,
      items: [{
        type: 'GUIDE',
        resourceId: guide.id,
        startDate: dto.startDate,
        endDate: dto.endDate,
        quantity: days,
        unitPriceUsd: guide.pricePerDayUsd,
        subtotalUsd: subtotal,
        snapshot: {
          guideId: guide.id,
          name: guide.name,
          languages: guide.languages,
          specialties: guide.specialties,
          location: guide.location,
          gender: guide.gender,
          experienceYears: guide.experienceYears,
          isVerified: guide.isVerified,
          pricePerDayUsd: guide.pricePerDayUsd.toNumber(),
          days,
          linkedTripBookingId: dto.linkedTripBookingId ?? null,
        },
      }],
      metadata: {
        method: 'SINGLE_RESOURCE',
        singleResourceKind: 'GUIDE',
      },
    };

    return this.commitBooking.execute(user, input, idempotencyKey);
  }

  private async validateLinkedTrip(user: JwtPayload, dto: BookGuideDto): Promise<void> {
    const linked = await this.prisma.booking.findFirst({
      where: {
        id: dto.linkedTripBookingId,
        userId: user.sub,
        deletedAt: null,
        status: { in: ['HOLD', 'PENDING_PAYMENT', 'CONFIRMED'] },
      },
      include: { items: true },
    });
    if (!linked) {
      throw new BadRequestException({
        code: ErrorCode.GDE_INVALID_TRIP_LINK,
        message: 'Linked trip booking not found or not owned by user',
      });
    }
    const isTripBooking =
      linked.singleResourceKind === 'TRIP' ||
      ['PUBLIC_PACKAGE', 'PRIVATE_PREBUILT', 'BUILD_FROM_SCRATCH'].includes(linked.method);
    if (!isTripBooking) {
      throw new BadRequestException({
        code: ErrorCode.GDE_INVALID_TRIP_LINK,
        message: 'Linked booking is not a trip booking',
      });
    }
    // Date containment — guide range must fit inside linked booking range
    const linkedStart = linked.items[0].startDate;
    const linkedEnd = linked.items[linked.items.length - 1].endDate;
    if (new Date(dto.startDate) < linkedStart || new Date(dto.endDate) > linkedEnd) {
      throw new BadRequestException({
        code: ErrorCode.GDE_INVALID_TRIP_LINK,
        message: 'Guide dates must fall within linked trip dates',
      });
    }
  }
}
```

---

## Dependencies

| Prerequisite | Status | Used for |
|--------------|--------|----------|
| `../shared-foundation/` | Must land first | `commit-booking.use-case.ts`, `check-overlap.util.ts`, `generate-reference.util.ts` (kind `GDE`) |
| Phase 4 — `Guide` model | 🟢 Complete | `pricePerDayUsd`, `status`, `languages`, `specialties`, `location` |
| `ERROR-REGISTRY.md` update | This spec | Add `GDE_INACTIVE`, `GDE_SUSPENDED`, `GDE_INVALID_TRIP_LINK` if missing |

---

## References

- Parent: `../requirements.md` (Phase 5a overview)
- Foundation: `../shared-foundation/requirements.md`
- Module spec: `docs/modules/tour-guide/requirements.md`
- API contract: `docs/modules/tour-guide/api.yaml`
- Method definition: `../../booking-methods.md` § 1 (M4c)
