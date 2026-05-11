# Tour Guide Booking — Architecture

> **Feature ID:** F33  
003e **Scope:** MVP

---

## Overview

The Tour Guide Booking module connects travelers with verified local guides. It extends the core booking engine with guide-specific availability and profile features.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Guide List  │  │ Guide       │  │ Guide Booking       │  │
│  │ (SSR/ISR)   │  │ Profile     │  │ Form                │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Booking Store (Zustand) — dates, guide, requests    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │ Guides          │  │ Booking Engine (my-trip module)     ││
│  │ Controller      │  │ — hold, confirmation, cancellation  ││
│  └────────┬────────┘  └─────────────────────────────────────┘│
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Guides Service                                      │    │
│  │ — availability, profile, search, verification       │    │
│  └─────────────────────────────────────────────────────┘    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │ PostgreSQL      │  │ Redis (booking holds)               ││
│  │ (guides,        │  │ TTL = 15 minutes                    ││
│  │  bookings)      │  │                                     ││
│  └─────────────────┘  └─────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## Verification Workflow

```
[Guide applies] ──> [Background check]
                         │
                    Passed?
                   /      \
                 Yes      No
                 /          \
                ▼            ▼
         [Set verified=true]  [Reject application]
         [Notify guide]         [Notify guide with reason]
```

---

## Availability Checking

Same pattern as transportation: check for overlapping `guide_bookings` with status in `(CONFIRMED, PENDING_PAYMENT, HOLD)`.

```sql
SELECT NOT EXISTS (
  SELECT 1 FROM guide_bookings gb
  JOIN bookings b ON gb.booking_id = b.id
  WHERE gb.guide_id = $1
    AND b.status IN ('CONFIRMED', 'PENDING_PAYMENT', 'HOLD')
    AND gb.start_date < $3
    AND gb.end_date > $2
) as is_available;
```

---

## Gender Filtering

The `gender` field supports inclusive values:
- `Male`
- `Female`
- `Other`
- `PreferNotToSay`

Filtering is opt-in; unselected shows all guides.

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
