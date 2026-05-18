# Auth & Authentication — Requirements

> **Feature IDs:** F01–F06  
> **Scope:** MVP  
> **Priority:** P0

---

## User Stories

### F01 — Registration

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F01-01 | As a traveler, I want to register with my email and password so that I can create an account and start booking trips. | AC1: Email must be unique (case-insensitive). AC2: Password minimum 8 characters. AC3: Password hashed with bcrypt (cost factor 12). AC4: Account created with `role=USER`, `status=ACTIVE`. AC5: Returns access token and refresh token cookie on success. AC6: Returns `AUTH_EMAIL_EXISTS` (409) if email already registered. |

### F02 — Login

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F02-01 | As a registered traveler, I want to log in with email and password so that I can access my account. | AC1: Validates email and password against bcrypt hash. AC2: Returns `AUTH_INVALID_CREDENTIALS` (401) if wrong. AC3: Returns `AUTH_ACCOUNT_SUSPENDED` (403) if account suspended. AC4: Returns access token in response body. AC5: Sets refresh token as `httpOnly; Secure; SameSite=Strict` cookie. AC6: Refresh token stored in Redis with 7-day TTL. |

### F03 — Google OAuth

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F03-01 | As a traveler, I want to sign in with my Google account so that I don't need to remember another password. | AC1: `POST /v1/auth/google` returns Google consent screen URL. AC2: Callback handles OAuth code and fetches user info from Google. AC3: If email exists, link Google account and issue tokens. AC4: If email is new, create user with Google-provided name/email and issue tokens. AC5: Returns `AUTH_OAUTH_FAILED` (400) on any OAuth error. |

### F04 — Token Refresh

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F04-01 | As a logged-in traveler, I want to get a new access token when mine expires so that I stay authenticated without re-logging in. | AC1: Reads `refresh_token` from httpOnly cookie. AC2: Validates token signature and expiry. AC3: Checks token exists in Redis. AC4: Issues new access token and new refresh token (rotation). AC5: Old refresh token removed from Redis. AC6: New refresh token set as cookie. AC7: Returns `AUTH_INVALID_REFRESH_TOKEN` (401) if invalid. |

### F05 — Logout

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F05-01 | As a logged-in traveler, I want to log out so that my session ends on this device. | AC1: Requires valid Bearer JWT and refresh token cookie. AC2: Removes refresh token from Redis. AC3: Clears refresh token cookie. AC4: Returns success message. |
| US-F05-02 | As a logged-in traveler, I want to log out from all devices so that I can secure my account if I suspect unauthorized access. | AC1: Requires valid Bearer JWT. AC2: Deletes all Redis keys matching `session:{userId}:*`. AC3: Clears refresh token cookie on current device. AC4: All other devices' refresh tokens become invalid immediately. |

### F06 — Password Reset

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F06-01 | As a traveler who forgot their password, I want to reset my password via email so that I can regain access to my account. | AC1: `POST /v1/auth/forgot-password` accepts email. AC2: Generates secure reset token, stores in Redis with 1-hour TTL. AC3: Sends reset email via Resend with reset link. AC4: Silent success (no error) if email not found — prevents enumeration. AC5: `POST /v1/auth/reset-password` accepts token and new password. AC6: Validates token from Redis, updates password hash. AC7: Returns `AUTH_RESET_TOKEN_INVALID` (400) if token expired or invalid. |

---

## Data Model

### `users` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Case-insensitive |
| `password_hash` | VARCHAR(255) | | Null for OAuth-only users |
| `name` | VARCHAR(255) | | |
| `phone` | VARCHAR(20) | | E.164 format |
| `avatar_url` | TEXT | | |
| `role` | VARCHAR(20) | DEFAULT 'USER' | USER, STUDENT, GUIDE, ADMIN |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, SUSPENDED |
| `gender` | VARCHAR(20) | | MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY |
| `date_of_birth` | DATE | | |
| `nationality` | VARCHAR(100) | | |
| `is_verified` | BOOLEAN | DEFAULT false | Email verification (deferred) |
| `loyalty_points` | INTEGER | DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |
| `deleted_at` | TIMESTAMPTZ | | Soft delete |

### `refresh_tokens` Table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `token` | VARCHAR(512) | UNIQUE, NOT NULL | JWT refresh token |
| `user_id` | UUID | FK → users | |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `AUTH_EMAIL_EXISTS` | 409 | Email already registered |
| `AUTH_INVALID_PASSWORD` | 400 | Password less than 8 characters |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Account suspended |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid or expired |
| `AUTH_OAUTH_FAILED` | 400 | Google authentication failed |
| `AUTH_RESET_TOKEN_INVALID` | 400 | Invalid or expired reset token |

---

*Aligned with PRD section 7.1 and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
