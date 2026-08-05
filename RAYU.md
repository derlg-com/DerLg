# RAYU.md

This file provides guidance to RAYU when working with code in this repository.

## Services

Three independently runnable services:

| Service | Directory | Port | Tech |
|---------|-----------|------|------|
| Frontend | `web/` | 3002 | Next.js 16, React 19, Tailwind v4, TypeScript |
| Backend | `backend/` | 3003 | NestJS 11, Prisma, TypeScript |
| AI Agent | `vibe-booking/` | 8000 | Python 3.12, FastAPI, NVIDIA gpt-oss-120b |

> Dev runs on ports 4007/4008/4009 via shell env overrides to avoid clashes with the configured defaults above.

## Common Commands

### Frontend (`cd web`)
```bash
npm run dev          # Dev server
npm run build        # Production build (next build + Serwist PWA service worker)
npm run lint         # ESLint
npm run lint:fix     # ESLint with --fix
npm run format       # Prettier write
npm run test         # Vitest (run once)
npm run test:watch   # Vitest in watch mode
npm run test:coverage# Vitest with coverage
npm run e2e          # Playwright E2E tests
npm run e2e:ui       # Playwright interactive UI mode
```

### Backend (`cd backend`)
```bash
npm run start:dev    # Hot-reload dev server
npm run build        # Compile TS → dist/
npm run test         # Jest unit tests
npm run test:e2e     # E2E tests (test/)
npm run test:cov     # Jest with coverage
npm run lint         # ESLint with auto-fix
npm run format       # Prettier
npx jest src/path/to/file.spec.ts   # Single test file
npm run test -- src/path/to/file.spec.ts  # Same, via npm script
npx prisma migrate dev              # Apply DB migrations
npx prisma generate                 # Regenerate Prisma client
npx prisma studio                   # DB GUI
npm run prisma:seed                 # Seed DB (ts-node prisma/seeds/run.ts)
npm run prisma:migrate:reset        # Reset DB + re-run all migrations
npm run prisma:migrate:deploy        # Apply pending migrations (prod-style)
```

### AI Agent (`cd vibe-booking`)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload   # Dev server

pytest                                        # All tests
pytest tests/unit/                            # Unit only
pytest --cov=agent --cov-report=html          # With coverage
```

## Infrastructure

### PostgreSQL
Primary database is **PostgreSQL via Supabase**, local dev on port **54322**. Connection is configured via `DATABASE_URL` and `DIRECT_URL` env vars in `backend/.env`.

### Redis
Used by both the backend (sessions, rate limiting, booking holds with 15-min TTL) and the AI agent (session state, pub/sub for payment events). Dev: `redis:8.6-alpine` on port **6379** via `backend/docker-compose.yml`.

### MinIO (object storage for images/media — dev only)
Self-hosted in Docker. Used by the backend for image and media uploads. Access the MinIO console at `http://localhost:9001` (default dev credentials in `.env`).

### Docker (`cd backend`)
```bash
docker compose up -d   # Starts: postgres (5433), redis (6379)
```

## Architecture

```
Next.js (3002) ──REST /v1/*──► NestJS (3003) ──X-Service-Key──► Python AI (8000)
                                     │
               ┌─────────────────────┼────────────────┐
               ▼                     ▼                ▼
         Supabase PG            Redis (6379)        MinIO (9000)
```

- **Frontend ↔ Backend:** REST with `{ success, data, message, error }` envelope. Bearer JWT in `Authorization` header.
- **Frontend ↔ AI Agent:** WebSocket at `/ws/chat`. Structured JSON message types (`agent_message`, `trip_cards`, `qr_payment`, `custom_trip_card`, etc.).
- **AI Agent → Backend:** HTTP tool calls to `/v1/ai-tools/*` authenticated with `X-Service-Key` header. The AI agent **never writes to the DB directly**.
- **Response format:** AI sends structured JSON `content_payload`; the frontend owns all rendering.

## Where Things Live

### Backend modules (`backend/src/modules/`)
`ai-tools` · `auth` · `bookings` · `guides` · `hotels` · `places` · `prisma` · `redis` · `search` · `transportation` · `trips` · `users`
Cross-cutting code lives in `backend/src/common/` (`guards`, `interceptors`, `filters`, `decorators`, `dto`, `errors`, `cache`, `i18n`, `types`). Config validation in `backend/src/config/env.validation.ts`.

### Frontend route groups (`web/app/`)
- `(auth)/` — login, register, reset-password (no main nav)
- `(app)/` — main app shell with bottom nav (home, explore, booking, my-trip, profile)
- `vibe-booking/` — full-screen AI chat page
- `~offline/` — offline fallback
- `ui-kit/` — design-system showcase

### Frontend i18n
next-intl translation files live in `web/messages/{en,zh,km}.json` (not `public/locales/`). Locale routing is in `web/middleware.ts`.

## Dev Gotchas

- **`web/next.config.ts` MinIO flags are intentional.** `dangerouslyAllowLocalIP` and `dangerouslyAllowSVG` are required because MinIO runs on `localhost:9000` in dev and serves seed placeholder SVGs with a `.jpg` extension. Do not "harden" these away without replacing the image source.
- **Frontend build = `next build` + Serwist PWA.** `npm run build` runs both; use `npm run build:next` if you only need the Next.js build (e.g. when iterating on non-PWA code).
- **Vibe-booking env precedence.** A shell-exported `NVIDIA_API_KEY` shadows the value in `vibe-booking/.env` and will cause HTTP 403s from NVIDIA NIM. If chat returns "Something went wrong" on every turn, relaunch uvicorn with the conflicting env var unset so pydantic-settings falls through to `.env`. Run uvicorn **without `--reload`** — the reloader hangs on slow in-flight LLM calls.

## Key Conventions

- API prefix: `/v1/` (backend), `/v1/ai-tools/*` (AI service endpoints)
- Naming: React components `PascalCase`, utilities `kebab-case`, variables/functions `camelCase`, constants `UPPER_SNAKE_CASE`, DB tables `snake_case`
- Frontend imports use `@/` alias; backend uses relative imports within a module
- Never hardcode secrets — all credentials via env vars; `.env` files are gitignored
- Backend spec files live in `backend/context/` — read before modifying endpoints or schema:
  - `context/guides/` — CONSTITUTION.md (module dependency rules), CODE-STANDARD.md, TECH-STACK.md, SUPABASE-WORKFLOW.md, MISSION.md
  - `context/specs/` — SCHEMA.md, API-CONTRACT.md, ERROR-REGISTRY.md, EVENT-CATALOG.md
  - `context/plans/` — ROADMAP.md, TEST-PLAN.md, SEED-SPEC.md
- AI agent module docs in `vibe-booking/AGENT.md`; frontend docs in `web/AGENTS.md`

## Authoritative Spec Files

| What | Where |
|------|-------|
| DB schema (Prisma) | `backend/context/specs/SCHEMA.md` + `backend/prisma/schema.prisma` |
| All ~80 API endpoints | `backend/context/specs/API-CONTRACT.md` |
| Error codes | `backend/context/specs/ERROR-REGISTRY.md` |
| Backend implementation roadmap | `backend/context/plans/ROADMAP.md` + `IMPLEMENTATION-ROADMAP.md` |
| Backend code rules & patterns | `backend/context/guides/CONSTITUTION.md`, `CODE-STANDARD.md` |
| AI agent architecture | `vibe-booking/AGENT.md` |
| Frontend specs | `.kiro/specs/frontend-nextjs-implementation/` |
| Vibe Booking AI specs | `.kiro/specs/vibe-booking/` |
