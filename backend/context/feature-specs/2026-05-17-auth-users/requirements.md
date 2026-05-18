# Requirements: Auth & Users

## Scope
- **In scope:**
  - Email/password registration with bcrypt hashing
  - Email/password login with JWT access token + refresh token cookie
  - Google OAuth 2.0 flow (initiate + callback)
  - Token refresh with rotation
  - Logout (single device) and logout-all-devices
  - Password reset via Resend email
  - Current user profile read (`GET /v1/users/me`)
  - Current user profile update (`PATCH /v1/users/me`)
  - Redis-based refresh token storage and invalidation
  - Auth-specific rate limiting (5 req / 5 min / IP)
  - Unit tests (≥ 90% auth service coverage) + E2E tests
- **Out of scope:**
  - Email verification on registration (deferred)
  - Role-based admin endpoints (Phase 11)
  - Phone/SMS OTP auth
  - Multi-factor authentication

## Decisions
- **Custom JWT (not Supabase Auth):** Backend controls token lifecycle, enables multi-device logout per `CONSTITUTION.md` §4.1
- **Refresh tokens in Redis (not DB-only):** Enables instant revocation for logout-all-devices
- **bcrypt cost factor 12:** Balance between security and performance per `TECH-STACK.md`
- **Resend for transactional email:** Simple HTTP API, no SMTP needed
- **Google OAuth:** Standard Passport Google strategy; create new user if email not found, link to existing if found

## Context
- Phase 3 blocks all subsequent phases (every feature requires auth)
- The `User` and `RefreshToken` models are defined in `SCHEMA.md` (awaiting Phase 2 migration from senior)
- Shared kernel (Phase 1) already provides: `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()`, `@Public()`, `TransformInterceptor`, `AllExceptionsFilter`, `PrismaModule`, `RedisModule`, `ErrorCodes`
- Token payload shape: `{ sub: userId, email: string, role: UserRole }`

## References
- `backend/context/plans/roadmap.md` Phase 3
- `backend/context/guides/MISSION.md`
- `backend/context/guides/TECH-STACK.md`
- `backend/context/guides/CONSTITUTION.md` §4 (Auth & Authorization)
- `backend/context/specs/API-CONTRACT.md` §1 (Auth), §2 (Users)
- `backend/context/specs/SCHEMA.md` — User, RefreshToken models
- `backend/context/specs/ERROR-REGISTRY.md` — AUTH_* error codes
