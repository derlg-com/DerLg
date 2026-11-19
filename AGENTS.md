# DerLg — Agent Context Index

> This file lives in the repository root. Read it first when starting any work on this project, then read the `AGENTS.md` inside the relevant service directory.

---

## What Is DerLg?

DerLg is a **Cambodia travel booking platform** with an AI-powered concierge. Travelers discover trips, hotels, guides, and transport; compose multi-item bookings; and pay by card or Cambodian ABA QR. An AI agent ("Vibe Booking") guides the journey over WebSocket. Staff manage operations through an admin panel.

The platform is a **monorepo** of four services:

| Service | Tech | Port (dev) | Directory | Purpose |
|---------|------|-----------|-----------|---------|
| **Backend** | NestJS · Prisma · Socket.io | 4007 | `backend/` | Single API server: public `/v1/*`, AI `/v1/ai-tools/*`, admin `/v1/admin/*`, Telegram `/v1/telegram/*` |
| **Web** | Next.js 16 · React 19 · TanStack Query | 4008 | `web/` | Customer-facing booking site with AI chat |
| **Vibe Booking** | FastAPI · Python · Redis | 4009 | `vibe-booking/` | Stateful AI booking concierge (WebSocket + 16-tool loop) |
| **Admin** | Next.js 16 · React 19 · shadcn | 4010 | `derlg-system-admin/` | Staff-only admin panel (frontend-only; API lives in backend) |

> Dev ports (4007–4010) differ from the configured defaults (backend 3003 in `.env`, code fallback 3001; web 3002; agent 8000 settings default; admin 5000). `run-all.sh` sets the dev ports via env override.

---

## Quick Start

```bash
# From the repository root:
./run-all.sh          # start all four services, stream logs
./run-all.sh backend  # start only one; see run-all.sh for names
```

First run — database and seed:

```bash
cd backend
docker compose up -d                    # Postgres + Redis (MinIO runs separately)
npx prisma migrate deploy               # apply migrations (never migrate dev)
npm run prisma:seed                     # reference data + admin accounts
```

> Primary dev setup uses native Postgres (:5434) and Redis (:6380) via systemd;
> Docker Compose is the fallback (Postgres publishes :5433 there). See
> `backend/.env.example`. Supabase is not used in any environment.

Then sign in:
- **Admin** → http://localhost:4010 (`admin@derlg.demo`, password from `SEED_ADMIN_PASSWORD`)
- **Web** → http://localhost:4008
- **API** → http://localhost:4007/v1/health

---

## Service Communication

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser                                    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Web (4008)  │  │ Admin (4010) │  │  Chat UI (in web)      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘ │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │ REST /v1/*      │ REST /v1/admin/*     │
          │ TanStack Query  │ axios + Zustand      │
          │                 │                      │ WebSocket
          ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│              Backend (NestJS, 4007)                               │
│                                                                   │
│  /v1/* (public)  /v1/admin/* (JWT+role)  /v1/telegram/* (bot)   │
│       │                  │                        │               │
│       │                  │                        │               │
│  ┌────▼──────────────────▼────────────────────────▼────────────┐ │
│  │  Prisma · Redis · BullMQ · MinIO · Stripe                  │ │
│  └────────────────────────────┬───────────────────────────────┘ │
│                               │ /v1/ai-tools/* (X-Service-Key)  │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
                ┌───────────────────────────────┐
                │   Vibe Booking (FastAPI, 4009) │
                │   WebSocket /ws/chat           │
                │   16 tools → backend           │
                │   Redis sessions (7-day TTL)   │
                └───────────────────────────────┘
```

**Key protocols:**
- **Web → Backend**: HTTP REST at `/v1/*`, TanStack Query for server state, typed client in `web/lib/api/client.ts`
- **Web → AI Agent**: WebSocket at `/ws/chat`, typed client in `web/lib/vibe/socket.ts`, React hook in `web/hooks/use-vibe-socket.ts`
- **Web BFF**: `web/app/api/ai/*` proxies AI requests server-side using `AI_SERVICE_KEY` (never exposed to browser)
- **Admin → Backend**: HTTP REST at `/v1/admin/*`, axios client in `derlg-system-admin/lib/api.ts`, Zustand store in `derlg-system-admin/store/adminStore.ts`
- **AI → Backend**: HTTP at `/v1/ai-tools/*`, authenticated via `X-Service-Key` header, circuit breaker + 15s timeout

---

## Repository Layout

```
DerLg/
├── backend/                    # NestJS API (see backend/AGENTS.md)
│   ├── prisma/                 # Schema, migrations, seeds
│   ├── src/
│   │   ├── main.ts             # Bootstrap: pipes, filters, CORS, /v1 prefix
│   │   ├── app.module.ts       # Module dependency graph
│   │   ├── common/             # Guards, interceptors, filters, decorators, cache, i18n
│   │   ├── config/             # Env validation (Zod)
│   │   └── modules/            # 16 feature modules (admin, ai-tools, auth, bookings, ...)
│   └── docker-compose.yml      # Postgres + Redis (fallback/CI; MinIO separate)
│
├── web/                        # Customer Next.js app (see web/README.md)
│   ├── app/[locale]/           # Localised routes (en | zh | km)
│   ├── app/api/ai/             # BFF route handlers (server-only service key)
│   ├── components/             # Feature components + ui/ design system
│   ├── hooks/                  # React hooks (auth, booking, vibe socket, ...)
│   ├── lib/
│   │   ├── api/                # Typed backend client, query keys, errors
│   │   ├── vibe/               # WebSocket client + protocol types
│   │   ├── auth/               # Token verification
│   │   └── i18n/               # Locale config + request.ts for next-intl
│   ├── messages/               # next-intl catalogues (en, zh, km)
│   ├── schemas/                # Zod contracts
│   └── e2e/                    # Playwright tests
│
├── vibe-booking/               # AI agent (see vibe-booking/AGENT.md)
│   ├── agent/
│   │   ├── core.py             # Async tool loop (run_agent)
│   │   ├── backend_client.py   # HTTP client to backend (circuit breaker)
│   │   ├── tools/_defs.py      # 16 tool schemas + dispatch map
│   │   ├── prompts/            # System prompt builder + templates
│   │   ├── session/            # ConversationState + Redis manager
│   │   └── models/             # LLM client factory (Gateway, Ollama)
│   ├── api/                    # WebSocket endpoint, health, middleware
│   ├── config/settings.py      # Pydantic BaseSettings
│   └── main.py                 # FastAPI entry point
│
├── derlg-system-admin/         # Admin Next.js app (frontend-only)
│   ├── app/admin/              # Admin routes (dashboard, bookings, trips, ...)
│   ├── components/admin/       # Admin feature components
│   ├── lib/api.ts              # Axios client to /v1/admin/*
│   ├── store/adminStore.ts     # Zustand auth + permissions store
│   ├── hooks/                  # useAdminWebSocket, usePermission, ...
│   └── docs/                   # Architecture diagrams, specs
│
├── data/                       # Seed imagery (PhnomPenh, SiemReap)
├── logs/                       # Service logs (gitignored)
├── run-all.sh                  # Start all four services
└── .gitignore
```

---

## API Conventions (Backend)

- **Prefix**: `/v1/` set globally in `main.ts` via `setGlobalPrefix('v1')`. Do **not** write `v1/` inside `@Controller()` — doing both gives `/v1/v1/...` which silently 404s.
- **Envelope**: `{ success, data, message, error }` — `TransformInterceptor` wraps every success response.
- **Auth**: Bearer JWT in `Authorization` header; service-to-service via `X-Service-Key`; Telegram via webhook secret/PIN.
- **Validation**: `forbidNonWhitelisted: true` — every new query param **must** be declared in the DTO or requests return 400.
- **Naming**: NestJS controllers `feature.controller.ts`, services `feature.service.ts`, DTOs `feature.dto.ts`.

---

## Authentication Architecture

| Layer | Mechanism | Where |
|-------|-----------|-------|
| Customer (web) | JWT access (15m) + httpOnly refresh cookie | `backend/src/modules/auth/` |
| Admin | JWT access (15m) + httpOnly refresh cookie + `admin_users` grant | `backend/src/modules/admin/` + `derlg-system-admin/store/adminStore.ts` |
| AI agent → backend | `X-Service-Key` header (32+ chars) | `vibe-booking/agent/backend_client.py` |
| Telegram driver bot | Webhook secret / PIN | `backend/src/modules/telegram/` |
| WebSocket (admin) | JWT in handshake auth | `backend/src/modules/admin/websocket/admin.gateway.ts` |

**Guards are global** — `JwtAuthGuard`, `RolesGuard`, `AdminRoleGuard` are registered as `APP_GUARD` in `common.module.ts`. Do not add `@UseGuards(JwtAuthGuard)` to controllers. Use `@Public()` to opt out, `@Roles()` for the JWT claim, `@AdminRoles()` for the `admin_users` grant.

---

## Internationalisation

Three-letter locale codes flow through every layer. `web/lib/i18n/config.ts` owns the mappings:

| Consumer | Shape | Example (Khmer) |
|----------|-------|-----------------|
| next-intl (URL, messages) | short code | `km` |
| `<html lang>` | BCP 47 tag | `km-KH` |
| Backend `Accept-Language` | quality-weighted | `km-KH,en-US;q=0.8` |
| AI agent | uppercase enum | `KH` (not `KM`) |

Routes live under `web/app/[locale]/`, so every URL carries its language: `/en/trips`, `/km/trips`. Locale resolution: URL prefix → `NEXT_LOCALE` cookie → `Accept-Language`. `web/tests/i18n.test.ts` fails the build if catalogues drift.

---

## Database

- **Schema**: `backend/prisma/schema.prisma`
- **Dev**: native PostgreSQL (:5434) + Redis (:6380) via systemd; `docker compose up -d` is the fallback (Postgres :5433). No Supabase.
- **Migrations**: write SQL by hand, then `npx prisma migrate deploy`. Generate a candidate with `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` and review before applying. Prefer `migrate deploy` over `migrate dev`.
- **Seed**: `npm run prisma:seed` (idempotent, dependency-ordered)

---

## Testing

| Service | Framework | Run |
|---------|-----------|-----|
| Backend | Jest (unit + e2e) | `npm test`, `npm run test:e2e` |
| Web | Vitest + Testing Library · Playwright | `npm run test`, `npm run e2e` |
| Vibe Booking | pytest + hypothesis | `pytest`, `pytest --cov=agent --cov-report=html` |
| Admin | Jest + Testing Library | `npm test` |

---

## Environment Variables

Each service has its own `.env` (see `.env.example` files):

| Service | Key vars | Notes |
|---------|----------|-------|
| Backend | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `REDIS_URL`, `STRIPE_SECRET_KEY`, `AI_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN` | Validated at boot with Zod |
| Web | `NEXT_PUBLIC_API_URL`, `AI_SERVICE_KEY`, `JWT_ACCESS_SECRET` | `AI_SERVICE_KEY` and `JWT_ACCESS_SECRET` are server-only |
| Vibe Booking | `LLM_API_KEY`, `BACKEND_URL`, `AI_SERVICE_KEY`, `REDIS_URL` | `AI_SERVICE_KEY` must match backend's |
| Admin | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Frontend-only; no secrets |

**Critical matches**: `AI_SERVICE_KEY` must be identical across backend, web, and vibe-booking. `JWT_ACCESS_SECRET` must match between backend and web.

---

## Cross-Service Gotchas

- **NVIDIA_API_KEY shadowing**: unset before launching the AI agent — a stale shell-exported key overrides the configured LLM gateway.
- **Compiled entrypoint is `dist/src/main.js`**, not `dist/main.js` — a stray `debug_e2e.ts` at the project root shifts the TypeScript rootDir. `package.json`'s `start:prod` is updated to `node dist/src/main`.
- **`rawBody: true` in `main.ts` is load-bearing** — Stripe signs the exact bytes it sent; the webhook controller verifies against `request.rawBody`. Remove it and every webhook returns 400.
- **Refresh tokens live only in Redis** at `session:{userId}:{tokenId}`. The `refresh_tokens` table is never written to. To revoke a session, delete the Redis keys via `RedisService.delByPattern`.
- **Paginated admin handlers must return the service result directly** so `TransformInterceptor` wraps it as `{ success, data: { data, meta } }`. Building an envelope by hand drops pagination.
- **ABA payments settle out-of-band** — `AbaTelegramListener` marks a booking paid from a Telegram credit alert, not the request/response cycle. Ambiguous matches deliberately settle nothing.
- **Rate limiting** is enforced by `CustomThrottlerGuard`, registered first in `common.module.ts`. Only ONE throttler may be registered in `ThrottlerModule`. Use `@RateLimit('AUTH' | 'PAYMENT' | ...)` for per-route limits.
- **BigInt columns need the `json replacer`** in `main.ts` — `drivers.telegram_id` is a bigint and `JSON.stringify` throws on it.
- **AI agent runs without `--reload`** — the uvicorn reloader hangs on slow in-flight LLM calls.
- **`SEED_ADMIN_PASSWORD` is often present-but-empty** — use a length check, not `??`, when falling back to the dev default.

---

## External References

| File | Purpose |
|------|---------|
| `backend/AGENTS.md` | Backend module index, API conventions, dev gotchas |
| `web/README.md` | Web stack, scripts, i18n, architecture |
| `vibe-booking/AGENT.md` | AI agent architecture, tool system, WebSocket protocol, session management |
| `derlg-system-admin/README.md` | Admin quick start, first-run setup, troubleshooting |
| `derlg-system-admin/START.md` | Admin manual start, health checks, common problems |
| `derlg-system-admin/docs/architecture/` | Admin architecture diagrams (Mermaid) |
| `run-all.sh` | Start all four services with live log streaming |
