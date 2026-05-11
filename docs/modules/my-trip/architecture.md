# My Trip — Booking Management — Architecture

> **Feature IDs:** F30, F34–F38  
> **Scope:** MVP (F38: v1.1)

---

## Overview

The Booking Management module is the central reservation engine. It orchestrates holds, payments, confirmations, cancellations, and refunds across all booking types (trips, hotels, transport, guides). It uses a unified `bookings` table with type-specific extension tables.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Booking     │  │ My Trips    │  │ Booking Detail      │  │
│  │ Form        │  │ (List)      │  │ (QR, cancel, iCal)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Booking Store (Zustand) — draft, hold timer, status │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Bookings    │  │ Booking     │  │ Cancellation        │  │
│  │ Controller  │  │ Items       │  │ Service             │  │
│  └──────┬──────┘  │ Controller  │  └──────────┬──────────┘  │
│         │         └──────┬──────┘             │             │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Booking Service                                     │   │
│  │ — create, hold, confirm, cancel, refund, conflict   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │ PostgreSQL│     │  Redis   │     │  Stripe  │           │
│  │ (bookings)│     │ (holds)  │     │ (refunds)│           │
│  └──────────┘     └──────────┘     └──────────┘           │
└──────────────────────────────────────────────────────────────┘
```

---

## Booking Creation Flow

```
[User submits booking form]
           │
           ▼
[Validate items + availability (FOR UPDATE lock)]
           │
      Available?
     /         \
   Yes          No
   /             \
  ▼               ▼
[Create booking HOLD]
[Set Redis TTL = 15m]
[Reduce inventory]
  │
  ▼
[Return booking reference + hold expiry]
  │
  ▼
[User proceeds to payment]
  │
  ▼
[Payment successful]
  │
  ▼
[Status: CONFIRMED]
[Delete Redis hold key]
[Generate QR code]
[Send confirmation email]
[Trigger FCM push]
```

---

## Conflict Detection

### Pessimistic Locking Pattern

```typescript
async createBooking(dto: CreateBookingDto) {
  return this.prisma.$transaction(async (tx) => {
    // Lock all involved inventory rows
    for (const item of dto.items) {
      await tx.$executeRaw`
        SELECT * FROM ${item.table}
        WHERE id = ${item.id}
        FOR UPDATE
      `;
    }

    // Re-check availability with locks held
    for (const item of dto.items) {
      const available = await this.checkAvailability(tx, item);
      if (!available) throw new ConflictException('Item no longer available');
    }

    // Create booking
    const booking = await tx.booking.create({ data: { ... } });

    // Create Redis hold
    await this.redis.setex(`booking:hold:${booking.id}`, 900, '1');

    return booking;
  }, { isolationLevel: 'Serializable' });
}
```

---

## Cancellation & Refund Flow

```
[User requests cancellation]
           │
           ▼
[Calculate refund tier]
           │
     ┌─────┴─────┐
     ▼           ▼
  ≥7 days    1–7 days   <24h
     │          │         │
     ▼          ▼         ▼
  100%       50%        0%
  refund     refund     no refund
     │          │         │
     └─────┬────┘         │
           ▼              ▼
    [Process Stripe refund]
    [Record refund in DB]
    [Reverse loyalty points]
    [Status: CANCELLED]
    [Inventory released]
    [Send cancellation email]
```

---

## QR Code Generation

```typescript
import { createHash } from 'crypto';

function generateQRData(booking: Booking): string {
  const payload = {
    ref: booking.reference,
    id: booking.id,
    exp: addHours(booking.created_at, 48).toISOString(), // 48h validity
  };
  const signature = createHash('sha256')
    .update(JSON.stringify(payload) + QR_SECRET)
    .digest('hex');
  return JSON.stringify({ ...payload, sig: signature });
}
```

QR codes are rendered as SVGs and cached in Supabase Storage.

---

## iCal Export (v1.1)

```typescript
function generateICal(booking: Booking): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:${booking.items[0].name}`,
    `DTSTART:${formatDate(booking.start_date)}`,
    `DTEND:${formatDate(booking.end_date)}`,
    `LOCATION:${booking.metadata.meeting_point}`,
    `DESCRIPTION:Booking Reference: ${booking.reference}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
```

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
