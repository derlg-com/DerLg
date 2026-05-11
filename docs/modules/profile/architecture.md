# User Profile & Account Settings — Architecture

> **Feature IDs:** F01–F06  
> **Scope:** MVP

---

## Overview

The authentication and identity system is built on **Supabase Auth** for email/password and OAuth providers, with a custom **NestJS JWT layer** for access/refresh token management. User profile data lives in a PostgreSQL `users` table synced with Supabase Auth via database triggers.

---

## Component Diagram

```
┌──────────────┐     OAuth Redirect      ┌──────────────┐
│   Next.js    │ ◄────────────────────►  │   Google     │
│  (Frontend)  │                         │   OAuth 2.0  │
└──────┬───────┘                         └──────────────┘
       │
       │ Email/Password or OAuth code
       │
       ▼
┌──────────────┐     Supabase Auth       ┌──────────────┐
│   NestJS     │ ◄────────────────────►  │  Supabase    │
│   Auth       │   (user.created hook)   │   Auth       │
│  Controller  │                         │  (GoTrue)    │
└──────┬───────┘                         └──────┬───────┘
       │                                        │
       │ JWT (access) + Cookie (refresh)        │ Trigger: insert into `users`
       │                                        ▼
       ▼                                ┌──────────────┐
┌──────────────┐                        │   PostgreSQL │
│   Next.js    │                        │   `users`    │
│   (Client)   │                        │   table      │
└──────────────┘                        └──────────────┘
```

---

## Auth Flow

### 1. Email/Password Registration

```
Frontend                          Backend                       Supabase
  │                                 │                             │
  │ POST /v1/auth/register          │                             │
  │ {email, password}              │                             │
  │ ─────────────────────────────> │                             │
  │                                │ POST /auth/v1/signup        │
  │                                │ ──────────────────────────> │
  │                                │                             │
  │                                │ <────────────────────────── │
  │                                │  {user, session}           │
  │                                │                             │
  │ 201 Created                    │                             │
  │ {message: "Check your email"} │                             │
  │ <───────────────────────────── │                             │
```

**Note:** The `users` row is created automatically via a Supabase Auth trigger (`auth.users` → `public.users`).

### 2. Login (Access + Refresh)

```
Frontend                          Backend                       Supabase
  │                                 │                             │
  │ POST /v1/auth/login            │                             │
  │ {email, password}              │                             │
  │ ─────────────────────────────> │                             │
  │                                │ Verify via Supabase         │
  │                                │ ──────────────────────────> │
  │                                │                             │
  │                                │ Generate JWT (15m)          │
  │                                │ Generate refresh (7d)       │
  │                                │ Store refresh hash in Redis │
  │                                │                             │
  │ 200 OK                         │                             │
  │ {accessToken, user}            │                             │
  │ Set-Cookie: refresh=...        │                             │
  │ <───────────────────────────── │                             │
```

### 3. Token Refresh

```
Frontend                          Backend                       Redis
  │                                 │                             │
  │ POST /v1/auth/refresh          │                             │
  │ Cookie: refresh=...            │                             │
  │ ─────────────────────────────> │                             │
  │                                │ Verify refresh token        │
  │                                │ Check Redis (not revoked)   │
  │                                │ ──────────────────────────> │
  │                                │                             │
  │                                │ Rotate: delete old, store new│
  │                                │                             │
  │ 200 OK                         │                             │
  │ {accessToken}                  │                             │
  │ Set-Cookie: refresh=new...     │                             │
  │ <───────────────────────────── │                             │
```

### 4. Logout

```
Frontend                          Backend                       Redis
  │                                 │                             │
  │ POST /v1/auth/logout           │                             │
  │ Cookie: refresh=...            │                             │
  │ Authorization: Bearer <access> │                             │
  │ ─────────────────────────────> │                             │
  │                                │ Add access token to blacklist│
  │                                │ (Redis, TTL = token expiry) │
  │                                │ Delete refresh token        │
  │                                │ ──────────────────────────> │
  │                                │                             │
  │ 204 No Content                 │                             │
  │ Clear-Cookie: refresh          │                             │
  │ <───────────────────────────── │                             │
```

---

## State Flow: Password Reset

```
[Request Reset] ──> [Generate token (1h TTL)] ──> [Send email via Resend]
                                                          │
                                                          ▼
[Update password] <── [Validate token] <── [User clicks link]
       │
       ▼
[Invalidate all refresh tokens]
```

---

## Middleware & Guards

| Layer | Purpose | Implementation |
|-------|---------|----------------|
| `JwtAuthGuard` | Validate access token on protected routes | Passport JWT strategy, check Redis blacklist |
| `RolesGuard` | Enforce RBAC after auth | Check `req.user.role` against `@Roles()` metadata |
| `AuthMiddleware` (optional) | Attach user to request if token present | Used for public routes that behave differently for authenticated users |

---

## Data Model Relationships

```
┌─────────────┐       ┌─────────────┐       ┌─────────────────┐
│   users     │       │   bookings  │       │ student_verif.  │
├─────────────┤       ├─────────────┤       ├─────────────────┤
│ id (PK)     │──┐    │ id (PK)     │       │ id (PK)         │
│ email       │  └───>│ user_id(FK) │       │ user_id (FK)    │
│ name        │       │ ...         │       │ status          │
│ role        │       └─────────────┘       │ ...             │
│ ...         │                             └─────────────────┘
└─────────────┘
       │
       │ 1:N
       ▼
┌─────────────────┐
│ loyalty_trans.  │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ type            │
│ amount          │
└─────────────────┘
```

---

## Security Considerations

1. **Password Policy:** Minimum 8 characters, 1 uppercase, 1 number, 1 special character (enforced by Supabase + DTO validation).
2. **Token Storage:** Access token in `memory` (JavaScript variable, never localStorage). Refresh token in `httpOnly Secure SameSite=Strict` cookie.
3. **Redis Blacklist:** Access tokens added to Redis on logout with TTL matching their remaining expiry. Prevents replay attacks.
4. **Rate Limiting:** Auth endpoints limited to 5 requests / 5 minutes / IP.
5. **CORS:** Production origins only.

---

*Aligned with `docs/platform/architecture/system-overview.md` and `.kiro/specs/backend-nestjs-supabase/requirements.md`.*
