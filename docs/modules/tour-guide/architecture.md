# Tour Guide Booking — Architecture

> **Feature ID:** F33  
> **Scope:** MVP

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
│  │ Booking Store (Zustand) — dates, guide, requests    │  │
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

## NFRs

| Metric | Target | Implementation |
|--------|--------|----------------|
| Guide list response time | < 300ms | Indexed query on `status = ACTIVE`, cached 5 min |
| Guide detail response time | < 200ms | Single-row lookup by UUID, cached 5 min |
| Availability check SLA | < 200ms | Indexed overlap query on `guide_bookings` |
| Booking creation SLA | < 500ms | Atomic insert + Redis hold |
| List cache TTL | 300s | CDN + Redis |
| Overbooking protection | 100% | Database-level exclusion + HOLD status check |
| Concurrent booking lock | Pessimistic | `SELECT FOR UPDATE` on `guides` row during booking creation |
| Booking hold TTL | 900s (15 min) | Redis TTL; auto-expire via scheduled job |

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

## Operation Flow

### End-to-End: Book a Guide

```
1. GET /guides
   → Browse guide cards with filters (language, specialty, gender, verified)

2. GET /guides/{id}
   → View full profile: bio, gallery, reviews, price, experience

3. GET /guides/{id}/availability?start_date=...&end_date=...
   → Check real-time availability and get price estimate

4. POST /guides/{guideId}/bookings
   → Create booking with hold (15 min TTL)
   → Status: HOLD

5. [User completes payment via /payments module]
   → Payment intent created → Stripe webhook → booking status CONFIRMED

6. GET /guides/{guideId}/bookings/{bookingId}
   → View booking details; guide contact revealed 24h before start_date
```

### Cancellation Flow

```
1. POST /guides/{guideId}/bookings/{bookingId}/cancel
   → Cancel booking; refund calculated based on cancellation policy
   → Status: CANCELLED
```

---

## Production Standards

### Rate Limiting
- Guide list: 100 req/min per IP
- Availability check: 30 req/min per IP
- Booking creation: 5 req/min per user

### Idempotency
- `POST /guides/{guideId}/bookings` requires `Idempotency-Key` header
- `PATCH /guides/{guideId}/bookings/{bookingId}` requires `Idempotency-Key` header
- `POST /guides/{guideId}/bookings/{bookingId}/cancel` requires `Idempotency-Key` header

### Conflict Detection & Calendar Sync
- Availability uses pessimistic locking (`SELECT FOR UPDATE`) during booking creation
- Overlapping date ranges are blocked at the database level
- Calendar sync with external calendars (Google Calendar, Outlook) is planned for v1.2

### Observability
- Metrics: `guide_search_latency`, `availability_check_latency`, `booking_creation_latency`
- Alerts: P95 availability check > 200ms, booking creation error rate > 1%
- Logging: All booking state changes logged with `booking_id`, `guide_id`, `user_id`

### Error Handling
- GUIDE_001 (404): Guide not found
- GUIDE_002 (409): Guide not available for selected dates
- GUIDE_003 (400): Invalid date range
- GUIDE_004 (403): Guide is suspended or inactive
- GUIDE_005 (400): Cannot modify confirmed booking
- GUIDE_006 (400): Cancellation within non-refundable window

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
