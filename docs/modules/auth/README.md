# Auth & Authentication Module

> Authentication, authorization, session management, and password recovery.

---

## Overview

This module provides the entire authentication layer for DerLg. Every other module depends on it. It handles email/password registration, Google OAuth, JWT access tokens, refresh token rotation, logout (single device and all devices), and password reset via email.

**Feature ID:** F01–F06  
**Backend Module:** `src/modules/auth/`  
**Pattern:** Clean Architecture / Use-Case Pattern  
**Depends on:** Foundation (Phase 1), Database Schema (Phase 2)  
**Blocks:** Every other feature module (all require auth)

---

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Spec | ✅ Complete | This document |
| Backend | ✅ Complete | Implemented with Use-Case pattern |
| Frontend | ⬜ Not Started | — |
| E2E Tests | ⬜ Not Started | — |

---

## Quick Links

- [`api.yaml`](./api.yaml) — OpenAPI contract
- [`requirements.md`](./requirements.md) — User stories & acceptance criteria
- [`architecture.md`](./architecture.md) — Auth flow, token strategy, use cases
- Backend spec: [`backend/context/specs/API-CONTRACT.md`](../../backend/context/specs/API-CONTRACT.md) §1
- Backend schema: [`backend/context/specs/SCHEMA.md`](../../backend/context/specs/SCHEMA.md) — `User`, `RefreshToken` models

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register with email + password |
| POST | `/auth/login` | Public | Login, receive access token + refresh cookie |
| POST | `/auth/google` | Public | Initiate Google OAuth 2.0 flow (returns URL) |
| GET | `/auth/google/callback` | Public | OAuth callback, create/link user |
| POST | `/auth/refresh` | Refresh cookie | Exchange refresh token for new access token |
| POST | `/auth/logout` | Bearer JWT + cookie | Invalidate current session |
| POST | `/auth/logout-all` | Bearer JWT | Invalidate all user sessions |
| POST | `/auth/forgot-password` | Public | Send password reset email (Resend) |
| POST | `/auth/reset-password` | Public | Reset password with token |

---

## Architecture Decisions

- **Use-Case Pattern:** Controllers are thin; business logic is encapsulated in `use-cases/`.
- **Custom JWT (not Supabase Auth):** Backend controls token lifecycle, enables multi-device logout.
- **Refresh tokens in Redis:** Instant revocation for logout-all-devices.
- **bcrypt cost factor 12:** Security/performance balance.
- **Resend for transactional email:** Simple HTTP API, no SMTP needed.
- **Token rotation:** New refresh token on every refresh, old one invalidated.

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `AUTH_EMAIL_EXISTS` | 409 | Email already registered |
| `AUTH_INVALID_PASSWORD` | 400 | Password < 8 chars |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Account suspended |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid or expired |
| `AUTH_OAUTH_FAILED` | 400 | Google auth failed |
| `AUTH_RESET_TOKEN_INVALID` | 400 | Invalid or expired reset token |

---

## Environment Variables

```
JWT_ACCESS_SECRET         # Access token signing key
JWT_REFRESH_SECRET        # Refresh token signing key
RESEND_API_KEY            # Resend API key for password reset emails
GOOGLE_CLIENT_ID          # Google OAuth client ID
GOOGLE_CLIENT_SECRET      # Google OAuth client secret
```

---

## Related Modules

- [`profile/`](../profile/) — User profile read/update (`GET /v1/users/me`, `PATCH /v1/users/me`)
