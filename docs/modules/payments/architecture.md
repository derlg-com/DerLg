# Payment & Checkout — Architecture

> **Feature IDs:** F40–F47  
> **Scope:** MVP (F46–F47: v1.1)

---

## Overview

The Payments module handles all financial transactions: Stripe card payments, QR code payments (Bakong/ABA), currency conversion, discount codes, loyalty points redemption, and refund processing. It is the most security-sensitive module and enforces strict audit logging.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Checkout    │  │ Stripe      │  │ QR Display          │  │
│  │ Page        │  │ Elements    │  │ (Polling)           │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Payment Store (Zustand) — method, discount, points  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON / WebSocket
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Payments    │  │ Stripe      │  │ QR Payment          │  │
│  │ Controller  │  │ Service     │  │ Service             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Payment Service                                     │    │
│  │ — intent creation, confirmation, refund, audit      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │ PostgreSQL│     │  Redis   │     │  Stripe  │            │
│  │ (payments)│     │ (rates)  │     │  API     │            │
│  └──────────┘     └──────────┘     └──────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## Stripe Payment Flow

```
[User clicks "Pay Now"]
        │
        ▼
[Backend: POST /v1/payments/intent]
        │
        ▼
[Create Stripe PaymentIntent]
[Store intent in payments table]
[Return client_secret to frontend]
        │
        ▼
[Frontend: Stripe Elements.confirmPayment()]
        │
        ▼
[3D Secure (if required)]
        │
        ▼
[Stripe redirects to return_url]
        │
        ▼
[Webhook: payment_intent.succeeded]
        │
        ▼
[Update booking: CONFIRMED]
[Update payment: SUCCEEDED]
[Send confirmation email]
[Trigger FCM push]
```

---

## QR Payment Flow

```
[User selects "QR Payment"]
        │
        ▼
[Backend generates QR payload]
{
  merchant_id: "DERLG001",
  amount: 150.00,
  currency: "USD",
  reference: "DLG-2026-0042",
  expiry: "2026-05-11T14:30:00Z",
  checksum: "sha256(...)"
}
        │
        ▼
[Display QR code (SVG)]
[Start polling: every 10s]
        │
        ▼
[User scans + pays via Bakong/ABA app]
        │
        ▼
[Payment provider callback]
[Webhook: /v1/webhooks/bakong]
        │
        ▼
[Verify checksum + signature]
[Update payment: SUCCEEDED]
[Stop polling]
[Confirm booking]
```

---

## Currency Conversion

### Exchange Rate Caching

```typescript
async function getExchangeRate(from: string, to: string): Promise<number> {
  const cacheKey = `fx:${from}:${to}`;
  const cached = await redis.get(cacheKey);
  if (cached) return parseFloat(cached);

  const rate = await exchangeRateApi.getRate(from, to);
  await redis.setex(cacheKey, 3600, rate.toString()); // 1h TTL
  return rate;
}
```

### Supported Currency Pairs

| From | To | API Source |
|------|-----|-----------|
| USD | KHR | ExchangeRate-API |
| USD | CNY | ExchangeRate-API |
| KHR | USD | Inverse of USD/KHR |
| CNY | USD | Inverse of USD/CNY |

All internal calculations use USD. Display currencies are converted at render time.

---

## Webhook Processing

### Idempotency

```typescript
@Post('webhooks/stripe')
async handleStripeWebhook(@Headers('stripe-signature') signature: string, @Body() payload: Buffer) {
  const event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);

  // Check if already processed
  const existing = await this.paymentsRepo.findByStripeEventId(event.id);
  if (existing) {
    this.logger.warn(`Stripe event ${event.id} already processed`);
    return { received: true };
  }

  await this.paymentsService.processStripeEvent(event);
  return { received: true };
}
```

### Retry Policy

| Attempt | Delay | Action |
|---------|-------|--------|
| 1 | Immediate | Initial attempt |
| 2 | 5 min | Retry |
| 3 | 15 min | Retry |
| 4 | 1 hour | Retry |
| 5 | 4 hours | Final retry |
| 5+ | — | Dead letter queue |

---

## Security

1. **Stripe Signature Verification:** All webhook endpoints verify `stripe-signature` header.
2. **No Card Data:** Card numbers never touch our servers (Stripe Elements).
3. **Audit Logging:** Every payment event logged to `audit_logs` table.
4. **Rate Limiting:** Payment intent creation limited to 3 req/min/user.
5. **Idempotency Keys:** All payment operations use idempotency keys.

---

*Aligned with PRD section 7.5 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
