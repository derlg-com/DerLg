# Tour Guide Booking — Requirements

> **Feature ID:** F33  
> **Scope:** MVP  
> **Priority:** P0

---

## User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F33-01 | As a traveler, I want to browse verified tour guides so that I can find a knowledgeable local expert. | AC1: Guide cards show: photo, name, languages spoken, specialties, rating, price per day. AC2: Filter by: language (EN, ZH, KM), specialty (Temples, Nature, Food, History), location (province), gender. AC3: Sort by: recommended, rating, price. AC4: "Verified" badge for guides who passed background check. AC5: Pagination: 20 per page. |
| US-F33-02 | As a traveler, I want to view a guide's profile so that I can learn about their experience and reviews. | AC1: Photo gallery (up to 10 images). AC2: Bio, experience (years), languages, specialties. AC3: Reviews from past travelers with verified-booking badge. AC4: Average rating and total review count. AC5: Price per day with currency selector. AC6: Availability calendar. AC7: "Book This Guide" CTA. |
| US-F33-03 | As a traveler, I want to book a tour guide for specific dates so that I have a dedicated guide during my trip. | AC1: Date picker for booking dates. AC2: Optional: link to an existing trip booking or book standalone. AC3: Real-time availability check (guide must not have overlapping bookings). AC4: Price = daily rate × number of days. AC5: 15-minute booking hold. AC6: Confirmation with guide contact (revealed 24h before). AC7: Option to add special requests (dietary, accessibility, interests). |
| US-F33-04 | As a solo female traveler, I want to filter for female guides so that I feel more comfortable. | AC1: Gender filter on guide listing. AC2: Female-friendly guide badge for guides with positive reviews from female travelers. |

---

## Data Model

### `guides` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | Nullable (guides may not have app accounts) |
| `name` | VARCHAR(255) | NOT NULL | |
| `bio` | JSONB | NOT NULL | Translated bio per language |
| `photo_url` | TEXT | | Primary photo |
| `gallery_image_urls` | TEXT[] | | Max 10 |
| `languages` | TEXT[] | NOT NULL | EN, ZH, KM |
| `specialties` | TEXT[] | NOT NULL | Temples, Nature, Food, History, Adventure |
| `location` | VARCHAR(100) | NOT NULL | Primary province |
| `gender` | VARCHAR(20) | | Male, Female, Other |
| `experience_years` | INTEGER | | |
| `price_per_day_usd` | DECIMAL(10,2) | NOT NULL | |
| `is_verified` | BOOLEAN | DEFAULT false | Background check passed |
| `rating_average` | DECIMAL(2,1) | DEFAULT 0 | |
| `rating_count` | INTEGER | DEFAULT 0 | |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, SUSPENDED |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `guide_bookings` Table (extends bookings)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `booking_id` | UUID | PK, FK → bookings | |
| `guide_id` | UUID | FK → guides | |
| `start_date` | DATE | NOT NULL | |
| `end_date` | DATE | NOT NULL | |
| `linked_trip_booking_id` | UUID | FK → bookings | Optional link to trip package |
| `special_requests` | TEXT | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `GUIDE_001` | 404 | Guide not found |
| `GUIDE_002` | 409 | Guide not available for selected dates |
| `GUIDE_003` | 400 | Invalid date range |
| `GUIDE_004` | 403 | Guide is suspended or inactive |

---

*Aligned with PRD section 7.4 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 8).*
