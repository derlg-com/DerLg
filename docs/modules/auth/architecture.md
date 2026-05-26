# Auth & Authentication — Architecture

> **Feature IDs:** F01–F06  
> **Scope:** MVP  
> **Priority:** P0

---

## Overview

The Auth module is the security gateway for the entire platform. All other modules depend on it for identity verification and access control. It supports email/password authentication, Google OAuth 2.0, JWT-based sessions with refresh token rotation, and password reset via email.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Login Page  │  │ Register    │  │ Password Reset      │  │
│  │             │  │ Page        │  │ Page                │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Auth Store (Zustand) — token, user, isAuthenticated │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ REST JSON / OAuth redirect
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Auth        │  │ Users       │  │ Google OAuth        │  │
│  │ Controller  │  │ Controller  │  │ Callback            │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Use Cases (Register, Login, Token Refresh, etc.)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │PostgreSQL│     │  Redis   │     │ Resend   │            │
│  │ (users)  │     │(sessions)│     │ (email)  │            │
│  └──────────┘     └──────────┘     └──────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## Use Cases

Business logic is decomposed into individual, single-responsibility use case classes located in `src/modules/auth/use-cases/`:

- **RegisterUseCase:** Validates email uniqueness, hashes password, creates user, and issues tokens.
- **LoginUseCase:** Validates credentials, checks account status, and issues tokens.
- **RefreshTokenUseCase:** Validates rotation, checks Redis, deletes old token, and issues new pair.
- **LogoutUseCase:** Inactivates a specific session in Redis.
- **LogoutAllDevicesUseCase:** Inactivates all sessions for a user in Redis.
- **ForgotPasswordUseCase:** Generates secure reset token, stores in Redis, and triggers email.
- **ResetPasswordUseCase:** Validates reset token, updates password, and cleans up Redis.
- **GoogleAuthUseCase:** Generates the Google OAuth consent screen URL.
- **GoogleCallbackUseCase:** Handles provider callback, exchanges code, and find/creates user.
- **GenerateTokensUseCase:** (Internal) Handles JWT signing and Redis session storage logic.
- **SendResetEmailUseCase:** (Internal) Handles integration with the Resend service.

---

## State Flow: Registration

```
[User submits registration form] ──> [POST /v1/auth/register]
                                          │
                                          ▼
                                   [Validate DTO]
                                          │
                                          ▼
                                   [Check email uniqueness]
                                          │
                                          ▼
                                   [Hash password with bcrypt]
                                          │
                                          ▼
                                   [Create user record]
                                          │
                                          ▼
                                   [Generate access + refresh tokens]
                                          │
                                          ▼
                                   [Store refresh token in Redis]
                                          │
                                          ▼
                                   [Set refresh_token cookie]
                                          │
                                          ▼
                                   [Return { user, accessToken }]
```

---

## State Flow: Login

```
[User submits login form] ──> [POST /v1/auth/login]
                                     │
                                     ▼
                              [Validate credentials]
                                     │
                                     ▼
                              [Find user by email]
                                     │
                                     ▼
                              [Compare bcrypt hash]
                                     │
                                     ▼
                              [Check account status]
                                     │
                                     ▼
                              [Generate access + refresh tokens]
                                     │
                                     ▼
                              [Store refresh token in Redis]
                                     │
                                     ▼
                              [Set refresh_token cookie]
                                     │
                                     ▼
                              [Return { accessToken }]
```

---

## State Flow: Token Refresh

```
[Access token expires] ──> [POST /v1/auth/refresh]
                                  │
                                  ▼
                           [Read refresh_token cookie]
                                  │
                                  ▼
                           [Verify JWT signature + expiry]
                                  │
                                  ▼
                           [Check token exists in Redis]
                                  │
                                  ▼
                           [Delete old token from Redis]
                                  │
                                  ▼
                           [Generate new access + refresh tokens]
                                  │
                                  ▼
                           [Store new refresh token in Redis]
                                  │
                                  ▼
                           [Set new refresh_token cookie]
                                  │
                                  ▼
                           [Return { accessToken }]
```

---

## State Flow: Google OAuth

```
[User clicks "Sign in with Google"] ──> [POST /v1/auth/google]
                                               │
                                               ▼
                                        [Build OAuth URL]
                                               │
                                               ▼
                                        [Redirect to Google consent]
                                               │
                                               ▼
                                        [User grants permission]
                                               │
                                               ▼
                                        [GET /v1/auth/google/callback]
                                               │
                                               ▼
                                        [Exchange code for token]
                                               │
                                               ▼
                                        [Fetch user profile from Google]
                                               │
                                               ▼
                                        [Find or create user by email]
                                               │
                                               ▼
                                        [Generate tokens, store in Redis]
                                               │
                                               ▼
                                        [Set cookie, return accessToken]
```

---

## State Flow: Password Reset

```
[User clicks "Forgot password"] ──> [POST /v1/auth/forgot-password]
                                           │
                                           ▼
                                    [Accept email]
                                           │
                                           ▼
                                    [Generate reset token]
                                           │
                                           ▼
                                    [Store in Redis (1h TTL)]
                                           │
                                           ▼
                                    [Send email via Resend]
                                           │
                                           ▼
                                    [Return silent success]
                                           │
                                           ▼
[User clicks reset link] ──> [POST /v1/auth/reset-password]
                                    │
                                    ▼
                             [Validate token from Redis]
                                    │
                                    ▼
                             [Hash new password]
                                    │
                                    ▼
                             [Update user record]
                                    │
                                    ▼
                             [Delete reset token from Redis]
                                    │
                                    ▼
                             [Return success]
```

---

## Token Strategy

### Access Token

| Property | Value |
|----------|-------|
| Type | JWT (RS256 or HS256) |
| TTL | 15 minutes |
| Payload | `{ sub, email, role, iat, exp }` |
| Transport | Response body (`{ accessToken }`) |
| Usage | `Authorization: Bearer <token>` header |

### Refresh Token

| Property | Value |
|----------|-------|
| Type | JWT |
| TTL | 7 days |
| Payload | `{ sub, tokenId, iat, exp }` |
| Transport | `httpOnly; Secure; SameSite=Strict` cookie |
| Storage | Redis `session:{userId}:{tokenId}` |
| Rotation | New token on every refresh; old invalidated |

---

## Redis Key Patterns

| Key Pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `session:{userId}:{tokenId}` | refreshToken JWT | 7 days | Active session |
| `password_reset:{token}` | userId | 1 hour | Password reset token |

---

## Session Management

### Single Device Logout

- Deletes one refresh token from Redis
- Clears cookie on current device
- Other device sessions remain active

### Logout All Devices

- Deletes all Redis keys matching `session:{userId}:*`
- Clears cookie on current device
- All other sessions immediately invalidated

---

## Security Measures

| Measure | Implementation |
|---------|----------------|
| Password hashing | bcrypt with cost factor 12 |
| Token signing | Separate secrets for access and refresh |
| Cookie attributes | `httpOnly`, `Secure` (prod), `SameSite=Strict` |
| Rate limiting | 5 requests / 5 minutes / IP for auth endpoints |
| Token rotation | New refresh token on every refresh |
| PII logging | Pino redaction for password, token, authorization |
| CORS | Whitelist enforced; cookie only sent to allowed origins |
| Account lock | SUSPENDED status blocks login entirely |

---

## Operation Flow: Auth Journey

End-to-end authentication journey:

```
1. [User opens app] ──> [Unauthenticated state]
                              │
                              ▼
2. [Tap "Sign Up"] ──> [Fill registration form]
                              │
                              ▼
3. [POST /v1/auth/register] ──> [Account created, tokens issued]
                              │
                              ▼
4. [Store accessToken, redirect to home]
                              │
                              ▼
5. [Access token expires] ──> [POST /v1/auth/refresh]
                              │
                              ▼
6. [New tokens issued] ──> [Continue session]
                              │
                              ▼
7. [Tap "Logout"] ──> [POST /v1/auth/logout]
                              │
                              ▼
8. [Tokens invalidated, redirect to login]
```

---

## Non-Functional Requirements (NFRs)

| NFR | Target | Implementation |
|-----|--------|----------------|
| Login response time | < 200ms p95 | Indexed email lookup + bcrypt compare |
| Token refresh response time | < 100ms p95 | Redis lookup + JWT sign |
| Registration response time | < 300ms p95 | Bcrypt hash (cost 12) + DB insert |
| Auth endpoint rate limit | 5 req / 5 min / IP | Redis-backed sliding window; 429 on exceed |
| Access token TTL | 15 minutes | Short-lived for security |
| Refresh token TTL | 7 days | Long-lived but rotatable and revocable |
| Password reset token TTL | 1 hour | Short window for security |
| Concurrent sessions | No limit | Managed via Redis keys per device |
| Token rotation | Every refresh | Prevents replay attacks using stolen refresh tokens |
| Availability | 99.9% uptime | Auth is the gateway; monitored with alerting |

---

*Aligned with PRD section 7.1 and `.kiro/specs/backend-nestjs-supabase/design.md`.*
