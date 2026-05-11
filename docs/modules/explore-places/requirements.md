# Explore — Historical Places — Requirements

> **Feature IDs:** F80–F82, F85  
> **Scope:** MVP  
> **Priority:** P1 (F80, F82), P2 (F85)

---

## User Stories

### F80 — Places Directory

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F80-01 | As a traveler, I want to browse a directory of places (temples, museums, nature, markets, beaches) so that I can discover points of interest. | AC1: Places organized by category with filter chips. AC2: Each place card shows photo, name, category, and average rating. AC3: List view with pagination (20 per page). AC4: Map view toggle showing all places as markers. AC5: Places sorted by popularity (default) or alphabetically. |
| US-F80-02 | As a traveler, I want to view detailed information about a place so that I can plan my visit. | AC1: Photo gallery (up to 15 images). AC2: Description, visitor tips, dress code, entry fees. AC3: Opening hours with current day highlighted. AC4: GPS coordinates with "Get Directions" button (opens Google Maps). AC5: Nearby trips that include this place. AC6: Related places in same category/area. |
| US-F80-03 | As a traveler, I want to see entry fees and opening hours so that I can budget and plan my schedule. | AC1: Entry fee displayed in USD/KHR/CNY. AC2: Opening hours shown per day with "Open Now" / "Closed" indicator. AC3: Special holiday hours noted if applicable. |

### F82 — Interactive Maps

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F82-01 | As a traveler, I want to see places on an interactive map so that I can understand their locations. | AC1: Leaflet.js map with OpenStreetMap tiles. AC2: Clustered markers for places in same area. AC3: Click marker opens info card with thumbnail and name. AC4: Map bounds update based on visible results. AC5: User location dot (with permission). AC6: Mobile-optimized touch gestures (pinch zoom, pan). |
| US-F82-02 | As a traveler, I want to filter map markers by category so that I can focus on specific types of places. | AC1: Category filters apply to both list and map views simultaneously. AC2: Map re-centers to show filtered results. AC3: Empty state when no places match filters. |

### F85 — SEO + Open Graph (v1.1)

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F85-01 | As the platform, I want trip and place pages to be SEO-optimized so that they rank well in search engines. | AC1: SSR for all public pages (`/trips/[slug]`, `/places/[slug]`). AC2: Unique `title`, `meta description`, canonical URL per page. AC3: JSON-LD structured data (Trip/TouristAttraction schema). AC4: Sitemap.xml auto-generated at build time. AC5: Robots.txt with disallow on auth routes. |
| US-F85-02 | As a traveler, I want shared links to show rich previews so that my friends see appealing summaries. | AC1: Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`. AC2: Twitter Card tags. AC3: og:image minimum 1200×630, served from CDN. AC4: Image auto-generated from trip/place cover if custom not provided. |

---

## Data Model

### `places` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | |
| `translations` | JSONB | NOT NULL | name, description, visitor_tips, dress_code |
| `category` | VARCHAR(50) | NOT NULL | Temple, Museum, Nature, Market, Beach, Mountain, Other |
| `province` | VARCHAR(50) | NOT NULL | Cambodia province |
| `latitude` | DECIMAL(10, 8) | NOT NULL | |
| `longitude` | DECIMAL(11, 8) | NOT NULL | |
| `cover_image_url` | TEXT | | |
| `gallery_image_urls` | TEXT[] | | Max 15 |
| `entry_fee_usd` | DECIMAL(10,2) | | NULL if free |
| `opening_hours` | JSONB | | `{monday: "07:00-17:00", ...}` |
| `rating_average` | DECIMAL(2,1) | DEFAULT 0 | |
| `rating_count` | INTEGER | DEFAULT 0 | |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `PLACE_001` | 404 | Place not found |
| `PLACE_002` | 400 | Invalid category filter |
| `MAP_001` | 400 | Invalid coordinates |

---

*Aligned with PRD section 7.9 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 16–17, 28–29).*
