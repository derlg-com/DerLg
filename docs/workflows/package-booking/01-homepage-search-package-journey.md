# Homepage → Search → Package Booking with Journey Map Customization

> **User Journey:** Traveler discovers a package through search, customizes the prebuilt itinerary, and completes payment.  
> **Scope:** MVP  
> **Feature IDs:** F20, F21, F22, F23, F30, F31, F32, F33, F34, F35, F36, F37, F40, F41

---

## Overview

This workflow covers the complete package booking path starting from the homepage search, through journey map customization, to payment confirmation and ticket delivery.

### Key Concepts

| Term | Definition |
|------|------------|
| **Journey Map** | Prebuilt day-by-day itinerary template included in each package. Contains default activities, hotel, transport, and meals. |
| **Draft** | Saved customization state. Persists across sessions. No inventory held. |
| **Hold** | 15-minute inventory reservation. Created at checkout, not during customization. |
| **Activity Pool** | Set of compatible activities per day that users can add or swap. Each has its own price. |
| **Price Delta** | Real-time price adjustment shown as user customizes (+$45, -$20, etc.). |

---

## Phase 1: Discovery

### Step 1: Homepage

**User Action:** Opens app, views featured trips and categories.

**System:** Renders homepage with `GET /trips?featured=true&limit=5` and category navigation.

### Step 2: Search

**User Action:** Taps search bar, types query (e.g., "Siem Reap temple 3 days").

**System:** Debounced 300ms, then calls search API.

**API Call:**
```
GET /v1/search?q=Siem+Reap+temple+3+days&type=trip&page=1&limit=20
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
          "slug": "siem-reap-temple-tour-3d",
          "name": "Siem Reap Temple Tour - 3 Days",
          "cover_image_url": "https://cdn.derlg.com/...",
          "duration_days": 3,
          "price_usd": 299.00,
          "category": "Temples",
          "location": "Siem Reap",
          "rating_average": 4.8,
          "rating_count": 124,
          "is_featured": true
        }
      ],
      "total": 8,
      "page": 1,
      "limit": 20
    }
  }
}
```

### Step 3: Search Results

**User Action:** Browses package cards, taps one.

**System:** Navigates to `/trips/{slug}`.

### Step 4: Package Detail

**API Call:**
```
GET /v1/trips/{slug}
Headers: Accept-Language: en
```

**Response (includes default journey map template):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "siem-reap-temple-tour-3d",
    "name": "Siem Reap Temple Tour - 3 Days",
    "description": "...",
    "duration_days": 3,
    "price_usd": 299.00,
    "category": "Temples",
    "location": "Siem Reap",
    "max_guests": 12,
    "included_items": ["Hotel accommodation", "Daily breakfast", "Airport transfer"],
    "excluded_items": ["Lunch", "Dinner", "Temple pass"],
    "meeting_point": {
      "description": "Siem Reap International Airport",
      "latitude": 13.4115,
      "longitude": 103.8140
    },
    "cancellation_policy": "Free cancellation up to 7 days before...",
    "itinerary_days": [
      {
        "day_number": 1,
        "title": "Arrival & Angkor Wat Sunset",
        "description": "...",
        "duration_hours": 6
      }
    ],
    "journey_map": {
      "template_id": "jmt-uuid",
      "days": [
        {
          "day_number": 1,
          "title": "Arrival & Angkor Wat Sunset",
          "default_activities": [
            { "id": "act-1", "name": "Airport Pickup", "price_usd": 0, "included": true },
            { "id": "act-2", "name": "Angkor Wat Sunset Tour", "price_usd": 0, "included": true },
            { "id": "act-3", "name": "Traditional Apsara Dance Show", "price_usd": 25, "included": false }
          ],
          "default_hotel": { "id": "htl-1", "name": "Siem Reap Boutique Hotel", "room_type": "Deluxe Double", "price_usd": 0 },
          "default_transport": { "id": "trn-1", "type": "VAN", "price_usd": 0 },
          "default_guide": null,
          "meals_included": ["breakfast"],
          "activity_pool": [
            { "id": "act-3", "name": "Traditional Apsara Dance Show", "price_usd": 25, "duration_hours": 2, "available": true },
            { "id": "act-4", "name": "Khmer Cooking Class", "price_usd": 35, "duration_hours": 3, "available": true },
            { "id": "act-5", "name": "Floating Village Boat Tour", "price_usd": 20, "duration_hours": 2.5, "available": true }
          ],
          "hotel_pool": [
            { "id": "htl-1", "name": "Siem Reap Boutique Hotel", "room_type": "Deluxe Double", "price_usd": 0, "available": true },
            { "id": "htl-2", "name": "Angkor Paradise Hotel", "room_type": "Superior Twin", "price_usd": 15, "available": true },
            { "id": "htl-3", "name": "Sokha Angkor Resort", "room_type": "Pool View Suite", "price_usd": 45, "available": true }
          ],
          "transport_pool": [
            { "id": "trn-1", "type": "VAN", "price_usd": 0, "available": true },
            { "id": "trn-2", "type": "PRIVATE_CAR", "price_usd": 30, "available": true },
            { "id": "trn-3", "type": "TUK_TUK", "price_usd": -10, "available": true }
          ]
        },
        {
          "day_number": 2,
          "title": "Angkor Thom & Ta Prohm",
          "default_activities": [...],
          "activity_pool": [...],
          "hotel_pool": [...],
          "transport_pool": [...]
        },
        {
          "day_number": 3,
          "title": "Banteay Srei & Departure",
          "default_activities": [...],
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
- Package overview (name, duration, price, rating)
- Default journey map (day-by-day timeline)
- Included/excluded items
- Reviews
- "Customize My Journey" button

---

## Phase 2: Journey Map Customization

**User Action:** Taps "Customize My Journey" button.

**System:** Enters customization mode. All days become editable.

### Customization Actions

| Action | User Does | System Does | Price Impact |
|--------|-----------|-------------|--------------|
| Skip activity | Removes checkmark from included activity | Recalculates total | Decrease |
| Add activity | Selects from `activity_pool` | Checks availability (cached 2 min) | Increase |
| Swap activities | Drags activity from Day 1 to Day 2 | Validates time constraints, re-renders | Neutral (unless prices differ) |
| Change hotel | Selects from `hotel_pool` | Checks room availability | Increase/decrease |
| Change transport | Selects from `transport_pool` | Checks vehicle availability | Increase/decrease |
| Add guide | `GET /guides?location=...&language=zh` | Shows guide options | Increase |

### Availability Check (on each change)

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

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      { "type": "HOTEL", "id": "htl-2", "available": true },
      { "type": "TRANSPORT", "id": "trn-2", "available": true }
    ]
  }
}
```

**Price Delta Calculation (frontend):**
```typescript
// Real-time recalculation
const basePrice = package.price_usd; // 299
const customizations = [
  { type: 'ADD_ACTIVITY', id: 'act-3', delta: 25 },
  { type: 'HOTEL_UPGRADE', id: 'htl-2', delta: 15 },
  { type: 'TRANSPORT_UPGRADE', id: 'trn-2', delta: 30 },
  { type: 'SKIP_ACTIVITY', id: 'act-2', delta: 0 } // included, no refund
];
const newTotal = basePrice + customizations.reduce((sum, c) => sum + c.delta, 0);
// 299 + 25 + 15 + 30 = 369
```

### Add More Packages

**User Action:** Taps "Add Another Package".

**System:** Returns to search results. User can add additional packages to the same overall trip.

**Note:** Each package is a separate prebuilt template. Multiple packages are combined into one booking with multiple `booking_items`.

---

## Phase 3: Save or Confirm

### Path A: Save My Journey

**User Action:** Clicks "Save My Journey" (not ready to pay).

**API Call:**
```
POST /v1/journey-drafts
Headers: Authorization: Bearer <jwt>
Body: {
  "trip_id": "uuid",
  "title": "My Siem Reap Adventure",
  "customizations": [...],
  "total_price_usd": 369.00,
  "start_date": "2026-06-15",
  "travelers": { "adults": 2, "children": 0 }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "draft_id": "draft-uuid",
    "title": "My Siem Reap Adventure",
    "saved_at": "2026-05-13T10:30:00Z",
    "expires_at": "2026-05-20T10:30:00Z"
  }
}
```

**System:**
- Draft stored in database
- No inventory held
- User can return later via "My Saved Journeys"

### Return Later (Load Draft)

**User Action:** Opens app, goes to "My Saved Journeys".

**API Call:**
```
GET /v1/journey-drafts
Headers: Authorization: Bearer <jwt>
```

**User Action:** Taps a saved draft.

**System:** Loads draft back into customization mode with all previous selections preserved.

### Path B: Confirm (Ready to Book)

**User Action:** Clicks "Confirm" after reviewing customized journey map.

**System:** Validates all selections are still available (fresh availability check, no cache).

```
POST /v1/availability/confirm
Body: { "draft_id": "draft-uuid" }
```

If valid, proceeds to checkout. If not valid, shows what's changed and asks user to re-customize.

---

## Phase 4: Checkout & Payment

### Step 1: Create Booking with Hold

**API Call:**
```
POST /v1/bookings
Headers: Authorization: Bearer <jwt>
Body: {
  "items": [
    {
      "item_type": "TRIP",
      "item_id": "trip-uuid",
      "quantity": 2,
      "metadata": {
        "travelers": { "adults": 2, "children": 0 },
        "start_date": "2026-06-15",
        "custom_journey_map": {
          "template_id": "jmt-uuid",
          "days": [
            {
              "day_number": 1,
              "activities": [
                { "id": "act-1", "name": "Airport Pickup", "price_usd": 0 },
                { "id": "act-2", "name": "Angkor Wat Sunset Tour", "price_usd": 0 },
                { "id": "act-3", "name": "Traditional Apsara Dance Show", "price_usd": 25 }
              ],
              "hotel": { "id": "htl-2", "name": "Angkor Paradise Hotel", "price_usd": 15 },
              "transport": { "id": "trn-2", "type": "PRIVATE_CAR", "price_usd": 30 },
              "guide": null
            }
          ]
        },
        "customizations": [
          { "type": "ADD_ACTIVITY", "id": "act-3", "delta_usd": 25 },
          { "type": "HOTEL_UPGRADE", "from": "htl-1", "to": "htl-2", "delta_usd": 15 },
          { "type": "TRANSPORT_UPGRADE", "from": "trn-1", "to": "trn-2", "delta_usd": 30 }
        ]
      }
    }
  ],
  "currency": "USD",
  "guest_email": null
}
```

**Backend Actions:**
1. `BEGIN TRANSACTION` with `SERIALIZABLE` isolation
2. `SELECT FOR UPDATE` on all inventory rows (hotel rooms, vehicles)
3. Re-check availability
4. Create booking with `status: HOLD`
5. Create `booking_items` with snapshot data
6. Set Redis TTL: `SETEX booking:hold:{id} 900 1`
7. `COMMIT`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "reference": "DLG-2026-0042",
    "type": "TRIP",
    "status": "HOLD",
    "total_price_usd": 369.00,
    "currency": "USD",
    "hold_expires_at": "2026-05-13T10:45:00Z",
    "items": [...]
  }
}
```

### Step 2: Checkout Page

**Frontend renders:**
- Booking summary with customized journey map
- Price breakdown (base + customizations)
- 15-minute countdown timer
- Payment method selector (Card / QR)

### Step 3: Payment

#### Option A: Stripe Card

```
POST /v1/payments/intent
Headers: Authorization: Bearer <jwt>
Body: {
  "booking_id": "booking-uuid",
  "payment_method": "STRIPE_CARD",
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client_secret": "pi_xxx_secret_yyy",
    "payment_intent_id": "pi_xxx",
    "amount_usd": 369.00,
    "currency": "USD"
  }
}
```

**Frontend:** Stripe Elements handles card input. On success, Stripe calls webhook.

#### Option B: QR Code (Bakong/ABA)

```
POST /v1/payments/qr
Headers: Authorization: Bearer <jwt>
Body: {
  "booking_id": "booking-uuid",
  "provider": "BAKONG"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qr_data": "000201010212...",
    "qr_image_url": "https://cdn.derlg.com/qr/...",
    "expiry": "2026-05-13T10:45:00Z",
    "reference": "DLG-2026-0042-QR"
  }
}
```

**Frontend:** Displays QR code with amount and expiry. Polls status every 10 seconds.

### Step 4: Pending Transaction

**Status:** `PENDING_PAYMENT`

- Booking hold remains active
- Inventory locked
- QR expiry matches hold expiry (15 minutes)
- If payment not completed within hold window → status `EXPIRED`, inventory released

### Step 5: Payment Confirmation

**Stripe Webhook:**
```
POST /v1/webhooks/stripe
Body: { "type": "payment_intent.succeeded", ... }
```

**OR QR Callback:** Payment provider notifies backend.

**Backend Actions:**
1. Verify payment (Stripe signature or QR provider callback)
2. Idempotency check via `stripe_event_id`
3. Update booking: `status: CONFIRMED`
4. Update payment: `status: SUCCEEDED`
5. Delete Redis hold key
6. Generate QR check-in code
7. Send confirmation email (Resend API)
8. Send FCM push notification

---

## Phase 5: Confirmation & Ticket

### Step 1: Confirmation Page

**API Call:**
```
GET /v1/bookings/{id}
Headers: Authorization: Bearer <jwt>
```

**Response (CONFIRMED):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "reference": "DLG-2026-0042",
    "status": "CONFIRMED",
    "total_price_usd": 369.00,
    "payment_status": "PAID",
    "items": [...],
    "confirmed_at": "2026-05-13T10:32:00Z",
    "journey_map": { /* final customized itinerary */ },
    "qr_check_in": {
      "qr_data": "encrypted_payload",
      "qr_image_url": "https://cdn.derlg.com/qr/..."
    }
  }
}
```

### Step 2: Final Journey Map

User sees their customized day-by-day itinerary with all their selections:
- Activities they chose (included + added)
- Hotel they selected
- Transport they selected
- Guide (if any)
- Meeting points and times

### Step 3: QR Ticket

- Unique QR code for check-in
- Scannable by partner/driver/guide mobile app
- Contains encrypted booking reference

### Step 4: Reveal Contact Info

**24 hours before trip start date:**
- Driver name, phone, vehicle plate
- Guide contact (if booked)
- Hotel contact (if changed from default)

**API Call:**
```
GET /v1/bookings/{id}/contacts
```

### Step 5: Calendar Export (v1.1)

```
GET /v1/bookings/{id}/ical
```

---

## State Diagram

```
[Homepage]
   │
   ▼
[Search Input] ──GET /search──▶ [Search Results]
   │                               │
   ▼                               ▼
[Package Detail] ◄──GET /trips/{slug}──┘
   │
   ▼
[View Journey Map Template]
   │
   ▼
[Customize Mode]
   │
   ├──── Skip Activity ────┐
   ├──── Add Activity ─────┤
   ├──── Swap Days ────────┤── Availability Check (cached)
   ├──── Change Hotel ─────┤
   ├──── Change Transport ─┤
   └──── Add Guide ────────┘
   │
   ▼
[Price Delta Recalculated]
   │
   ├─────── Save My Journey ────────┐
   │         POST /journey-drafts    │
   │               │                 │
   │               ▼                 │
   │      [Draft: SAVED]             │
   │               │                 │
   │               ▼                 │
   │      [Return Later]             │
   │               │                 │
   │               ▼                 │
   │      GET /journey-drafts        │
   │               │                 │
   │               ▼                 │
   │      [Load Draft]               │
   │               │                 │
   └───────────────┘                 │
   │                                 │
   ▼                                 │
[Confirm] ◄─────────────────────────┘
   │
   ▼
[Availability Confirm]
   │
   ├──── Conflict? ──▶ [Re-customize]
   │
   ▼
[Checkout]
   │
   ▼
POST /bookings
   │
   ▼
[Status: HOLD]
Redis TTL 15m
   │
   ├──── Card: POST /payments/intent
   │
   ├──── QR: POST /payments/qr
   │
   ▼
[Status: PENDING_PAYMENT]
   │
   ├──── Timeout? ──▶ [Status: EXPIRED]
   │                      Inventory released
   │
   ├──── Payment Failed ──▶ [Retry / Cancel]
   │
   ▼
[Payment Confirmed]
   │
   ▼
[Status: CONFIRMED]
   │
   ├──── Delete Redis key
   ├──── Generate QR ticket
   ├──── Send email + push
   │
   ▼
[Confirmation Page]
   │
   ├──── Final Journey Map
   ├──── QR Ticket
   ├──── Booking Reference
   │
   ▼
[My Trips] ◄── 24h before ── Contact info revealed
```

---

## Error Handling

| Error | When | User Impact | Recovery |
|-------|------|-------------|----------|
| `HOLD_EXPIRED` | 15 min elapsed without payment | Booking cancelled, inventory released | User must re-confirm and re-checkout |
| `INVENTORY_CONFLICT` | Item sold out during customization or hold | Activity/hotel/transport no longer available | System shows alternatives; user re-customizes |
| `PAYMENT_FAILED` | Card declined or QR not scanned | Booking remains on HOLD | Retry payment (hold extended 5 min once) or cancel |
| `DRAFT_EXPIRED` | Saved draft older than 7 days | Draft deleted | User starts over from package detail |
| `AVAILABILITY_CHANGED` | Between "Save" and "Confirm" | Saved selections no longer valid | User reviews changes and re-confirms |
| `CUSTOMIZATION_INVALID` | Swap violates time constraints (e.g., 2 activities same time slot) | Cannot apply change | Frontend prevents invalid swaps |
| `MAX_GUESTS_EXCEEDED` | Selected transport capacity < travelers | Cannot select that vehicle | Frontend filters out incompatible options |

---

## Edge Cases

### Guest Checkout
- User not authenticated can still customize and save draft (stored in `localStorage`)
- At checkout, `guest_email` required
- Booking linked to email; account creation prompt after payment

### Multi-Package Booking
- User adds multiple packages to one booking
- Each package has its own journey map
- Combined into single checkout with one payment
- `booking_items` contains multiple TRIP entries

### Hold Extension
- User can extend hold once for +5 minutes if payment is in progress
- `POST /bookings/{id}/extend-hold`

### Partial Payment (QR)
- If user scans QR but payment is delayed
- "I've paid" button triggers manual verification check
- Admin can manually confirm if payment is pending

### Network Loss During Customization
- Auto-save draft every 30 seconds
- On reconnect, load latest draft from server
- Local storage backup for offline resilience

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/search` | GET | Search packages |
| `/v1/trips/{slug}` | GET | Package detail with journey map template |
| `/v1/availability/check` | POST | Check real-time availability (cached) |
| `/v1/availability/confirm` | POST | Fresh availability check before checkout |
| `/v1/journey-drafts` | POST | Save customization draft |
| `/v1/journey-drafts` | GET | List saved drafts |
| `/v1/bookings` | POST | Create booking with hold |
| `/v1/payments/intent` | POST | Stripe payment intent |
| `/v1/payments/qr` | POST | Generate QR payment |
| `/v1/bookings/{id}` | GET | Get booking detail |
| `/v1/bookings/{id}/qr` | GET | Get check-in QR code |
| `/v1/bookings/{id}/contacts` | GET | Get driver/guide contacts (24h before) |
| `/v1/bookings/{id}/ical` | GET | iCal export (v1.1) |
| `/v1/webhooks/stripe` | POST | Stripe webhook |
