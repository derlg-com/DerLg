# Loyalty & Bonus Points — Architecture

> **Feature IDs:** F60–F61
> **Scope:** v1.1

---

## Overview

The Loyalty module tracks points earning and redemption through a transaction ledger pattern. Points are earned on confirmed bookings and can be redeemed at checkout (100 points = 1 USD).

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Points      │  │ Points      │  │ Checkout Points     │  │
│  │ Balance     │  │ History     │  │ Slider              │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Loyalty Store (Zustand) — balance, transactions     │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Loyalty Service                                     │    │
│  │ — earn, redeem, calculate, expire                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ PostgreSQL                                          │    │
│  │ (loyalty_transactions, users.loyalty_balance)       │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Points Earning Flow

```
[Booking status: CONFIRMED]
        │
        ▼
[Scheduled job runs every hour]
        │
        ▼
[Calculate points: total_usd × 2]
        │
        ▼
[Create loyalty transaction: EARNED]
[Update users.loyalty_balance]
[Send push notification: "You earned X points!"]
```

---

## Denormalized Balance

The `users.loyalty_balance` column is a denormalized cache of `SUM(amount)` from `loyalty_transactions`. It is updated synchronously on every transaction for fast reads.

```sql
-- Recalculate (for reconciliation)
UPDATE users u
SET loyalty_balance = (
  SELECT COALESCE(SUM(amount), 0)
  FROM loyalty_transactions lt
  WHERE lt.user_id = u.id
)
WHERE u.id = $1;
```

---

## Redemption at Checkout

```typescript
function calculateRedemption(
  subtotalUsd: number,
  pointsBalance: number,
  pointsToRedeem: number
): { discountUsd: number; pointsUsed: number } {
  const maxDiscount = subtotalUsd * 0.5; // 50% cap
  const maxPoints = Math.min(pointsBalance, maxDiscount * 100);
  const pointsUsed = Math.min(pointsToRedeem, maxPoints);
  const discountUsd = pointsUsed / 100;
  return { discountUsd, pointsUsed };
}
```

---

## Expiry Job

Monthly cron job expires points older than 12 months:

```sql
INSERT INTO loyalty_transactions (user_id, type, amount, description, balance_after)
SELECT 
  user_id,
  'EXPIRED',
  -amount,
  'Points expired after 12 months',
  balance_after - amount
FROM (
  SELECT 
    user_id,
    amount,
    balance_after,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as rn
  FROM loyalty_transactions
  WHERE type = 'EARNED'
    AND created_at < NOW() - INTERVAL '12 months'
    AND NOT EXISTS (
      SELECT 1 FROM loyalty_transactions lt2
      WHERE lt2.description LIKE '%expired%'
        AND lt2.user_id = loyalty_transactions.user_id
    )
) expiring;
```

---

*Aligned with PRD section 7.7 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
