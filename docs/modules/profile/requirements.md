# User Profile & Account Settings — Requirements

> **Feature IDs:** F01–F06  
> **Scope:** MVP  
> **Priority:** P0

---

## User Stories

### F01 — Email/Password Registration & Login

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F01-01 | As a traveler, I want to register with my email and password so that I can create an account. | AC1: Registration requires email (valid format) and password (min 8 chars, 1 uppercase, 1 number). AC2: Email must be unique; duplicate returns 409. AC3: Verification email sent via Supabase Auth. AC4: Account created in `users` table with `role = USER` and `email_verified = false`. |
| US-F01-02 | As a traveler, I want to log in with my email and password so that I can access my account. | AC1: Valid credentials return access token (JWT, 15 min expiry) and set refresh token cookie (httpOnly, Secure, SameSite=Strict, 7 days). AC2: Invalid credentials return 401 with generic message. AC3: Unverified email returns 403 with "verify your email" message. |

### F02 — Google OAuth Login

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F02-01 | As a traveler, I want to log in with my Google account so that I can avoid creating a password. | AC1: OAuth redirect to Google consent screen. AC2: On success, account created (if new) or linked (if existing). AC3: Returns same JWT + refresh cookie flow as F01. AC4: `avatar_url` populated from Google profile if available. |

### F03 — JWT Token Refresh

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F03-01 | As a traveler, I want my session to stay active without re-logging in so that my experience is seamless. | AC1: Access token expires after 15 minutes. AC2: Refresh token expires after 7 days. AC3: `POST /v1/auth/refresh` with valid refresh cookie returns new access token. AC4: Refresh token rotation: new refresh token issued, old one invalidated (token versioning). AC5: Logout invalidates all refresh tokens for the user. |

### F04 — Password Reset Flow

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F04-01 | As a traveler, I want to reset my password via email so that I can regain access if I forget it. | AC1: `POST /v1/auth/forgot-password` sends reset link to registered email (if exists — silent success regardless). AC2: Reset link expires after 1 hour. AC3: `POST /v1/auth/reset-password` with valid token updates password. AC4: New password cannot match last 3 passwords. AC5: All refresh tokens invalidated on password reset. |

### F05 — User Profile Management

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F05-01 | As a traveler, I want to update my profile (name, phone, avatar, emergency contact, preferred language) so that my account reflects my preferences. | AC1: `PATCH /v1/users/me` accepts `name`, `phone`, `preferred_language` (EN\|ZH\|KM), `emergency_contact_name`, `emergency_contact_phone`. AC2: Avatar upload to Supabase Storage (max 5MB, JPEG/PNG/WebP). AC3: Avatar URL stored in `users.avatar_url`. AC4: Changes reflected immediately in subsequent API responses. |
| US-F05-02 | As a traveler, I want to view my profile so that I can verify my information. | AC1: `GET /v1/users/me` returns full profile including `loyalty_balance`, `student_status`, `role`. AC2: Returns 401 if not authenticated. |

### F06 — Role-Based Access Control

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F06-01 | As an admin, I want to access protected admin routes so that I can manage the platform. | AC1: Two roles: `USER` and `ADMIN`. AC2: Admin routes guarded by `@Roles(ADMIN)` decorator + `RolesGuard`. AC3: Non-admin receives 403 Forbidden. AC4: Role stored in JWT payload and `users.role` column. |
| US-F06-02 | As a system, I want to prevent privilege escalation so that users cannot self-promote to admin. | AC1: `role` field is never accepted in `PATCH /v1/users/me`. AC2: Role change requires direct database update or dedicated admin-only endpoint. |

---

## Data Model

### `users` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | Supabase Auth UUID |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Normalized lowercase |
| `name` | VARCHAR(255) | | Display name |
| `phone` | VARCHAR(20) | | E.164 format |
| `avatar_url` | TEXT | | Supabase Storage public URL |
| `preferred_language` | VARCHAR(2) | DEFAULT 'EN' | EN, ZH, KM |
| `emergency_contact_name` | VARCHAR(255) | | |
| `emergency_contact_phone` | VARCHAR(20) | | E.164 format |
| `role` | VARCHAR(20) | DEFAULT 'USER' | USER, ADMIN |
| `email_verified` | BOOLEAN | DEFAULT false | |
| `student_status` | VARCHAR(20) | DEFAULT 'NONE' | NONE, PENDING, VERIFIED, REJECTED |
| `loyalty_balance` | INTEGER | DEFAULT 0 | Denormalized cache |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `AUTH_001` | 401 | Invalid credentials |
| `AUTH_002` | 403 | Email not verified |
| `AUTH_003` | 409 | Email already registered |
| `AUTH_004` | 401 | Token expired or invalid |
| `AUTH_005` | 403 | Insufficient role privileges |
| `PROFILE_001` | 400 | Invalid avatar format or size |
| `PROFILE_002` | 400 | Invalid phone format |

---

*Aligned with PRD section 7.1 and `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 3–4).*
