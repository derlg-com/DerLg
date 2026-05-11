# Loyalty & Bonus Points — Requirements

> **Feature IDs:** F60–F61
> **Scope:** v1.1
> **Priority:** P1

---

## User Stories

### F60 — Loyalty Points Earning

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F60-01 | As a traveler, I want to earn loyalty points on bookings so that I save money on future trips. | AC1: 2 points earned per USD spent on confirmed bookings. AC2: Points credited 24 hours after booking status = CONFIRMED. AC3: Points not earned on cancelled or refunded bookings. AC4: Points balance shown in profile header and checkout. AC5: Points history shows: booking reference, amount earned, date. |
| US-F60-02 | As a traveler, I want to earn bonus points for writing reviews so that I'm incentivized to share feedback. | AC1: 50 points for first review per completed booking. AC2: Review must be at least 50 characters to qualify. AC3: Points credited on review submission. AC4: Bonus points labelled separately in transaction history. |

### F61 — Loyalty Points History & Balance

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F61-01 | As a traveler, I want to view my points balance and transaction history so that I can track my rewards. | AC1: Points balance displayed prominently in profile. AC2: Transaction history page with filter: All, Earned, Redeemed, Adjusted. AC3: Each transaction shows: type, amount, description, date, related booking (if applicable). AC4: Pagination: 20 transactions per page. AC5: Export history as CSV (optional). |
| US-F61-02 | As a traveler, I want to understand how many points I need for a discount so that I can plan my redemptions. | AC1: At checkout, points balance shown with conversion hint ("You have 500 points = $5.00 off"). AC2: Slider to select points to redeem (increments of 100). AC3: Real-time price update as points selected. AC4: Maximum 50% of subtotal can be covered by points. |

---

## Data Model

### `loyalty_transactions` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `booking_id` | UUID | FK → bookings | Nullable (e.g., review bonus) |
| `type` | VARCHAR(20) | NOT NULL | EARNED, REDEEMED, ADJUSTED, EXPIRED |
| `amount` | INTEGER | NOT NULL | Positive for earned, negative for redeemed |
| `description` | TEXT | NOT NULL | e.g., "Booking DLG-2026-0042", "Review bonus" |
| `balance_after` | INTEGER | NOT NULL | Running balance snapshot |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Points Rules

| Action | Points | Type | Timing |
|--------|--------|------|--------|
| Booking confirmed ($1 spent) | 2 | EARNED | 24h after confirmation |
| First review per booking | 50 | EARNED | On review submission |
| Points redeemed at checkout | -N | REDEEMED | At checkout |
| Booking cancelled | -earned | ADJUSTED | On cancellation |
| Admin adjustment | ±N | ADJUSTED | Immediate |
| Points expiry (12 months) | -N | EXPIRED | Monthly batch job |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `LOYALTY_001` | 400 | Insufficient points for redemption |
| `LOYALTY_002` | 400 | Points exceed 50% of subtotal |
| `LOYALTY_003` | 400 | Invalid points amount (not multiple of 100) |

---

*Aligned with PRD section 7.7 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 14, 33).*
