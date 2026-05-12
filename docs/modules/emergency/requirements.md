# Emergency & Safety System — Requirements

> **Feature IDs:** F50–F52
> **Scope:** v1.2
> **Priority:** P1 (F50, F52), P2 (F51)

---

## User Stories

### F50 — Emergency SOS Alert

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F50-01 | As a traveler, I want to send an SOS alert with my GPS location so that I can get emergency help quickly. | AC1: SOS button prominently accessible from app shell (persistent floating button). AC2: 5-second countdown with cancel option to prevent accidental triggers. AC3: Alert includes: GPS coordinates (lat/lng, accuracy), alert type (SOS, MEDICAL, THEFT, LOST), user profile info, emergency contact. AC4: Push notification + SMS sent to support team. AC5: In-app acknowledgment shown when alert received by support. AC6: Alert status tracked: SENT, ACKNOWLEDGED, RESOLVED. AC7: Follow-up prompt: "Are you safe now?" after 30 minutes. |
| US-F50-02 | As a support team member, I want to receive and manage emergency alerts so that I can respond effectively. | AC1: Real-time alert dashboard with map showing all active alerts. AC2. Each alert shows: user name, location, type, timestamp, contact info. AC3. Actions: Acknowledge, Contact User, Mark Resolved, Escalate. AC4. Alert sound/notification for new unacknowledged alerts. AC5. Auto-escalation to supervisor if not acknowledged within 5 minutes. |

### F51 — Location Sharing with Family

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F51-01 | As a traveler, I want to share my live location with family so that they know I'm safe. | AC1. "Share Location" button generates unique tracking link. AC2. Link expiry options: 24 hours, 3 days, trip duration. AC3. Link can be shared via WhatsApp, WeChat, SMS, email. AC4. Recipients see map with live location dot (updates every 5 minutes). AC5. Location history trail shown (last 24 hours). AC6. User can revoke sharing at any time. AC7. Battery-efficient background location tracking (no continuous GPS drain). |

### F52 — Province-Specific Emergency Contacts

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F52-01 | As a traveler, I want to see emergency contacts for my current province so that I can call for help. | AC1. Emergency contacts page shows: Police, Hospital, Fire, Tourist Police for current or selected province. AC2. All 25 Cambodia provinces covered. AC3. One-tap dial for each contact. AC4. Contacts available offline (cached in app). AC5. GPS auto-detects current province; manual override supported. AC6. Addresses shown in local language + English. |

---

## Data Model

### `emergency_alerts` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `type` | VARCHAR(20) | NOT NULL | SOS, MEDICAL, THEFT, LOST |
| `latitude` | DECIMAL(10, 8) | NOT NULL | |
| `longitude` | DECIMAL(11, 8) | NOT NULL | |
| `accuracy_meters` | INTEGER | | GPS accuracy |
| `status` | VARCHAR(20) | DEFAULT 'SENT' | SENT, ACKNOWLEDGED, RESOLVED, ESCALATED |
| `acknowledged_by` | UUID | FK → users (admin) | |
| `acknowledged_at` | TIMESTAMPTZ | | |
| `resolved_at` | TIMESTAMPTZ | | |
| `notes` | TEXT | | Support team notes |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

### `location_shares` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users | |
| `token` | VARCHAR(255) | UNIQUE, NOT NULL | Shareable link token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `revoked_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

### `location_updates` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `share_id` | UUID | FK → location_shares | |
| `latitude` | DECIMAL(10, 8) | NOT NULL | |
| `longitude` | DECIMAL(11, 8) | NOT NULL | |
| `accuracy_meters` | INTEGER | | |
| `recorded_at` | TIMESTAMPTZ | DEFAULT now() | |

### `emergency_contacts` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `province` | VARCHAR(50) | NOT NULL | |
| `contact_type` | VARCHAR(30) | NOT NULL | POLICE, HOSPITAL, FIRE, TOURIST_POLICE |
| `name_en` | VARCHAR(255) | | |
| `name_km` | VARCHAR(255) | | |
| `phone` | VARCHAR(20) | NOT NULL | |
| `address_en` | TEXT | | |
| `address_km` | TEXT | | |
| `latitude` | DECIMAL(10, 8) | | |
| `longitude` | DECIMAL(11, 8) | | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `EMERGENCY_001` | 400 | GPS location unavailable |
| `EMERGENCY_002` | 403 | Location sharing revoked |
| `EMERGENCY_003` | 404 | Emergency contacts not found for province |

---

*Aligned with PRD section 7.6 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 12, 31).*
