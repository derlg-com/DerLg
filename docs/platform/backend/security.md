# Security & Auth Architecture

> Covers Phase 0 auth ownership through Phase 3 domain foundation. High-level only — implementation details live in code and `docs/modules/auth/`.

---

## Auth Strategy

**Backend issues custom JWTs** (see [Foundation](./foundation.md)).

### Token Contract

| Token | Lifetime | Storage | Transport |
|-------|----------|---------|-----------|
| Access | 15 min | Memory only | `Authorization: Bearer <token>` header |
| Refresh | 7 days | Redis + `httpOnly` cookie | Cookie (`Secure`, `SameSite=Strict`) |

### Flows

1. **Login:** Validate password → issue access + refresh tokens → set cookie.
2. **Refresh:** Validate refresh token (Redis + cookie) → rotate refresh token (invalidate old, issue new) → return new access token.
3. **Logout:** Blacklist refresh token in Redis → clear cookie.
4. **Logout all devices:** Flush all refresh token entries for user in Redis.
5. **Google OAuth:** Redirect to Google → callback links/creates user → backend issues its own tokens (do not expose Supabase session to frontend).
6. **Password reset:** Backend generates token → sends via Resend → user submits new password → token invalidated.

---

## Guards

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Validate access token from `Authorization` header |
| `RolesGuard` | RBAC check using `@Roles()` decorator |
| `ThrottlerGuard` | Enforce rate limits (applied globally, opt-out via `@SkipThrottle()`) |

---

## Decorators

| Decorator | Purpose |
|-----------|---------|
| `@CurrentUser()` | Extract user payload from request (set by `JwtAuthGuard`) |
| `@Roles(...roles)` | Attach required roles to route handler |
| `@Public()` | Bypass `JwtAuthGuard` on specific routes (e.g., health, login) |

---

## Authorization Matrix

| Role | Description |
|------|-------------|
| `user` | Standard authenticated user |
| `guide` | Verified tour guide (elevated inventory permissions) |
| `student` | Eligible for student discounts |
| `admin` | Full platform access |

Permissions are mapped as granular strings (e.g., `booking:cancel-own`, `booking:cancel-any`). `RolesGuard` may delegate to a permission service for fine-grained checks.

---

## Rate Limiting

- Default: 5 requests / 5 minutes / IP for public endpoints (auth, registration).
- Authenticated endpoints: higher limits per user ID.
- `/v1/ai-tools/*`: separate, stricter limit (documented in [AI Integration](./ai-integration.md)).

---

## Transport Security

- CORS whitelist configured via env vars.
- Helmet headers on all responses.
- Cookies: `httpOnly`, `Secure` (production), `SameSite=Strict`.

---

## Checklist

- [ ] `AuthModule` created with login, refresh, logout flows
- [ ] `JwtAuthGuard` validates access tokens
- [ ] Refresh token rotation implemented
- [ ] Redis blacklist for revoked refresh tokens
- [ ] Google OAuth flow documented and wired
- [ ] Password reset flow via Resend
- [ ] `@Roles()` + `RolesGuard` functional
- [ ] `@Public()` decorator for open routes
- [ ] Rate limits applied and tested
