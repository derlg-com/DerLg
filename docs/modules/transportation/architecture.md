# Transportation Booking — Architecture

> **Feature ID:** F32  
> **Scope:** MVP

---

## Overview

The Transportation module handles vehicle inventory, availability checking, and booking creation for ground transport. It is a specialized booking type that shares the core booking engine (see `my-trip` module) but has vehicle-specific availability logic.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Vehicle     │  │ Vehicle     │  │ Booking Form        │  │
│  │ List        │  │ Detail      │  │ (dates, route)      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Booking Store (Zustand) — dates, vehicle, route     │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │ Transportation  │  │ Booking Engine (my-trip module)     ││
│  │ Controller      │  │ — hold, confirmation, cancellation  ││
│  └────────┬────────┘  └─────────────────────────────────────┘│
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Transportation Service                              │    │
│  │ — availability check, pricing, conflict detection   │    │
│  └─────────────────────────────────────────────────────┘    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │ PostgreSQL      │  │ Redis (booking holds)               ││
│  │ (vehicles,      │  │ TTL = 15 minutes                    ││
│  │  bookings)      │  │                                     ││
│  └─────────────────┘  └─────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## Availability Checking

### Algorithm

```sql
-- Check if vehicle is available for date range
SELECT NOT EXISTS (
  SELECT 1 FROM transportation_bookings tb
  JOIN bookings b ON tb.booking_id = b.id
  WHERE tb.vehicle_id = $1
    AND b.status IN ('CONFIRMED', 'PENDING_PAYMENT', 'HOLD')
    AND tb.start_date < $3  -- new end_date
    AND tb.end_date > $2     -- new start_date
) as is_available;
```

### Booking Hold Flow

```
[User selects vehicle + dates] ──> [Check availability]
                                        │
                                   Available?
                                  /         \
                                Yes          No
                                /              \
                               ▼                ▼
                    [Create booking HOLD]    [Return 409]
                    [Redis TTL = 15 min]
                    [Return booking reference]
                               │
                               ▼
                    [User proceeds to payment]
                               │
                               ▼
                    [Payment confirmed]
                               │
                               ▼
                    [Status: CONFIRMED]
                    [Delete Redis hold key]
```

---

## Pricing Calculation

```typescript
function calculateTransportPrice(
  vehicle: TransportationVehicle,
  startDate: Date,
  endDate: Date,
  distanceKm?: number
): number {
  const days = differenceInDays(endDate, startDate) + 1;

  if (vehicle.price_per_day_usd) {
    return days * vehicle.price_per_day_usd;
  }

  if (vehicle.price_per_km_usd && distanceKm) {
    return distanceKm * vehicle.price_per_km_usd;
  }

  throw new Error('Vehicle has no pricing model configured');
}
```

---

## Driver Assignment

- Driver information (`driver_id`, `driver_name`, `driver_phone`, `vehicle_plate`) is **not revealed** until 24 hours before `start_date`.
- This is enforced at the API level: `GET /v1/bookings/:id` returns `driver: null` until the reveal window.
- A scheduled job (or Redis keyspace notification) triggers the reveal.

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
