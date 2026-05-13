# Private Tour — Prebuilt Package

> **User Journey:** Traveler discovers a prebuilt private tour template, views group details and benefits, then customizes or books as-is.  
> **Scope:** MVP  
> **Feature IDs:** TBD

---

## Overview

This workflow covers the private tour booking path starting from discovery, through viewing package details, to either customizing the journey or booking it unchanged.

**Key difference from public packages:**
- Private tours are for your group only (family/friends)
- Full customization freedom: reorder, add, or remove days
- Template shows group size limits and kid-friendly flag
- Admin creates all private tour templates

---

## Phase 1: Discovery

### Step 1: Browse Private Tours

**User Action:** Opens "Private Tours" section in the app.

**System:** Renders private tour listings.

**API Call:**
```
GET /v1/trips?type=private&featured=true&limit=20
Headers: Accept-Language: en
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trips": {
      "items": [
        {
          "id": "uuid",
          "slug": "siem-reap-family-private-3d",
          "name": "Siem Reap Family Private Tour - 3 Days",
          "cover_image_url": "https://cdn.derlg.com/...",
          "duration_days": 3,
          "price_usd": 450.00,
          "price_type": "PER_GROUP",
          "category": "Family",
          "location": "Siem Reap",
          "rating_average": 4.9,
          "rating_count": 56,
          "is_featured": true,
          "is_kid_friendly": true,
          "max_group_size": 6,
          "min_group_size": 2
        }
      ],
      "total": 12,
      "page": 1,
      "limit": 20
    }
  }
}
```

### Step 2: Package Detail

**User Action:** Taps a private package card.

**System:** Navigates to `/trips/{slug}`.

**API Call:**
```
GET /v1/trips/{slug}
Headers: Accept-Language: en
```

**Response (includes private package details and journey map template):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "siem-reap-family-private-3d",
    "name": "Siem Reap Family Private Tour - 3 Days",
    "description": "...",
    "duration_days": 3,
    "price_usd": 450.00,
    "price_type": "PER_GROUP",
    "category": "Family",
    "location": "Siem Reap",
    "max_group_size": 6,
    "min_group_size": 2,
    "is_kid_friendly": true,
    "included_items": ["Private van with driver", "Daily breakfast", "Airport transfer", "English-speaking guide"],
    "excluded_items": ["Lunch", "Dinner", "Temple pass", "Tips"],
    "benefits": [
      "Flexible start time",
      "Child car seat available",
      "Private guide attention",
      "Hotel pickup included"
    ],
    "meeting_point": {
      "description": "Your hotel in Siem Reap",
      "latitude": 13.4115,
      "longitude": 103.8140
    },
    "cancellation_policy": "Free cancellation up to 7 days before...",
    "journey_map": {
      "template_id": "jmt-uuid",
      "days": [
        {
          "day_number": 1,
          "title": "Arrival & Angkor Wat Sunset",
          "default_activities": [
            { "id": "act-1", "name": "Hotel Pickup", "price_usd": 0, "included": true },
            { "id": "act-2", "name": "Angkor Wat Sunset Tour", "price_usd": 0, "included": true }
          ],
          "default_hotel": { "id": "htl-1", "name": "Siem Reap Family Hotel", "room_type": "Family Suite", "price_usd": 0 },
          "default_transport": { "id": "trn-1", "type": "PRIVATE_VAN", "price_usd": 0 },
          "default_guide": { "id": "guide-1", "name": "Sokha", "language": "en", "price_usd": 0 },
          "meals_included": ["breakfast"],
          "activity_pool": [...],
          "hotel_pool": [...],
          "transport_pool": [...]
        }
      ]
    }
  }
}
```

**Frontend renders:**
- Package overview (name, duration, price, price type)
- Group info: min/max group size, kid-friendly badge
- Benefits list
- Default journey map (day-by-day timeline)
- Included/excluded items
- Reviews
- "Customize My Journey" button
- "Book This Package" button

---

## Phase 2: Choose Path

At the package detail page, the user has two options:

| Action | Button | What Happens |
|--------|--------|--------------|
| **Customize** | "Customize My Journey" | Enters full customization mode. Can reorder/add/remove days, swap everything. |
| **Book As-Is** | "Book This Package" | Skips customization. Uses default journey map. Proceeds to availability confirm then checkout. |

---

## Phase 3A: Customize My Journey

**User Action:** Taps "Customize My Journey".

**System:** Enters customization mode. Full freedom to modify the itinerary.

### Customization Actions

| Action | User Does | System Does | Price Impact |
|--------|-----------|-------------|--------------|
| Reorder days | Drags Day 2 before Day 1 | Validates time constraints, re-renders | Neutral |
| Add day | Taps "Add Day", picks location/theme | Populates suggested activities for new day | Increase |
| Remove day | Taps delete on a day | Removes day and all its items | Decrease |
| Skip activity | Removes checkmark from included activity | Recalculates total | Decrease (if priced) |
| Add activity | Selects from `activity_pool` | Checks availability (cached 2 min) | Increase |
| Swap activity | Replaces one activity with another | Checks availability | Varies |
| Change hotel | Selects from `hotel_pool` | Checks room availability | Increase/decrease |
| Change transport | Selects from `transport_pool` | Checks vehicle availability | Increase/decrease |
| Add/change guide | `GET /guides?location=...&language=zh` | Shows guide options | Increase |

### Availability Check

Same as public packages:
```
POST /v1/availability/check
Body: {
  "checks": [
    {
      "type": "HOTEL",
      "id": "htl-2",
      "check_in": "2026-06-15",
      "check_out": "2026-06-16",
      "rooms": 1
    },
    {
      "type": "TRANSPORT",
      "id": "trn-2",
      "start_date": "2026-06-15",
      "end_date": "2026-06-17"
    }
  ]
}
```

### Price Delta

Real-time recalculation shown as user customizes:
```typescript
const basePrice = package.price_usd; // 450
const customizations = [
  { type: 'ADD_DAY', delta: 150 },
  { type: 'HOTEL_UPGRADE', id: 'htl-2', delta: 30 },
  { type: 'REMOVE_ACTIVITY', id: 'act-2', delta: -20 }
];
const newTotal = basePrice + customizations.reduce((sum, c) => sum + c.delta, 0);
// 450 + 150 + 30 - 20 = 610
```

### Save Draft

User can save progress and return later:
```
POST /v1/journey-drafts
Headers: Authorization: Bearer <jwt>
Body: {
  "trip_id": "uuid",
  "title": "My Family Siem Reap Trip",
  "customizations": [...],
  "total_price_usd": 610.00,
  "start_date": "2026-06-15",
  "travelers": { "adults": 2, "children": 2 }
}
```

### Confirm

After customization, user taps "Confirm":
```
POST /v1/availability/confirm
Body: { "draft_id": "draft-uuid" }
```

If valid, proceeds to checkout. If not, shows what changed and asks to re-customize.

---

## Phase 3B: Book As-Is

**User Action:** Taps "Book This Package".

**System:** Skips customization entirely. Uses the default journey map as the final itinerary.

**API Call:**
```
POST /v1/availability/confirm
Body: {
  "trip_id": "trip-uuid",
  "use_defaults": true,
  "start_date": "2026-06-15",
  "travelers": { "adults": 2, "children": 2 }
}
```

If valid, proceeds directly to checkout.

---

## Phase 4: Checkout & Payment

Identical to public packages.

### Create Booking with Hold

```
POST /v1/bookings
Headers: Authorization: Bearer <jwt>
Body: {
  "items": [
    {
      "item_type": "TRIP",
      "item_id": "trip-uuid",
      "quantity": 1,
      "metadata": {
        "travelers": { "adults": 2, "children": 2 },
        "start_date": "2026-06-15",
        "trip_type": "PRIVATE",
        "custom_journey_map": { /* final itinerary */ },
        "customizations": [...]
      }
    }
  ],
  "currency": "USD",
  "guest_email": null
}
```

Backend creates booking with `status: HOLD`, sets Redis TTL 15 minutes.

### Payment

- **Stripe Card:** `POST /v1/payments/intent`
- **QR Code:** `POST /v1/payments/qr`

Same webhook handling, same confirmation flow as public packages.

---

## Phase 5: Confirmation & Ticket

Same as public packages:
- Booking status: `CONFIRMED`
- Final journey map displayed
- QR check-in ticket generated
- Confirmation email + push notification
- Driver/guide contact revealed 24h before trip

---

## Error Handling

| Error | When | User Impact | Recovery |
|-------|------|-------------|----------|
| `HOLD_EXPIRED` | 15 min elapsed without payment | Booking cancelled, inventory released | User must re-confirm and re-checkout |
| `INVENTORY_CONFLICT` | Item sold out during customization or hold | Activity/hotel/transport no longer available | System shows alternatives; user re-customizes |
| `PAYMENT_FAILED` | Card declined or QR not scanned | Booking remains on HOLD | Retry payment (hold extended 5 min once) or cancel |
| `GROUP_SIZE_INVALID` | Selected travelers outside min/max group size | Cannot proceed | Frontend enforces min/max at traveler selection |
| `AVAILABILITY_CHANGED` | Between "Save" and "Confirm" | Saved selections no longer valid | User reviews changes and re-confirms |
| `CUSTOMIZATION_INVALID` | Added day has no activities, or time conflict | Cannot apply change | Frontend prevents invalid states |

---

## Edge Cases

### Kid-Friendly Validation
- If `is_kid_friendly: false`, frontend warns when children are in traveler count
- User can still proceed with acknowledgment

### Group Size Enforcement
- Frontend enforces `min_group_size` and `max_group_size` at traveler selection
- If group size changes after customization (e.g., remove travelers), re-validate transport capacity

### Book As-Is with Date Change
- Even when booking as-is, user must pick start date
- Availability confirm runs with chosen dates

### Multi-Private-Package Booking
- User can add multiple private packages to one booking
- Each package has its own journey map
- Combined into single checkout with one payment

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/trips?type=private` | GET | List private tour templates |
| `/v1/trips/{slug}` | GET | Private package detail with journey map |
| `/v1/availability/check` | POST | Check real-time availability (cached) |
| `/v1/availability/confirm` | POST | Fresh availability check before checkout |
| `/v1/journey-drafts` | POST | Save customization draft |
| `/v1/journey-drafts` | GET | List saved drafts |
| `/v1/bookings` | POST | Create booking with hold |
| `/v1/payments/intent` | POST | Stripe payment intent |
| `/v1/payments/qr` | POST | Generate QR payment |
| `/v1/bookings/{id}` | GET | Get booking detail |
