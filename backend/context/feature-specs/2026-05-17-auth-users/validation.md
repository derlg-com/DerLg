# Validation: Auth & Users

## Verification Criteria
- [ ] `POST /v1/auth/register` creates user, returns `{ user, accessToken }`, stores refresh token in Redis
- [ ] `POST /v1/auth/login` validates credentials, returns `{ accessToken }`, sets `refresh_token` httpOnly cookie
- [ ] `POST /v1/auth/refresh` reads cookie, validates refresh token, returns new `{ accessToken }`, rotates refresh token
- [ ] `POST /v1/auth/logout` invalidates refresh token cookie, removes from Redis
- [ ] `POST /v1/auth/logout-all` invalidates all refresh tokens for user in Redis
- [ ] `POST /v1/auth/forgot-password` sends reset email via Resend
- [ ] `POST /v1/auth/reset-password` validates token, updates password
- [ ] `POST /v1/auth/google` returns Google OAuth URL
- [ ] `GET /v1/auth/google/callback` handles code, creates/links user, returns tokens
- [ ] `GET /v1/users/me` returns current user profile (with Bearer JWT)
- [ ] `PATCH /v1/users/me` updates allowed fields (with Bearer JWT)
- [ ] Duplicate registration returns `AUTH_EMAIL_EXISTS` (409)
- [ ] Invalid login returns `AUTH_INVALID_CREDENTIALS` (401)
- [ ] Suspended account login returns `AUTH_ACCOUNT_SUSPENDED` (403)
- [ ] Invalid refresh token returns `AUTH_INVALID_REFRESH_TOKEN` (401)
- [ ] Expired refresh token rejected
- [ ] Auth endpoints rate-limited to 5 req / 5 min / IP (429)

## Test Plan
- **Unit tests:**
  - `AuthService.register()` — bcrypt hashing, Prisma create, token generation
  - `AuthService.login()` — credential validation, token generation, Redis storage
  - `AuthService.refresh()` — token validation, rotation, Redis swap
  - `AuthService.logout()` — Redis deletion
  - `AuthService.logoutAllDevices()` — Redis pattern deletion
  - `AuthService.forgotPassword()` — token generation, Resend call
  - `AuthService.resetPassword()` — token validation, bcrypt update
  - `UsersService.getProfile()` / `updateProfile()` — Prisma queries
- **E2E tests:**
  - Full flow: register → login → access protected → refresh → logout → access protected (401)
  - Double registration → 409
  - Wrong password → 401
  - Invalid refresh → 401
  - Profile update → verify persisted
- **Manual verification:**
  ```bash
  cd backend && npm run start:dev
  # Register
  curl -X POST http://localhost:3001/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
  # Login
  curl -X POST http://localhost:3001/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}' \
    -c cookies.txt
  # Get profile
  curl http://localhost:3001/v1/users/me \
    -H "Authorization: Bearer <access_token>"
  # Refresh
  curl -X POST http://localhost:3001/v1/auth/refresh \
    -b cookies.txt \
    -c cookies.txt
  ```

## Definition of Done
- [ ] All tasks in `plan.md` complete
- [ ] All verification criteria pass
- [ ] `npm run lint && npm run format` clean
- [ ] `npm run build` succeeds
- [ ] Auth service unit tests ≥ 90% coverage
- [ ] E2E auth flow passes
- [ ] `PROGRESS-TRACKER.md` updated
