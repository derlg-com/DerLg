# Transportation Booking — Requirements

> **Feature ID:** F32  
003e **Scope:** MVP  
003e **Priority:** P0

---

## User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F32-01 | As a traveler, I want to browse available transportation options so that I can choose the right vehicle for my trip. | AC1: Vehicle types: Van (7–15 seats), Bus (25–45 seats), Tuk-Tuk (2–3 seats), Private Car (4 seats). AC2: Each option shows: vehicle type, capacity, photos, amenities (AC, WiFi, luggage space), price per day or per km. AC3: Filter by vehicle type, capacity, AC availability. AC4: Sort by price (low–high) or rating. |
| US-F32-02 | As a traveler, I want to book transportation for specific dates so that I have guaranteed transport during my trip. | AC1: Date picker with start and end dates. AC2: Route input (pickup location → destination, with optional stops). AC3: Real-time availability check: vehicle must not have overlapping bookings. AC4: Price calculated based on vehicle type × days OR distance-based pricing. AC5: Booking hold created for 15 minutes (see my-trip module F35). AC6: Confirmation shows driver name, contact, vehicle plate number (revealed 24h before). |
| US-F32-03 | As a traveler, I want to see transportation included in trip packages so that I don't need to book separately. | AC1: Trip detail page shows included transportation type (if applicable). AC2: Option to upgrade transportation (e.g., from bus to private van) with price delta. AC3: Upgraded transport added as separate line item in booking. |
| US-F32-04 | As a traveler, I want to cancel my transportation booking so that I can get a refund if plans change. | AC1: Cancellation follows tiered refund policy (100% ≥7 days, 50% 1–7 days, 0% <24h). AC2: Cancellation initiated from "My Trips" page. AC3: Refund processed to original payment method (see payments module F44). |

---

## Data Model

### `transportation_vehicles` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `type` | VARCHAR(50) | NOT NULL | VAN, BUS, TUK_TUK, PRIVATE_CAR |
| `name` | VARCHAR(255) | NOT NULL | e.g., "Comfort Van — Toyota HiAce" |
| `capacity` | INTEGER | NOT NULL | Max passengers |
| `price_per_day_usd` | DECIMAL(10,2) | | NULL if distance-based only |
| `price_per_km_usd` | DECIMAL(10,2) | | NULL if day-based only |
| `has_ac` | BOOLEAN | DEFAULT false | |
| `has_wifi` | BOOLEAN | DEFAULT false | |
| `luggage_capacity` | VARCHAR(50) | | e.g., "2 large suitcases" |
| `image_urls` | TEXT[] | | |
| `description` | TEXT | | |
| `rating_average` | DECIMAL(2,1) | DEFAULT 0 | |
| `rating_count` | INTEGER | DEFAULT 0 | |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `transportation_bookings` Table (extends bookings)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `booking_id` | UUID | PK, FK → bookings | |
| `vehicle_id` | UUID | FK → transportation_vehicles | |
| `start_date` | DATE | NOT NULL | |
| `end_date` | DATE | NOT NULL | |
| `pickup_location` | TEXT | NOT NULL | |
| `dropoff_location` | TEXT | NOT NULL | |
| `stops` | TEXT[] | | Optional intermediate stops |
| `estimated_distance_km` | INTEGER | | |
| `driver_id` | UUID | FK → drivers | Revealed 24h before |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Pricing Models

| Vehicle Type | Pricing Model | Example |
|-------------|---------------|---------|
| Van | Per day | $80/day |
| Bus | Per day | $150/day |
| Tuk-Tuk | Per km or half-day/full-day | $15 half-day, $25 full-day |
| Private Car | Per day | $60/day |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `TRANS_001` | 404 | Vehicle not found |
| `TRANS_002` | 409 | Vehicle not available for selected dates |
| `TRANS_003` | 400 | Invalid date range (end before start) |
| `TRANS_004` | 400 | Pickup/dropoff location required |

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 7).*
