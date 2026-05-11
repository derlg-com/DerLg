# Payment & Checkout — Requirements

> **Feature IDs:** F40–F47  
> **Scope:** MVP (F46–F47: v1.1)  
> **Priority:** P0 (F40–F45), P1 (F46–F47)

---

## User Stories

### F40 — Stripe Card Payments

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F40-01 | As an international traveler, I want to pay with my credit/debit card so that I can confirm my booking. | AC1: Stripe Payment Intent created by backend; client secret returned to frontend. AC2: Frontend uses Stripe Elements for secure card input (no card data touches our servers). AC3: 3D Secure supported for cards requiring authentication. AC4: Payment confirmation updates booking status to `CONFIRMED`. AC5: Failed payment shows clear error message with retry option. AC6: Booking hold extended during payment processing (max 5 minutes). |
| US-F40-02 | As the system, I want to securely handle card payments so that PCI compliance is maintained. | AC1: Stripe Elements + Payment Intent flow (SAQ A compliance). AC2: No raw card numbers stored or logged. AC3: Webhook endpoint verifies Stripe signature. AC4: Idempotent payment processing via `idempotency_key`. |

### F41 — QR Code Payment (Bakong/ABA)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F41-01 | As a Cambodian or Chinese traveler, I want to pay via QR code so that I can use my preferred local payment method. | AC1: QR code generated on payment page (Bakong/ABA format). AC2: QR code contains: amount, merchant ID, transaction reference, expiry timestamp. AC3: QR expiry matches booking hold expiry (15 minutes). AC4: User can download QR image or screenshot for scanning. AC5: "I've paid" button triggers manual verification check. AC6: Payment status polled every 10 seconds for 5 minutes. AC7: Fallback to Stripe if QR payment not completed within hold window. |

### F42 — Payment Receipt (PDF)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F42-01 | As a traveler, I want to download a PDF receipt so that I have proof of payment for my records. | AC1: PDF generated on payment confirmation. AC2: Receipt contains: booking reference, date, itemized costs, taxes, total, payment method, transaction ID. AC3: Multi-language support (receipt in booking currency + user's preferred language). AC4: Available for download from booking detail page and confirmation email attachment. AC5: PDF stored in Supabase Storage for 1 year. |

### F43 — Stripe Webhook Processing

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F43-01 | As the system, I want to process Stripe webhooks reliably so that payment status is always accurate. | AC1: Webhook endpoint `/v1/webhooks/stripe` verifies Stripe signature. AC2: Events processed: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`. AC3: Idempotent processing: each `stripe_event_id` processed at most once (tracked in DB). AC4: Failed webhook processing retried with exponential backoff (max 5 attempts). AC5: Dead-letter queue for permanently failed events. AC6: Webhook processing logged for audit. |

### F44 — Refund Processing

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F44-01 | As the system, I want to process refunds automatically so that travelers receive their money back promptly. | AC1: Refund amount calculated per cancellation tier (100%/50%/0%). AC2: Stripe refund created with `amount` parameter (partial refunds supported). AC3: Refund status tracked: `PENDING`, `SUCCEEDED`, `FAILED`. AC4: Failed refunds trigger admin alert. AC5: Loyalty points earned on the booking are reversed. AC6: Refund record linked to original payment for audit trail. |

### F45 — Currency Conversion

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F45-01 | As a traveler, I want to see prices in my preferred currency so that I understand costs without mental math. | AC1: Supported currencies: USD (default), KHR, CNY. AC2: Exchange rates fetched from ExchangeRate-API. AC3: Rates cached in Redis with 1-hour TTL. AC4: All prices displayed in selected currency with original USD shown in small text. AC5: Currency selector in header/footer, persisted in user profile or localStorage. AC6: Booking stored in USD; displayed currency is presentation layer only. |

### F46 — Discount Code Validation (v1.1)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F46-01 | As a traveler, I want to apply a discount code at checkout so that I can get promotional pricing. | AC1: Discount code input field on checkout page. AC2: Validation: code exists, not expired, usage limit not exceeded, not already used by this user. AC3: Discount types: percentage off, fixed amount off. AC4: Non-stackable with other discount codes; combinable with loyalty points and student discount. AC5: Price breakdown shows: subtotal, discount, loyalty points redeemed, student discount, total. |

### F47 — Loyalty Points Redemption at Checkout (v1.1)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F47-01 | As a traveler, I want to redeem loyalty points at checkout so that I save money on my booking. | AC1: Points balance shown at checkout. AC2: Conversion: 100 points = 1 USD. AC3: User can enter points to redeem (max: points balance or 50% of subtotal, whichever is lower). AC4: Points reserved (deducted from balance) on booking creation. AC5: Points returned if booking cancelled or payment fails. AC6: Points permanently deducted on payment confirmation. |

---

## Data Model

### `payments` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `booking_id` | UUID | FK → bookings | |
| `payment_method` | VARCHAR(30) | NOT NULL | STRIPE_CARD, STRIPE_QR, BAKONG_QR, ABA_QR |
| `provider_transaction_id` | VARCHAR(255) | | Stripe PaymentIntent ID or QR reference |
| `amount_usd` | DECIMAL(10,2) | NOT NULL | |
| `currency` | VARCHAR(3) | DEFAULT 'USD' | |
| `amount_in_currency` | DECIMAL(10,2) | | |
| `exchange_rate` | DECIMAL(10,6) | | At time of payment |
| `status` | VARCHAR(30) | DEFAULT 'PENDING' | PENDING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED |
| `stripe_event_id` | VARCHAR(255) | | For idempotency |
| `refund_amount_usd` | DECIMAL(10,2) | DEFAULT 0 | |
| `refund_reason` | TEXT | | |
| `metadata` | JSONB | | Stripe response, QR data |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `discount_codes` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | Case-insensitive |
| `type` | VARCHAR(20) | NOT NULL | PERCENTAGE, FIXED |
| `value` | DECIMAL(10,2) | NOT NULL | Percentage (e.g., 10.00) or USD amount |
| `max_uses` | INTEGER | | NULL = unlimited |
| `uses_count` | INTEGER | DEFAULT 0 | |
| `valid_from` | TIMESTAMPTZ | | |
| `valid_until` | TIMESTAMPTZ | | |
| `min_booking_value_usd` | DECIMAL(10,2) | | NULL = no minimum |
| `applicable_types` | TEXT[] | | TRIP, HOTEL, TRANSPORT, GUIDE; NULL = all |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, EXPIRED |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `PAYMENT_001` | 400 | Invalid payment method |
| `PAYMENT_002` | 402 | Payment failed (card declined) |
| `PAYMENT_003` | 409 | Payment already processed for this booking |
| `PAYMENT_004` | 400 | Invalid discount code |
| `PAYMENT_005` | 400 | Discount code expired or usage limit reached |
| `PAYMENT_006` | 400 | Insufficient loyalty points |
| `PAYMENT_007` | 400 | Currency not supported |
| `WEBHOOK_001` | 400 | Invalid Stripe signature |
| `WEBHOOK_002` | 409 | Event already processed |

---

*Aligned with PRD section 7.5 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 10–11, 40).*
