# My Trip — Booking Management — Requirements

> **Feature IDs:** F30, F34–F38  
> **Scope:** MVP (F38: v1.1)  
> **Priority:** P0

---

## User Stories

### F30 — Trip Package Booking

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F30-01 | As a traveler, I want to book a trip package so that I can secure my travel plans. | AC1: Booking initiated from trip detail page. AC2: Select date, number of travelers (adults/children), and optional add-ons (transport upgrade, hotel upgrade, guide). AC3: Price breakdown shown: base price × travelers + add-ons + taxes. AC4: Guest checkout supported (email required, no account needed). AC5: Booking reference format: `DLG-YYYY-NNNN`. AC6: Confirmation email sent within 30 seconds. |
| US-F30-02 | As a traveler, I want to see my booking summary before payment so that I can verify all details. | AC1: Pre-payment summary page shows: trip name, dates, travelers, selected options, total price, cancellation policy. AC2: Option to edit booking before proceeding to payment. AC3: Expiry countdown showing hold time remaining (15 minutes). |

### F34 — Availability & Conflict Detection

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F34-01 | As the system, I want to prevent double-booking so that inventory is protected. | AC1: Database transactions with pessimistic locking (`SELECT FOR UPDATE`) on inventory rows. AC2: Availability checked at booking creation AND at payment confirmation. AC3: If inventory changes between hold and payment, user is notified and offered alternatives. AC4: All booking types (trip, hotel, transport, guide) use the same conflict detection pattern. |

### F35 — Booking Hold (15-min reservation)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F35-01 | As a traveler, I want my selected items held while I complete payment so that they aren't taken by someone else. | AC1: On "Proceed to Payment", booking status set to `HOLD`. AC2: Redis TTL key created: `booking:hold:{id}` with 15-minute expiry. AC3: Inventory temporarily reduced during hold. AC4: If payment not received within 15 minutes, hold expires: status → `EXPIRED`, inventory released. AC5: User can extend hold once (extra 5 minutes) if payment is in progress. AC6: Expiry triggers automatic email: "Your reservation has expired." |

### F36 — Booking Confirmation & QR Check-in

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F36-01 | As a traveler, I want to receive a booking confirmation with a QR code so that I can check in easily. | AC1: On payment success, status → `CONFIRMED`. AC2: Unique booking reference generated: `DLG-2026-0042`. AC3: QR code generated (SVG/PNG) containing encrypted booking reference. AC4: QR scannable by partner/driver/guide mobile app. AC5: Confirmation page shows: reference, QR, trip details, contact info, cancellation policy. AC6: Shareable confirmation link with access token (no login required for viewing). |
| US-F36-02 | As a traveler, I want to access my booking details in the app so that I have all information in one place. | AC1: "My Trips" page lists all bookings: upcoming, past, cancelled. AC2: Each booking card shows: trip/activity name, dates, status, price. AC3: Tap to view full details with QR code, itinerary, contact info. AC4: Driver/guide contact revealed 24h before start date. |

### F37 — Cancellation & Refund Flow

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F37-01 | As a traveler, I want to cancel my booking so that I can get a refund if my plans change. | AC1: Cancellation button on booking detail page. AC2: Refund preview shown before confirmation: amount and timeline. AC3: Tiered refund policy: 100% if ≥7 days before, 50% if 1–7 days, 0% if <24 hours. AC4: Cancellation requires confirmation (modal with policy reminder). AC5: Status → `CANCELLED` on confirmation. AC6: Refund processed automatically to original payment method (Stripe) or manual for QR payments. AC7: Cancellation email sent with refund details. AC8: Loyalty points earned on booking reversed. |
| US-F37-02 | As the system, I want to handle partial refunds correctly so that financial records are accurate. | AC1: Refund amount recorded in `payments` table. AC2: Stripe refund idempotency key prevents duplicate refunds. AC3: Admin can override refund amount with reason (audit logged). |

### F38 — Booking Itinerary Management (v1.1)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F38-01 | As a traveler, I want to export my itinerary to my calendar so that I can stay organized. | AC1: "Add to Calendar" button generates iCal (.ics) file. AC2: iCal includes: trip name, dates, meeting point, contact info, notes. AC3: Works with Google Calendar, Apple Calendar, Outlook. AC4: Available from booking confirmation page and "My Trips" detail. |

---

## Data Model

### `bookings` Table (Core)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `reference` | VARCHAR(20) | UNIQUE, NOT NULL | `DLG-YYYY-NNNN` |
| `user_id` | UUID | FK → users | Nullable (guest checkout) |
| `guest_email` | VARCHAR(255) | | For guest checkout |
| `type` | VARCHAR(30) | NOT NULL | TRIP, HOTEL, TRANSPORT, GUIDE, COMBO |
| `status` | VARCHAR(30) | DEFAULT 'HOLD' | HOLD, PENDING_PAYMENT, CONFIRMED, CANCELLED, EXPIRED, COMPLETED |
| `total_price_usd` | DECIMAL(10,2) | NOT NULL | |
| `currency` | VARCHAR(3) | DEFAULT 'USD' | |
| `payment_status` | VARCHAR(30) | DEFAULT 'PENDING' | PENDING, PAID, PARTIALLY_REFUNDED, FULLY_REFUNDED |
| `cancelled_at` | TIMESTAMPTZ | | |
| `cancellation_reason` | TEXT | | |
| `refund_amount_usd` | DECIMAL(10,2) | DEFAULT 0 | |
| `hold_expires_at` | TIMESTAMPTZ | | 15 minutes from creation |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `booking_items` Table (Line Items)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `booking_id` | UUID | FK → bookings | |
| `item_type` | VARCHAR(30) | NOT NULL | TRIP, HOTEL, TRANSPORT, GUIDE |
| `item_id` | UUID | NOT NULL | Reference to trip/hotel/transport/guide |
| `name` | VARCHAR(255) | NOT NULL | Snapshot at booking time |
| `quantity` | INTEGER | DEFAULT 1 | Travelers, nights, days |
| `unit_price_usd` | DECIMAL(10,2) | NOT NULL | |
| `total_price_usd` | DECIMAL(10,2) | NOT NULL | |
| `metadata` | JSONB | | Dates, locations, special requests |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Booking Status Flow

```
[HOLD] ──15m timeout──▶ [EXPIRED]
   │
   │ Payment initiated
   ▼
[PENDING_PAYMENT] ──success──▶ [CONFIRMED]
   │                              │
   │ failed/cancelled             │ trip completed
   ▼                              ▼
[EXPIRED]                    [COMPLETED]
   │
   │ User cancellation
   ▼
[CANCELLED]
```

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `BOOKING_001` | 404 | Booking not found |
| `BOOKING_002` | 403 | Booking does not belong to user |
| `BOOKING_003` | 400 | Cannot cancel — within 24h of start |
| `BOOKING_004` | 409 | Hold expired |
| `BOOKING_005` | 400 | Invalid booking status transition |
| `BOOKING_006` | 409 | Item no longer available |

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 5–9, 11, 30).*
