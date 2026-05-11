# Hotel Booking — Architecture

> **Feature ID:** F31  
003e **Scope:** MVP

---

## Overview

The Hotel Booking module manages accommodation inventory, room availability per night, and reservation creation. It extends the core booking engine with room-specific availability logic.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Hotel List  │  │ Hotel Detail│  │ Room Booking        │  │
│  │ (SSR/ISR)   │  │ (SSR)       │  │ Form                │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Booking Store (Zustand) — dates, guests, room       │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │ Hotels          │  │ Booking Engine (my-trip module)     ││
│  │ Controller      │  │ — hold, confirmation, cancellation  ││
│  └────────┬────────┘  └─────────────────────────────────────┘│
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Hotels Service                                      │    │
│  │ — availability per night, pricing, conflict detect  │    │
│  └─────────────────────────────────────────────────────┘    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │ PostgreSQL      │  │ Redis (booking holds)               ││
│  │ (hotels, rooms, │  │ TTL = 15 minutes                    ││
│  │  bookings)      │  │                                     ││
│  └─────────────────┘  └─────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## Availability Checking

### Per-Night Availability Query

```sql
WITH date_range AS (
  SELECT generate_series($2::date, $3::date - 1, '1 day'::interval)::date AS night
),
booked_nights AS (
  SELECT 
    generate_series(check_in_date, check_out_date - 1, '1 day'::interval)::date AS night,
    COUNT(*) as booked_count
  FROM hotel_bookings hb
  JOIN bookings b ON hb.booking_id = b.id
  WHERE hb.room_id = $1
    AND b.status IN ('CONFIRMED', 'PENDING_PAYMENT', 'HOLD')
  GROUP BY night
)
SELECT 
  d.night,
  COALESCE(bn.booked_count, 0) as booked,
  r.total_rooms - COALESCE(bn.booked_count, 0) as available
FROM date_range d
CROSS JOIN hotel_rooms r
LEFT JOIN booked_nights bn ON d.night = bn.night
WHERE r.id = $1
ORDER BY d.night;
```

### Booking Hold Flow

```
[User selects room + dates + guests] ──> [Validate occupancy]
                                              │
                                         Valid?
                                        /      \
                                      Yes       No
                                      /          \
                                     ▼            ▼
                              [Check availability]  [Return 400]
                                     │
                                Available?
                               /          \
                             Yes           No
                             /              \
                            ▼                ▼
                     [Create HOLD]        [Return 409]
                     [Redis TTL = 15m]
                            │
                            ▼
                     [Proceed to payment]
```

---

## Pricing Calculation

```typescript
function calculateHotelPrice(
  room: HotelRoom,
  checkIn: Date,
  checkOut: Date,
  adults: number,
  children: number
): number {
  const nights = differenceInDays(checkOut, checkIn);
  const basePrice = nights * room.price_per_night_usd;
  // Additional guest fees if applicable
  // Taxes calculated at payment stage
  return basePrice;
}
```

---

## Calendar Widget Data

The availability endpoint returns per-night availability for a 3-month window:

```json
{
  "2026-06-01": { "available": 5, "price": 45.00 },
  "2026-06-02": { "available": 3, "price": 45.00 },
  "2026-06-03": { "available": 0, "price": 45.00 }
}
```

This is cached per room for 1 hour.

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
