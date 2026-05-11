# Festival Calendar & Event Alerts — Architecture

> **Feature ID:** F81
> **Scope:** v1.2

---

## Overview

The Festival Calendar module provides cultural event discovery with trip tie-ins and auto-generated promotional discount codes. It serves as a content hook to drive bookings during festival periods.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Festival    │  │ Festival    │  │ Related Trips       │  │
│  │ Calendar    │  │ Detail      │  │ (festival-based)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Notification Service (FCM + in-app)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Festivals Service                                   │    │
│  │ — calendar, discounts, related trips                │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ PostgreSQL                                          │    │
│  │ (festivals, discount_codes)                         │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Auto-Discount Generation

```typescript
async function generateFestivalDiscount(festival: Festival) {
  const code = `${festival.slug.toUpperCase()}${festival.start_date.getFullYear()}`;
  
  const discount = await db.discountCodes.create({
    data: {
      code,
      type: 'PERCENTAGE',
      value: 10.00,
      valid_from: festival.start_date,
      valid_until: festival.end_date,
      applicable_types: ['TRIP'],
      status: 'ACTIVE',
    },
  });

  await db.festivals.update({
    where: { id: festival.id },
    data: { discount_code_id: discount.id },
  });

  return discount;
}
```

---

## Notification Schedule

| Trigger | Timing | Channel | Content |
|---------|--------|---------|---------|
| Festival added | Immediate | Push | "New festival: [Name] on [Date]" |
| Festival approaching | 14 days before | Push + Email | Festival details + discount code + trip suggestions |
| Festival starts | Day of | Push | "[Name] starts today! Enjoy the festivities" |
| Festival ends | Day after | In-app | "Hope you enjoyed [Name]! Share your experience" |

---

*Aligned with PRD section 7.9 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
