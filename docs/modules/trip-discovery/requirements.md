# Trip Discovery & Smart Suggestions — Requirements

> **Feature IDs:** F20–F26  
> **Scope:** MVP (F26: v1.1)  
> **Priority:** P0 (F20–F25), P2 (F26)

---

## User Stories

### F20 — Featured Trips Home Screen

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F20-01 | As a traveler, I want to see featured trips on the home screen so that I can discover popular options quickly. | AC1: Hero section with 3–5 curated featured trips. AC2: Each trip card shows cover image, name, duration, price (USD), and rating. AC3: Cards are tappable and navigate to trip detail. AC4: Featured trips are configurable via admin/CMS flag `is_featured`. AC5: Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop. |
| US-F20-02 | As a traveler, I want to see trip categories on the home screen so that I can browse by interest. | AC1: Horizontal scrollable category icons: Temples, Nature, Culture, Adventure, Food. AC2: Each category filters the trip list below. AC3: Category count badge shows number of trips available. |

### F21 — Trip Detail Pages

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F21-01 | As a traveler, I want to view a detailed trip page so that I can understand the full itinerary before booking. | AC1: Photo gallery with lightbox (up to 20 images). AC2: Day-by-day itinerary with titles, descriptions, and time estimates. AC3: Included/excluded items list. AC4: Cancellation policy display. AC5: Meeting point with map embed. AC6: Price per person with currency selector (USD/KHR/CNY). AC7: "Book Now" CTA button. AC8: Reviews section with average rating and review count. |
| US-F21-02 | As a traveler, I want to see related trips so that I can compare options. | AC1: "You might also like" section at bottom of detail page. AC2: Related trips based on same category and location. AC3: Max 4 related trips shown. |

### F22 — Category Filtering

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F22-01 | As a traveler, I want to filter trips by category so that I can find trips matching my interests. | AC1: Categories: Temples, Nature, Culture, Adventure, Food. AC2: Multiple categories can be selected (OR logic). AC3: Filter state reflected in URL query params for shareability. AC4: Results update without full page reload. AC5: Empty state with "No trips found" message and clear filters button. |
| US-F22-02 | As a traveler, I want to sort trip results so that I can find the best option for me. | AC1: Sort options: Featured (default), Price (low–high), Price (high–low), Duration (short–long), Rating (high–low). AC2: Sort state persisted in URL. |

### F23 — Search with Autocomplete

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F23-01 | As a traveler, I want to search for trips, places, hotels, and guides with autocomplete so that I can find what I need quickly. | AC1: Search bar in header, accessible from any page. AC2: Debounced input (300ms) triggers autocomplete. AC3: Autocomplete shows mixed results: trips, places, hotels, guides — grouped by type. AC4: Each result shows icon, name, and type label. AC5: Max 8 results in dropdown. AC6: Keyboard navigable (arrow keys + Enter). AC7: Full-text search across `name`, `description`, and `tags`. |
| US-F23-02 | As a traveler, I want to see search results in a dedicated page so that I can browse all matches. | AC1: Pressing Enter or "See all results" navigates to `/search?q=...`. AC2: Results page shows tabs by entity type (All, Trips, Places, Hotels, Guides). AC3: Pagination: 20 results per page. |

### F24 — Reviews & Ratings (v1.2 per PRD, but module covers the structure)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F24-01 | As a traveler, I want to read reviews from other travelers so that I can make informed booking decisions. | AC1: Reviews shown on trip detail page. AC2: Each review shows: star rating (1–5), text (max 1000 chars), date, reviewer name, verified-booking badge. AC3: Up to 5 photos per review. AC4: Average rating and total count displayed prominently. AC5: Pagination: 10 reviews per page. |
| US-F24-02 | As a verified traveler, I want to leave a review after my trip so that I can share my experience. | AC1: Review form available 24h after trip end date for confirmed bookings. AC2: Must have completed booking to leave review (verified badge). AC3: Earn 50 loyalty points for first review per booking. AC4: Reviews can be edited within 7 days; deletion supported. |

### F25 — Favorites / Wishlist

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F25-01 | As a traveler, I want to save trips to my wishlist so that I can return to them later. | AC1: Heart icon on trip cards and detail pages. AC2: Toggle on/off with animation. AC3: For authenticated users: synced to server (`user_favorites` table). AC4: For guests: stored in localStorage. AC5: Guest favorites migrate to account on login. AC6: Wishlist accessible from profile/nav. AC7: Max 100 favorites per user. |

### F26 — Social Sharing (v1.1)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F26-01 | As a traveler, I want to share a trip with friends so that we can plan together. | AC1: Share button on trip detail page. AC2: Generates shareable link with Open Graph metadata. AC3: QR code generation for offline sharing. AC4: WeChat/WhatsApp share intents on mobile. AC5: Link preview shows trip image, name, and price. |

---

## Data Model

### `trips` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | URL-friendly identifier |
| `translations` | JSONB | NOT NULL | name, description, itinerary_days |
| `category` | VARCHAR(50) | NOT NULL | Temples, Nature, Culture, Adventure, Food |
| `duration_days` | INTEGER | NOT NULL | |
| `price_usd` | DECIMAL(10,2) | NOT NULL | Base price per person |
| `max_guests` | INTEGER | NOT NULL | |
| `location` | VARCHAR(100) | NOT NULL | Primary province/area |
| `cover_image_url` | TEXT | NOT NULL | |
| `gallery_image_urls` | TEXT[] | | Up to 20 images |
| `is_featured` | BOOLEAN | DEFAULT false | |
| `rating_average` | DECIMAL(2,1) | DEFAULT 0 | Denormalized cache |
| `rating_count` | INTEGER | DEFAULT 0 | Denormalized cache |
| `included_items` | TEXT[] | | |
| `excluded_items` | TEXT[] | | |
| `meeting_point` | TEXT | | GPS + description |
| `cancellation_policy` | TEXT | NOT NULL | |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, DRAFT |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `trip_reviews` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `trip_id` | UUID | FK → trips | |
| `user_id` | UUID | FK → users | |
| `booking_id` | UUID | FK → bookings | Verified booking reference |
| `rating` | INTEGER | NOT NULL, CHECK 1–5 | |
| `text` | TEXT | | Max 1000 chars |
| `photo_urls` | TEXT[] | | Max 5 images |
| `is_verified` | BOOLEAN | DEFAULT false | Set if booking_id exists |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `user_favorites` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `user_id` | UUID | FK → users | |
| `trip_id` | UUID | FK → trips | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| PRIMARY KEY | (`user_id`, `trip_id`) | | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `TRIP_001` | 404 | Trip not found or inactive |
| `TRIP_002` | 400 | Invalid category filter |
| `TRIP_003` | 400 | Invalid sort parameter |
| `REVIEW_001` | 403 | User has no completed booking for this trip |
| `REVIEW_002` | 400 | Review text exceeds 1000 characters |
| `FAVORITE_001` | 400 | Favorite limit exceeded (100) |

---

*Aligned with PRD section 7.3 and `.kiro/specs/frontend-nextjs-implementation/requirements.md` (Req 3, 5, 20, 21, 22, 36).*
