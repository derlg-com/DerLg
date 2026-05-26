# Plan: Complete Auth Module (`feature/2026-05-17-auth-users`)

> **Context:** The auth module core (7 endpoints) is implemented with the use-case pattern. AuthService was removed; the controller injects use cases directly. Env vars are filled. What remains: Google OAuth, Resend email integration, tests, and import path fixes.
> **Branch:** `feature/2026-05-17-auth-users`
> **Phase:** 3 (Completion)
> **Updated:** 2026-05-18

---

## Current State (As-Is)

### ✅ Already Done

| Area | Status | Notes |
|------|--------|-------|
| Register `POST /auth/register` | ✅ | Use case + DTO validation + bcrypt + Redis session |
| Login `POST /auth/login` | ✅ | Use case + credential check + suspended guard |
| Refresh `POST /auth/refresh` | ✅ | Token rotation via RefreshTokenUseCase |
| Logout `POST /auth/logout` | ✅ | Single session cleanup |
| Logout all `POST /auth/logout-all` | ✅ | Bulk Redis key deletion |
| Forgot password `POST /auth/forgot-password` | ⚠️ | Token generated + stored in Redis; **email not sent** (console log only) |
| Reset password `POST /auth/reset-password` | ✅ | Token validation + password update |
| Use case pattern | ✅ | 8 use cases, barrel exports, controller injects directly |
| DTOs | ✅ | `RegisterDto`, `LoginDto`, `ForgotPasswordDto`, `ResetPasswordDto`, `RefreshTokenDto` |
| JWT strategy | ✅ | Passport `JwtStrategy` in `auth/strategies/jwt.strategy.ts` |
| Env vars | ✅ | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` all set in `.env` |
| Auth guards | ✅ | `JwtAuthGuard` (global), `RolesGuard`, `@Public()`, `@CurrentUser()` decorators |

### ❌ Missing / Broken

| # | Item | Why It Matters | Effort |
|---|------|---------------|--------|
| 1 | **Google OAuth** (`POST /auth/google`, `GET /auth/google/callback`) | Documented in specs; controller routes don't exist; env vars exist but unused | Medium |
| 2 | **Resend email sending** | `ForgotPasswordUseCase` has TODO; users can't receive reset links in production | Small |
| 3 | **Unit tests for use cases** | `auth.service.spec.ts` was deleted during refactoring; zero test coverage | Medium |
| 4 | **E2E tests** | `test/auth.e2e-spec.ts` does not exist; full auth flow untested | Medium |
| 5 | **Import path fixes** | `auth.controller.ts` imports from `../common/...` which resolves incorrectly from `modules/auth/` | Small |
| 6 | **Env validation** | `env.validation.ts` missing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` | Small |
| 7 | **RefreshToken model unused** | Prisma `RefreshToken` table exists but code uses Redis only; either use it or remove it | Small |

---

## Implementation Plan

### Task 1: Fix Import Paths & Env Validation

**Goal:** Make the module compile cleanly before adding features.

| File | Action | Detail |
|------|--------|--------|
| `src/modules/auth/auth.controller.ts` | Fix imports | Change `../common/decorators/...` to `../../common/decorators/...` (×3 imports) |
| `src/config/env.validation.ts` | Add env vars | Add `GOOGLE_CLIENT_ID: z.string().default('')` and `GOOGLE_CLIENT_SECRET: z.string().default('')` |

**Verification:** `npx tsc --noEmit` passes with zero auth-related errors.

---

### Task 2: Wire Resend Email into Forgot Password

**Goal:** Actually send password reset emails.

| File | Action | Detail |
|------|--------|--------|
| `package.json` | Install | `resend` package |
| `src/modules/auth/use-cases/send-reset-email.use-case.ts` | Create | Wraps Resend SDK; sends HTML email with reset link; accepts `to`, `resetLink` |
| `src/modules/auth/use-cases/forgot-password.use-case.ts` | Modify | Inject `SendResetEmailUseCase`; build reset link from `FRONTEND_URL` + token; call use case instead of console log |
| `src/modules/auth/use-cases/index.ts` | Export | Add `SendResetEmailUseCase` to barrel |
| `src/modules/auth/auth.module.ts` | Provide | Add `SendResetEmailUseCase` to providers |
| `.env.example` | Document | Add `FRONTEND_URL=http://localhost:3000` |
| `src/config/env.validation.ts` | Validate | Add `FRONTEND_URL: z.string().default('http://localhost:3000')` |

**Email template:** Simple HTML with "Click to reset your password" linking to `{frontendUrl}/reset-password?token={token}`.

**Verification:** Call `POST /auth/forgot-password`; check Resend dashboard for sent email.

---

### Task 3: Implement Google OAuth

**Goal:** Full "Sign in with Google" flow.

| File | Action | Detail |
|------|--------|--------|
| `package.json` | Install | `passport-google-oauth20`, `@types/passport-google-oauth20` |
| `src/modules/auth/use-cases/google-auth.use-case.ts` | Create | Builds Google OAuth URL with `client_id`, `redirect_uri`, `scope=openid email profile` |
| `src/modules/auth/use-cases/google-callback.use-case.ts` | Create | Exchanges `code` for tokens via Google API; fetches user info; finds user by email; creates new user if not found (null passwordHash); issues tokens via `GenerateTokensUseCase` |
| `src/modules/auth/auth.controller.ts` | Add routes | `POST /auth/google` returns `{ url }`; `GET /auth/google/callback` handles code query param, sets cookie, returns `{ accessToken, user }` |
| `src/modules/auth/use-cases/index.ts` | Export | Add both use cases |
| `src/modules/auth/auth.module.ts` | Provide | Add both use cases to providers |
| `src/modules/auth/interfaces/index.ts` | Add | `OAuthUrlResponse` interface |

**User linking strategy:**
1. Google returns `email`, `name`, `picture`
2. Search `prisma.user.findUnique({ where: { email } })`
3. If found → issue tokens (link account)
4. If not found → `prisma.user.create({ email, fullName: name, supabaseUid: randomUUID(), passwordHash: null })` → issue tokens

**Error handling:** Any failure returns `AUTH_OAUTH_FAILED` (400).

**Verification:**
- `POST /auth/google` returns a valid Google consent URL
- After consent, callback creates/links user and returns tokens
- Existing password user can link Google (same email)

---

### Task 4: Write Unit Tests for All Use Cases

**Goal:** ≥ 90% coverage on auth use cases.

| Test File | What to Test |
|-----------|-------------|
| `use-cases/register.use-case.spec.ts` | Duplicate email → 409; success → user created + tokens returned; bcrypt hash called |
| `use-cases/login.use-case.spec.ts` | Wrong email → 401; wrong password → 401; suspended → 403; success → tokens |
| `use-cases/refresh-token.use-case.spec.ts` | Valid refresh → new tokens; invalid token → 401; mismatched Redis → 401; Redis delete + set called |
| `use-cases/logout.use-case.spec.ts` | Valid token → Redis delete; invalid token → no throw |
| `use-cases/logout-all-devices.use-case.spec.ts` | Multiple keys → all deleted; no keys → no error |
| `use-cases/forgot-password.use-case.spec.ts` | Known email → token in Redis; unknown email → silent; Resend called (when wired) |
| `use-cases/reset-password.use-case.spec.ts` | Valid token → password updated + token deleted; invalid → 400 |
| `use-cases/generate-tokens.use-case.spec.ts` | Access token 15m expiry; refresh token 7d; Redis setex called; correct payload shape |
| `use-cases/google-callback.use-case.spec.ts` | New user → created + tokens; existing user → tokens; Google error → 400 |

**Mocking strategy:**
- Mock `PrismaService` (mock user/create/update/findUnique)
- Mock `RedisService` (mock get/setex/del/keys)
- Mock `JwtService` (mock signAsync/verify)
- Mock `ConfigService` (return test secrets)
- Mock `GenerateTokensUseCase` (return predictable tokens)
- Mock Resend SDK (when testing email)

**Verification:** `npm run test:cov` shows auth use cases ≥ 90% statements/lines.

---

### Task 5: Write E2E Tests

**Goal:** Full auth flow end-to-end.

| Test File | Scenarios |
|-----------|-----------|
| `test/auth.e2e-spec.ts` | Register → 201; Duplicate → 409; Login → 200 + cookie; Access protected → 200; Refresh → 200 + new cookie; Logout → 200; Access protected after logout → 401; Forgot password → 200; Reset password → 200; Invalid reset → 400 |

**Test DB strategy:** Use real Prisma + real Redis (from `.env`). Before suite: `prisma.$executeRaw` to clean users. After each test: clean Redis.

**Verification:** `npm run test:e2e` passes all auth tests.

---

### Task 6: Clean Up & Final Verification

| Action | Detail |
|--------|--------|
| `npm run lint` | Zero errors/warnings |
| `npm run format` | All files formatted |
| `npm run build` | Compiles successfully |
| `npx tsc --noEmit` | Zero type errors |
| Update `PROGRESS-TRACKER.md` | Mark Google OAuth, Resend, tests as complete |

---

## Files to Create / Modify

### New Files (12)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/modules/auth/use-cases/send-reset-email.use-case.ts` | Resend email wrapper |
| 2 | `src/modules/auth/use-cases/google-auth.use-case.ts` | Build Google OAuth URL |
| 3 | `src/modules/auth/use-cases/google-callback.use-case.ts` | Handle Google callback |
| 4 | `src/modules/auth/use-cases/register.use-case.spec.ts` | Unit tests |
| 5 | `src/modules/auth/use-cases/login.use-case.spec.ts` | Unit tests |
| 6 | `src/modules/auth/use-cases/refresh-token.use-case.spec.ts` | Unit tests |
| 7 | `src/modules/auth/use-cases/logout.use-case.spec.ts` | Unit tests |
| 8 | `src/modules/auth/use-cases/logout-all-devices.use-case.spec.ts` | Unit tests |
| 9 | `src/modules/auth/use-cases/forgot-password.use-case.spec.ts` | Unit tests |
| 10 | `src/modules/auth/use-cases/reset-password.use-case.spec.ts` | Unit tests |
| 11 | `src/modules/auth/use-cases/generate-tokens.use-case.spec.ts` | Unit tests |
| 12 | `test/auth.e2e-spec.ts` | E2E tests |

### Modified Files (7)

| # | File | Change |
|---|------|--------|
| 1 | `src/modules/auth/auth.controller.ts` | Add Google OAuth routes; fix import paths |
| 2 | `src/modules/auth/auth.module.ts` | Add new use cases to providers |
| 3 | `src/modules/auth/use-cases/forgot-password.use-case.ts` | Wire Resend email sending |
| 4 | `src/modules/auth/use-cases/index.ts` | Export new use cases |
| 5 | `src/config/env.validation.ts` | Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL` |
| 6 | `backend/.env.example` | Add `FRONTEND_URL` |
| 7 | `backend/context/plans/PROGRESS-TRACKER.md` | Update Phase 3 status |

---

## Risk & Decisions

| Decision | Rationale |
|----------|-----------|
| Use Resend (not nodemailer/SMTP) | Already in plan.md; simple HTTP API; no SMTP server needed |
| Google OAuth creates user if email not found | Matches existing plan; `passwordHash` nullable in schema supports this |
| No email verification flow | Out of scope per requirements.md; deferred |
| No Prisma `RefreshToken` table usage | Keep using Redis (faster revocation); Prisma model may be used later for audit |
| `supabaseUid` stays as random UUID | No Supabase Auth integration yet; field preserved for future compatibility |
| `FRONTEND_URL` needed for reset link | Reset email must link to frontend reset page, not backend |

---

## Definition of Done

- [ ] All import paths resolve correctly (`tsc --noEmit` clean)
- [ ] Resend sends actual password reset emails
- [ ] Google OAuth flow works end-to-end (initiate → consent → callback → tokens)
- [ ] All use cases have unit tests (≥ 90% coverage)
- [ ] E2E auth flow passes
- [ ] `npm run lint && npm run format` clean
- [ ] `npm run build` succeeds
- [ ] `PROGRESS-TRACKER.md` updated
