# Hotel Booking — Requirements

> **Feature ID:** F31  
> **Scope:** MVP  
> **Priority:** P0

---

## User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F31-01 | As a traveler, I want to browse hotels so that I can find suitable accommodation. | AC1: Hotel cards show: name, cover photo, star rating, location, price per night, amenities icons. AC2: Filter by: location (province/area), price range, star rating, amenities (pool, WiFi, breakfast, AC). AC3: Sort by: recommended (default), price (low–high), price (high–low), rating. AC4: Pagination: 20 per page. |
| US-F31-02 | As a traveler, I want to view hotel details and room options so that I can choose the right room. | AC1: Photo gallery (up to 20 images). AC2: Hotel description, amenities list, policies (check-in/out times, cancellation). AC3: Room types displayed with: name, photos, bed configuration, max occupancy, size (sqm), amenities, price per night. AC4: Room availability calendar showing booked/unavailable dates. AC5: Map showing hotel location. |
| US-F31-03 | As a traveler, I want to book a hotel room for specific dates so that I have guaranteed accommodation. | AC1: Date picker for check-in and check-out. AC2: Room type selector with occupancy validation (adults/children). AC3: Real-time availability check per room type and date range. AC4: Price breakdown: nightly rate × nights + taxes/fees. AC5: Booking hold for 15 minutes. AC6: Confirmation with booking reference, hotel contact, check-in instructions. |
| US-F31-04 | As a traveler, I want to see hotels included in trip packages so that I don't need to book separately. | AC1: Trip detail shows default hotel (if package includes accommodation). AC2: Option to upgrade room type with price delta. AC3: Option to browse alternative hotels for the same trip with price adjustment. |

---

## Data Model

### `hotels` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | |
| `translations` | JSONB | NOT NULL | name, description |
| `location` | VARCHAR(100) | NOT NULL | Province/area |
| `address` | TEXT | NOT NULL | Full address |
| `star_rating` | DECIMAL(2,1) | | 1.0–5.0 |
| `latitude` | DECIMAL(10, 8) | | |
| `longitude` | DECIMAL(11, 8) | | |
| `cover_image_url` | TEXT | | |
| `gallery_image_urls` | TEXT[] | | Max 20 |
| `amenities` | TEXT[] | | Pool, WiFi, Breakfast, AC, Parking, Spa, Gym |
| `check_in_time` | TIME | DEFAULT '14:00' | |
| `check_out_time` | TIME | DEFAULT '12:00' | |
| `cancellation_policy` | TEXT | | |
| `rating_average` | DECIMAL(2,1) | DEFAULT 0 | |
| `rating_count` | INTEGER | DEFAULT 0 | |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `hotel_rooms` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `hotel_id` | UUID | FK → hotels | |
| `name` | VARCHAR(255) | NOT NULL | e.g., "Deluxe Double Room" |
| `description` | TEXT | | |
| `bed_configuration` | VARCHAR(100) | | e.g., "1 King Bed" |
| `max_occupancy` | INTEGER | NOT NULL | |
| `size_sqm` | INTEGER | | |
| `amenities` | TEXT[] | | Room-specific amenities |
| `image_urls` | TEXT[] | | |
| `price_per_night_usd` | DECIMAL(10,2) | NOT NULL | |
| `total_rooms` | INTEGER | NOT NULL | Inventory count |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `hotel_bookings` Table (extends bookings)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `booking_id` | UUID | PK, FK → bookings | |
| `hotel_id` | UUID | FK → hotels | |
| `room_id` | UUID | FK → hotel_rooms | |
| `check_in_date` | DATE | NOT NULL | |
| `check_out_date` | DATE | NOT NULL | |
| `guests_adults` | INTEGER | NOT NULL | |
| `guests_children` | INTEGER | DEFAULT 0 | |
| `special_requests` | TEXT | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Availability Logic

For a given `room_id` and date range, available if:
```
sum(confirmed_bookings_for_room_on_date) + new_booking_rooms <= total_rooms
```

This is checked per night in the date range.

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `HOTEL_001` | 404 | Hotel not found |
| `HOTEL_002` | 404 | Room type not found |
| `HOTEL_003` | 409 | Room not available for selected dates |
| `HOTEL_004` | 400 | Exceeds max occupancy for room type |
| `HOTEL_005` | 400 | Invalid date range (check-out before check-in) |

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 6).*
