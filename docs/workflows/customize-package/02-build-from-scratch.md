# Private Tour — Build from Scratch

> **User Journey:** Traveler starts with a blank slate, fills basic requirements, and builds a custom private tour day-by-day via an auto-generated skeleton + per-day customization.  
> **Scope:** MVP  
> **Feature IDs:** TBD

---

## Overview

This workflow covers the "build from scratch" private tour path. Unlike prebuilt templates, the user starts with zero itinerary. They answer a short intake form, the system generates a day-by-day skeleton roadmap, and the user customizes each day before locking in the final journey map.

**Key difference from prebuilt packages:**
- Starts blank — no admin-created template
- System generates a skeleton based on traveler profile and preferences
- Per-day wizard: customize Day 1, then Day 2, etc. (fast, focused)
- Final canvas assembles into a visual journey map
- Post-trip: location reviews + public journey sharing for inspiration

---

## Phase 1: Basics Form

**User Action:** Taps "Build Your Own Trip" or "Customize a Trip" from the home screen.

**System:** Redirects to the basics form page.

### Form Fields

| Field | Type | Validation | Used For |
|-------|------|------------|----------|
| **Travel dates** | Date range picker | Start date >= tomorrow, max 30 days | Skeleton generation, availability checks |
| **Number of travelers** | Counter (adults + children) | Adults >= 1, total <= 20 | Group size, transport capacity, kid-friendly filter |
| **Has children** | Toggle | — | Enables kid-friendly activity filtering |
| **Children ages** | Multi-select (if toggle on) | 0–17 | Car seat, activity suitability, pricing |
| **Trip style** | Single-select | Adventure / Cultural / Relaxation / Family / Mixed | Skeleton theme weighting |
| **Budget range** | Slider or select | Min 100 USD | Budget tracker, hotel/activity tier filtering |
| **Preferred languages** | Multi-select | en, zh, km, etc. | Guide matching |
| **Mobility needs** | Multi-select (optional) | Wheelchair / Elderly / None | Accessibility filter |
| **Dietary restrictions** | Multi-select (optional) | Halal / Vegan / Gluten-free / None | Meal plan tagging |
| **Destinations** | Multi-select or map pick | Max 5 provinces | Skeleton routing |
| **Must-see landmarks** | Tag input (optional) | Free text, auto-complete from DB | Priority placement in skeleton |

### Form Submission

```
POST /v1/trips/build-from-scratch/basics
Headers: Accept-Language: en
Body: {
  "start_date": "2026-06-15",
  "end_date": "2026-06-18",
  "travelers": { "adults": 2, "children": 2, "children_ages": [5, 8] },
  "trip_style": "FAMILY",
  "budget_usd": 1200,
  "languages": ["en", "zh"],
  "mobility_needs": [],
  "dietary_restrictions": [],
  "destinations": ["Siem Reap", "Phnom Penh"],
  "must_see": ["Angkor Wat", "Killing Fields"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "sess-uuid",
    "generated_skeleton": {
      "trip_id": "trip-uuid",
      "duration_days": 4,
      "days": [
        {
          "day_number": 1,
          "suggested_destination": "Siem Reap",
          "theme": "Arrival & Temples",
          "suggested_activities": [
            { "id": "act-1", "name": "Hotel Check-in", "type": "TRANSFER" },
            { "id": "act-2", "name": "Angkor Wat Sunset", "type": "ACTIVITY" }
          ],
          "suggested_hotel": { "id": "htl-1", "name": "Family Resort Siem Reap" },
          "suggested_transport": { "id": "trn-1", "type": "PRIVATE_VAN" },
          "meals_included": ["breakfast"]
        },
        {
          "day_number": 2,
          "suggested_destination": "Siem Reap",
          "theme": "Temple Exploration",
          "suggested_activities": [...]
        },
        {
          "day_number": 3,
          "suggested_destination": "Phnom Penh",
          "theme": "History & Culture",
          "suggested_activities": [...]
        },
        {
          "day_number": 4,
          "suggested_destination": "Phnom Penh",
          "theme": "Departure",
          "suggested_activities": [...]
        }
      ],
      "estimated_total_usd": 1150.00,
      "estimated_breakdown": {
        "activities": 400.00,
        "hotels": 450.00,
        "transport": 200.00,
        "guides": 100.00
      }
    }
  }
}
```

---

## Phase 2: Per-Day Customization Wizard

**User Action:** Reviews the auto-generated skeleton, then taps "Customize Day-by-Day."

**System:** Enters per-day customization mode. Each day is presented as a focused card/step.

### Day Customization Screen

For each day, the user sees:
- Day number and date
- Destination (editable — pick from destination pool or map)
- Activity list (add/skip/swap from activity pool)
- Hotel (change from hotel pool)
- Transport (change from transport pool)
- Guide (add/change from guide pool)
- Meals included toggle
- Price delta for this day

### Customization Actions per Day

| Action | User Does | System Does | Price Impact |
|--------|-----------|-------------|--------------|
| Change destination | Taps destination, picks from map or list | Re-suggests activities for new location; validates travel time from previous day | Varies |
| Add activity | Selects from `activity_pool` filtered by destination + kid-friendly + accessibility | Checks availability (cached 2 min) | Increase |
| Skip activity | Removes checkmark | Recalculates day total | Decrease |
| Swap activity | Replaces one with another | Checks availability | Varies |
| Change hotel | Selects from `hotel_pool` | Checks room availability for date | Increase/decrease |
| Change transport | Selects vehicle type | Checks fleet availability | Increase/decrease |
| Add/change guide | Filters by language + location | Shows guide options + reviews | Increase |
| Reorder activities | Drag to reorder within day | Validates time constraints (opening hours, travel between venues) | Neutral |
| Add meal | Toggles lunch/dinner inclusion | Adds to day total | Increase |

### Navigation Between Days

```
[Day 1] ← → [Day 2] ← → [Day 3] ← → [Day 4]
   ↑                                              
[Overview] — shows all days at a glance
```

User can jump to any day, or view the "Overview" which shows all days in a vertical timeline with map pins.

### Availability Check per Change

Same endpoint as prebuilt packages:
```
POST /v1/availability/check
Body: {
  "checks": [
    { "type": "HOTEL", "id": "htl-2", "check_in": "2026-06-15", "check_out": "2026-06-16", "rooms": 1 },
    { "type": "TRANSPORT", "id": "trn-2", "start_date": "2026-06-15", "end_date": "2026-06-17" },
    { "type": "ACTIVITY", "id": "act-5", "date": "2026-06-15" }
  ]
}
```

### Running Budget Tracker

Fixed header bar shows:
```
Budget: $1,200    Spent: $1,150    Remaining: $50    [🟢 On Track]
```

Color coding:
- 🟢 Green: within budget
- 🟡 Yellow: within 10% of budget
- 🔴 Red: over budget (blocks adding more items until user removes something or increases budget)

### Save Draft

User can save progress at any day:
```
POST /v1/journey-drafts
Headers: Authorization: Bearer <jwt>
Body: {
  "session_id": "sess-uuid",
  "title": "My Family Cambodia Trip",
  "days": [...],
  "total_price_usd": 1150.00,
  "budget_usd": 1200.00
}
```

---

## Phase 3: Final Journey Map Assembly

**User Action:** Finishes customizing all days, taps "Review My Journey."

**System:** Assembles all days into a visual journey map (canvas view).

### Journey Map Canvas

```
┌─────────────────────────────────────────────────────────┐
│  🗺️ Cambodia Map                                        │
│                                                         │
│     Siem Reap ●──────● Phnom Penh                       │
│      Day 1-2        Day 3-4                             │
│         ↓                                               │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Day 1: Arrival│  │ Day 3: History│                   │
│  │ Angkor Wat    │  │ Killing Fields│                   │
│  │ Family Hotel  │  │ City Hotel   │                    │
│  └──────────────┘  └──────────────┘                     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Day 2: Temples│  │ Day 4: Depart │                   │
│  │ Bayon, Ta Prohm│  │ Airport      │                   │
│  │ Family Hotel  │  │              │                     │
│  └──────────────┘  └──────────────┘                     │
│                                                         │
│  [Edit Day 1] [Edit Day 2] [Edit Day 3] [Edit Day 4]    │
│                                                         │
│  Total: $1,150 | Budget: $1,200 | Travelers: 4          │
│                                                         │
│         [✏️ Back to Edit]    [✅ Confirm & Book]         │
└─────────────────────────────────────────────────────────┘
```

**Canvas features:**
- Map with route lines between destinations
- Estimated travel time between cities shown on route lines
- Day cards are clickable to jump back to per-day editing
- Photo thumbnails for each activity/hotel
- Weather forecast for each day (if within 14 days)

### Confirm

User taps "Confirm & Book":
```
POST /v1/availability/confirm
Body: { "draft_id": "draft-uuid" }
```

Fresh availability check runs across all days. If anything changed:
- Shows which items are no longer available
- Offers alternatives directly on the canvas
- User accepts alternatives or goes back to edit

If all valid, proceeds to checkout.

---

## Phase 4: Checkout & Payment

Identical to prebuilt private packages.

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
        "travelers": { "adults": 2, "children": 2, "children_ages": [5, 8] },
        "start_date": "2026-06-15",
        "end_date": "2026-06-18",
        "trip_type": "PRIVATE",
        "trip_source": "BUILD_FROM_SCRATCH",
        "custom_journey_map": { /* final assembled itinerary */ },
        "budget_usd": 1200,
        "total_price_usd": 1150.00
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

Webhook handling same as public/private prebuilt packages.

---

## Phase 5: Confirmation & Ticket

Same as prebuilt packages:
- Booking status: `CONFIRMED`
- Final journey map displayed in app
- QR check-in ticket generated
- Confirmation email + push notification
- Driver/guide contact revealed 24h before trip

---

## Phase 6: Post-Trip — Reviews & Journey Sharing

**Triggered:** After trip `end_date` has passed + 24 hours.

### Location Reviews

User receives a prompt: "How was Angkor Wat?" for each location visited.

```
POST /v1/reviews/location
Headers: Authorization: Bearer <jwt>
Body: {
  "booking_id": "booking-uuid",
  "location_id": "loc-uuid",
  "rating": 5,
  "comment": "Absolutely magical at sunrise!",
  "photos": ["https://cdn.derlg.com/..."],
  "tags": ["family-friendly", "must-see"]
}
```

### Journey Sharing

User can choose to share their complete journey publicly:

```
POST /v1/journeys/share
Headers: Authorization: Bearer <jwt>
Body: {
  "booking_id": "booking-uuid",
  "title": "4-Day Family Cambodia Adventure",
  "is_public": true,
  "include_reviews": true,
  "include_photos": true,
  "include_budget": false
}
```

**Shared journey page:**
- Public URL: `/journeys/{share_slug}`
- Shows the full day-by-day itinerary (anonymized — no personal info)
- Shows user's location reviews and photos
- Shows total budget range (if user opted in)
- "Use this as inspiration" button — copies skeleton to new user's basics form
- Like / save count

**Discovery:** Shared journeys appear in a "Traveler Stories" or "Inspiration" section of the app, browsable by trip style, budget range, and duration.

---

## Reliability Guardrails

### Real-Time Travel Time & Distance Validation
- Route lines on canvas show estimated drive/flight time
- Warns if activities are too far apart within a single day
- Prevents impossible day structures (e.g., 3-hour drive between morning and afternoon activities with only 1-hour gap)

### Opening Hours & Seasonal Availability
- Activities gray out if chosen date falls on a closure day or holiday
- Monsoon season warnings for outdoor activities
- Temple pass validity checks (e.g., Angkor pass is 1-day, 3-day, or 7-day)

### Budget Cap with Live Tracker
- Header bar shows running total vs. budget
- Red state blocks adding more items
- User can tap to increase budget or remove items

### Popular Place Recommendations
- Activity pool surfaces "Most Popular" and "Traveler Favorite" badges
- Sorted by rating, booking count, and relevance to trip style
- AI concierge nudge: "Families also loved..."

### Group Size Enforcement
- Transport options filtered by passenger count (van vs. bus vs. car)
- Hotel room suggestions match group size (family suite vs. twin rooms)
- Kid-friendly activities filtered when children are present

---

## Error Handling

| Error | When | User Impact | Recovery |
|-------|------|-------------|----------|
| `HOLD_EXPIRED` | 15 min elapsed without payment | Booking cancelled, inventory released | Re-confirm and re-checkout |
| `INVENTORY_CONFLICT` | Item sold out during customization | Activity/hotel/transport no longer available | Show alternatives; user re-customizes |
| `PAYMENT_FAILED` | Card declined or QR not scanned | Booking remains on HOLD | Retry payment (hold extended 5 min once) or cancel |
| `BUDGET_EXCEEDED` | User tries to add item over budget | Cannot add item | Remove items or increase budget |
| `TRAVEL_TIME_INVALID` | Activities too far apart in one day | Cannot save day structure | Reorder activities or change destination |
| `DESTINATION_UNREACHABLE` | No transport route between consecutive days | Cannot proceed | Change destination order or add travel day |
| `GUIDE_UNAVAILABLE` | Selected guide not available for date | Guide option removed | Pick alternative guide or skip |

---

## Edge Cases

### Skeleton Re-Generation
- If user drastically changes destinations mid-customization (e.g., removes all Siem Reap days), system offers to re-generate the skeleton for remaining days
- User can decline and build manually

### Multi-City Transport Gaps
- If Day 2 is in Siem Reap and Day 3 is in Phnom Penh, system auto-suggests:
  - Flight (fastest, most expensive)
  - Private van (scenic, mid-price)
  - Bus (budget, longest)
- User picks one; it becomes a "travel activity" on the transition day

### Budget Change Mid-Customization
- User can edit budget anytime from the header
- Previously added items are not removed if budget is lowered; new additions are blocked

### Incomplete Days
- User can proceed to "Review My Journey" with incomplete days
- Incomplete days are flagged with a warning; user can still book but sees "Day 3: Not planned yet"

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/trips/build-from-scratch/basics` | POST | Submit basics form, generate skeleton |
| `/v1/trips/build-from-scratch/skeleton` | GET | Retrieve generated skeleton |
| `/v1/availability/check` | POST | Check real-time availability (cached) |
| `/v1/availability/confirm` | POST | Fresh availability check before checkout |
| `/v1/journey-drafts` | POST | Save customization draft |
| `/v1/journey-drafts` | GET | List saved drafts |
| `/v1/bookings` | POST | Create booking with hold |
| `/v1/payments/intent` | POST | Stripe payment intent |
| `/v1/payments/qr` | POST | Generate QR payment |
| `/v1/bookings/{id}` | GET | Get booking detail |
| `/v1/reviews/location` | POST | Post location review |
| `/v1/journeys/share` | POST | Share journey publicly |
| `/v1/journeys?public=true` | GET | Browse public traveler journeys |
