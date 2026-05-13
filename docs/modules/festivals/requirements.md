# Festival Calendar & Event Alerts — Requirements

> **Feature ID:** F81
> **Scope:** v1.2
> **Priority:** P2

---

## User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F81-01 | As a traveler, I want to see upcoming cultural festivals in Cambodia so that I can plan my trip around them. | AC1. Calendar view showing festivals by month. AC2. Each festival shows: name, dates, location, description, photo, related trip suggestions. AC3. Filter by: month, province, festival type (religious, cultural, national). AC4. Festival detail page with history, traditions, travel tips. AC5. "Add to Trip" button to create a trip around festival dates. |
| US-F81-02 | As a traveler, I want to receive alerts about upcoming festivals so that I don't miss important events. | AC1. Push notification 2 weeks before festival starts. AC2. In-app notification with festival details and booking CTA. AC3. Alert settings: enable/disable festival alerts, preferred provinces. AC4. Email digest option: monthly festival newsletter. |
| US-F81-03 | As the platform, I want to generate discount codes during festivals so that we can drive bookings. | AC1. Auto-generated discount code created for each festival (e.g., `WATERFEST2026`). AC2. Discount: 10% off trips to festival location during festival dates. AC3. Code valid for bookings during festival period only. AC4. Code promoted in festival detail page and push notification. AC5. Usage tracking per code. |

---

## Data Model

### `festivals` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | |
| `translations` | JSONB | NOT NULL | name, description, history, travel_tips |
| `start_date` | DATE | NOT NULL | |
| `end_date` | DATE | NOT NULL | |
| `location` | VARCHAR(100) | NOT NULL | Primary province/city |
| `latitude` | DECIMAL(10, 8) | | |
| `longitude` | DECIMAL(11, 8) | | |
| `category` | VARCHAR(50) | NOT NULL | Religious, Cultural, National, Regional |
| `image_url` | TEXT | | |
| `is_featured` | BOOLEAN | DEFAULT false | |
| `discount_code_id` | UUID | FK → discount_codes | Auto-generated |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `FESTIVAL_001` | 404 | Festival not found |
| `FESTIVAL_002` | 400 | Invalid date filter |

---

*Aligned with PRD section 7.9 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 16–17, 28–29).*
