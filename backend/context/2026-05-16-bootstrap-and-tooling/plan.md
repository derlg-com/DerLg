# Phase 0: Bootstrap & Tooling — Implementation Plan

> Branch: `feature/2026-05-16-bootstrap-and-tooling`
> Scope: Tasks 0.1–0.5 (GitHub Actions CI deferred to a follow-up branch per user decision)
> Baseline: Adapt existing NestJS 11 boilerplate; add missing pieces only

---

## Task Group 1 — TypeScript Configuration (0.1)

**Goal:** Align `tsconfig.json` with project standards defined in `TECH-STACK.md`.

**Reference:** `backend/context/guides/TECH-STACK.md` §Language & TypeScript

**Actions:**
1. Read existing `backend/tsconfig.json` and compare against spec requirements.
2. Ensure the following keys are set correctly:
   - `strictNullChecks: true`
   - `noImplicitAny: false`
   - `strictBindCallApply: false`
   - `moduleResolution: nodenext`
   - `emitDecoratorMetadata: true`
   - `esModuleInterop: true`
   - `skipLibCheck: true`
3. Verify `include`/`exclude` paths cover `src/` and `test/`.
4. Run `npm run build` to confirm compilation succeeds with zero errors.

**Verification:** `npm run build` exits 0.

**Status:** ✅ Verified — `tsconfig.json` already correct.

---

## Task Group 2 — ESLint + Prettier Configuration (0.2)

**Goal:** Establish linting and formatting rules per `CODE-STANDARD.md`.

**Reference:** `backend/context/guides/CODE-STANDARD.md` §1, `.prettierrc`

**Actions:**
1. Verify `backend/.prettierrc` sets:
   - `singleQuote: true`
   - `trailingComma: all`
2. Verify `backend/eslint.config.mjs` sets:
   - `@typescript-eslint/no-explicit-any: off`
   - `@typescript-eslint/no-floating-promises: warn`
   - `prettier/prettier: error`
3. Add missing peer/config dependencies if absent.
4. Run `npm run lint && npm run format` — must be clean (zero unfixable errors).

**Verification:** `npm run lint && npm run format` exits 0.

**Status:** ✅ Verified — `.prettierrc` and `eslint.config.mjs` already correct.

---

## Task Group 3 — Docker Compose & Dockerfile (0.3)

**Goal:** Provide Docker infrastructure for development (Redis only) and production (Postgres + Redis).

**Reference:** `backend/context/guides/TECH-STACK.md` §Docker

**Architecture Decision:**
- **Development:** Uses Supabase cloud PostgreSQL + local Docker Redis.
- **Production:** Uses Docker PostgreSQL 15 (pinned to match Supabase) + Docker Redis 8.6.

**Actions:**
1. Create `backend/docker-compose.yml` with Redis service only (dev):
   - `redis` — `redis:8.6-alpine`, port `6379`, health check
2. Create `backend/docker-compose.prod.yml` with full stack:
   - `postgres` — `postgres:15-alpine`, port `5432`, health check, persistent volume
   - `redis` — `redis:8.6-alpine`, port `6379`, health check
   - `backend` — multi-stage build from `Dockerfile`, port `3001`
3. Create `backend/Dockerfile` with multi-stage targets:
   - `deps` — production dependencies
   - `build` — compile TypeScript
   - `production` — minimal runtime image
   - `development` — hot-reload image
4. Ensure environment variables are wired via `.env` or `environment` blocks.
5. Confirm `docker-compose up` brings Redis to healthy state.

**Verification:** `docker-compose up` → Redis healthy; `docker-compose -f docker-compose.prod.yml up` → all services healthy.

---

## Task Group 4 — Environment Variable Template (0.4)

**Goal:** Document every required environment variable in a single template file.

**Reference:** `backend/context/guides/TECH-STACK.md` §Environment Variables

**Actions:**
1. Create `backend/.env.example` listing all required vars with comments:
   ```
   # App
   PORT=3001
   NODE_ENV=development
   CORS_ORIGINS=

   # Database
   # Dev: Supabase pooler URL; Prod: Docker postgres URL
   DATABASE_URL=
   # Dev: Supabase direct URL (for migrations); Prod: same as DATABASE_URL
   DIRECT_URL=

   # Redis
   REDIS_URL=

   # Auth
   JWT_ACCESS_SECRET=
   JWT_REFRESH_SECRET=

   # Stripe
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=

   # AI Service
   AI_SERVICE_KEY=

   # External Services (Optional for Phase 0)
   RESEND_API_KEY=
   FCM_SERVER_KEY=
   EXCHANGE_RATE_API_KEY=
   ```
2. Ensure no secrets are pre-filled.
3. Cross-check against `TECH-STACK.md` that no variable is missing.

**Verification:** Every env var from `TECH-STACK.md` is present and documented.

---

## Task Group 5 — Health Endpoint & Port Configuration (0.5)

**Goal:** Confirm backend runs on port `3001` and exposes a `/health` endpoint.

**Reference:** `backend/context/guides/MISSION.md` §Target State

**Actions:**
1. Update `main.ts` to default port `3001` (was `3000`).
2. Add `GET /health` to `AppController` returning `{ status: 'ok', service: 'derlg-backend' }`.
3. Start the dev server (`npm run start:dev`) and confirm it listens on `:3001`.
4. `curl http://localhost:3001/health` → `200 OK`.

**Verification:** `GET /health` responds with 200 and JSON body.

---

## Deferred Work

- **0.6 GitHub Actions CI** — lint, test, build on PR — moved to a follow-up branch per user decision.
