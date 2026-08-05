# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DerLg** is a Cambodia travel booking platform with an AI-powered "Vibe Booking" feature — a conversational AI concierge that lets travelers discover, plan, and book trips through natural language chat.

**Target users:** International tourists, Chinese tourists (primary market), students, and safety-conscious travelers. **Languages:** English (EN), Chinese (ZH), Khmer (KM).

**Current state:** Implemented and running — Next.js frontend (`web/`), NestJS backend (`backend/`), and Python AI agent (`vibe-booking/`). All three services run locally and communicate via REST + WebSocket.

---

## Monorepo Layout

```
derlg/
├── web/                 # Next.js 16 App Router (port 3002, dev on 4008)
├── backend/             # NestJS 11 API (port 3003, dev on 4007)
├── vibe-booking/        # Python FastAPI AI agent (port 8000, dev on 4009)
├── data/                # Seed images and static data
├── docs/                # PRD, architecture, feature specs
│   ├── product/         # prd.md, feature-decisions.md
│   ├── platform/        # system-overview.md, roadmaps, guides
│   └── modules/         # Per-feature API specs (api.yaml)
└── .kiro/               # Kiro workspace config
    ├── steering/        # tech.md, structure.md, product.md
    └── specs/           # Detailed implementation specs per workstream
```

For detailed requirements and design decisions, see `docs/product/prd.md` and `docs/product/feature-decisions.md`. For module-level API contracts, see `docs/modules/<feature>/api.yaml`.

---

## Technology Stack

### Frontend (`web/`)
- **Framework:** Next.js 16.2.12 with App Router
- **React:** 19.2.4
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 with `@tailwindcss/postcss`
- **Fonts:** Geist (via `next/font/google`)
- **Path alias:** `@/*` maps to `./*`
- **State/data:** Zustand, React Query, zod, react-hook-form
- **i18n:** next-intl (`web/messages/{en,zh,km}.json`)
- **Maps:** Leaflet + react-leaflet + OpenStreetMap
- **Markdown:** react-markdown + remark-gfm (AI chat responses)

### Backend (`backend/`)
- **Framework:** NestJS 11
- **Language:** TypeScript 5.7.3
- **ORM:** Prisma 6
- **Testing:** Jest 30, ts-jest, Supertest
- **Linting:** ESLint 9 with `typescript-eslint` recommended-type-checked
- **Formatting:** Prettier 3 (`singleQuote: true`, `trailingComma: "all"`)
- **TypeScript:** `nodenext` module resolution, `emitDecoratorMetadata`, `strictNullChecks: true`
- **Auth:** Passport JWT, bcrypt
- **Validation:** class-validator, class-transformer (forbidNonWhitelisted: true)

### AI Agent (`vibe-booking/`)
- **Framework:** Python 3.12 + FastAPI
- **LLM:** NVIDIA gpt-oss-120b (via OpenAI-compatible API)
- **Pattern:** Hand-rolled async tool loop (not LangGraph) — see `vibe-booking/AGENT.md`
- **Tools:** 15+ tools (search_trips, search_hotels, search_guides, search_transport, create_trip, create_booking_hold, generate_payment_qr, etc.)
- **Session:** Redis-backed with 7-day TTL
- **Testing:** pytest + pytest-asyncio

---

## Common Commands

### Frontend (run from `web/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (next build + Serwist PWA) |
| `npm run start` | Start production server |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` | Prettier |
| `npm run test` / `npm run test:watch` | Vitest |
| `npm run test:coverage` | Vitest with coverage |
| `npm run e2e` / `npm run e2e:ui` | Playwright E2E |

### Backend (run from `backend/`)

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | NestJS with hot reload (`--watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled app (`node dist/main`) |
| `npm run test` / `npm run test:watch` | Jest unit tests |
| `npm run test:e2e` | E2E tests (`test/`) |
| `npm run test:cov` | Jest with coverage |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npx prisma migrate dev` | Create + apply migration |
| `npx prisma generate` | Regenerate Prisma Client |
| `npx prisma db push` | Push schema without migration |
| `npm run prisma:seed` | Seed DB (`ts-node prisma/seeds/run.ts`) |

**Run a single test file:** `npx jest src/path/to/file.spec.ts` or `npm test -- src/path/to/file.spec.ts`

### AI Agent (run from `vibe-booking/`)

| Command | Purpose |
|---------|---------|
| `uvicorn main:app --host 0.0.0.0 --port 8000 --reload` | Dev server (use `env -u NVIDIA_API_KEY` to avoid 403s) |
| `pytest` | All tests |
| `pytest tests/unit/` | Unit only |
| `pytest --cov=agent --cov-report=html` | With coverage |

---

## High-Level Architecture

```
┌──────────────┐     REST      ┌──────────────┐     Tools     ┌──────────────┐
│  Next.js     │ ◄──────────► │   NestJS     │ ◄──────────► │ Python AI    │
│  (Frontend)  │   (/v1/*)    │  (Backend)   │   (/v1/ai-tools/*) │  (FastAPI)   │
│  Port 3002   │              │  Port 3003   │              │  Port 8000   │
└──────────────┘              └──────┬───────┘              └──────────────┘
                                     │
                    ┌────────────────┼────────────────┬────────────────┐
                    ▼                ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ Supabase │    │  Redis   │    │  Stripe  │    │  MinIO   │
              │   (PG)   │    │ (Cache)  │    │(Payments)│    │ (Images, │
              └──────────┘    └──────────┘    └──────────┘    │  Media)  │
                                                              └──────────┘
```

### Communication Patterns
- **Frontend ↔ Backend:** REST JSON with `{ success, data, message, error }` envelope. Base prefix `/v1/`. Auth via Bearer JWT in `Authorization` header.
- **Frontend ↔ AI Agent:** WebSocket at `/ws/chat` for chat; structured message types (text, card, action, qr, custom_trip_card).
- **AI Agent ↔ Backend:** REST tool endpoints with service key auth (`X-Service-Key` header). The AI agent never writes directly to the database.
- **Backend → External:** Stripe API, Resend email, FCM push, ExchangeRate-API.

### Data Model
Key entities: `users`, `trips`, `places`, `hotels`/`hotel_rooms`, `transportation_vehicles`, `guides`, `bookings`/`booking_items`, `payments`, `reviews`, `festivals`, `discount_codes`, `loyalty_transactions`, `emergency_alerts`, `student_verifications`, `notifications`, `ai_sessions`, `audit_logs`. All tables use UUID primary keys, `TIMESTAMPTZ`, `DECIMAL(10,2)` for money, `JSONB` for flexible structures.

---

## Code Conventions

### Naming

| Category | Convention | Example |
|----------|------------|---------|
| React components | PascalCase | `ChatWindow.tsx` |
| Utilities / helpers | kebab-case | `api-client.ts` |
| Variables / functions | camelCase | `getUserProfile` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| NestJS modules | feature.module.ts | `auth.module.ts` |
| NestJS services | feature.service.ts | `auth.service.ts` |
| NestJS controllers | feature.controller.ts | `auth.controller.ts` |
| NestJS DTOs | feature.dto.ts | `create-user.dto.ts` |
| Database tables | snake_case | `hotel_rooms` |

### Imports
- **Frontend:** Use `@/` alias for absolute imports from project root. Use relative imports within the same feature.
- **Backend:** Use relative imports within the same module; use absolute imports (`src/...`) for cross-module dependencies.

### TypeScript
- **Frontend:** `strict: true` (enforced in `tsconfig.json`).
- **Backend:** `strictNullChecks: true`, `noImplicitAny: false`, `strictBindCallApply: false`.
- Backend ESLint: `@typescript-eslint/no-explicit-any: off`, `@typescript-eslint/no-floating-promises: warn`, `prettier/prettier: error`.

---

## Dev Gotchas

- **`web/next.config.ts` MinIO flags are intentional.** `dangerouslyAllowLocalIP` and `dangerouslyAllowSVG` are required because MinIO runs on `localhost:9000` in dev and serves seed placeholder SVGs with a `.jpg` extension. Do not "harden" these away without replacing the image source.
- **Frontend build = `next build` + Serwist PWA.** `npm run build` runs both; use `npm run build:next` if you only need the Next.js build.
- **Vibe-booking env precedence.** A shell-exported `NVIDIA_API_KEY` shadows the value in `vibe-booking/.env` and will cause HTTP 403s from NVIDIA NIM. Relaunch uvicorn with the conflicting env var unset (`env -u NVIDIA_API_KEY`). Run **without `--reload`** — the reloader hangs on slow in-flight LLM calls.
- **Backend DB has pre-existing drift.** `prisma migrate dev` may not work cleanly; use `prisma db push` or `prisma migrate deploy` as needed.

---

## Security & Auth

- Never hardcode API keys or secrets. Environment files (`.env`, `.env.local`, `.env.*.local`) are gitignored.
- Required backend env vars: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AI_SERVICE_KEY`, `REDIS_URL`.
- JWT access tokens expire after 15 minutes; refresh tokens expire after 7 days and are stored in `httpOnly Secure SameSite=Strict` cookies.
- Rate limiting: auth endpoints 5 requests / 5 min / IP; payment intent 3 requests / min / user.
- The AI agent is not allowed to write directly to the database; it must call backend `/v1/ai-tools/*` endpoints with a service key (`X-Service-Key` header).
- Supabase Row-Level Security (RLS) must be enabled on all tables.
- Stripe webhooks must verify signatures.
- CORS must be whitelisted to production origins only.

---

## Release Scope

| Phase | Focus | Timeline |
|-------|-------|----------|
| MVP | Auth, booking core, AI chat, payments, PWA | Launch |
| v1.1 | Loyalty, student discount, offline maps | +6 weeks |
| v1.2 | Emergency system, location sharing, festival calendar | +12 weeks |
| v2.0 | Admin dashboard, analytics, referral program | +20 weeks |

Features are tracked by `F##` IDs (e.g., F01–F06 for auth, F10–F16 for Vibe Booking). See `docs/product/feature-decisions.md` for the canonical registry.

---

## Key External Resources

- `docs/product/prd.md` — Product Requirements Document (single source of truth)
- `docs/product/feature-decisions.md` — Canonical feature registry with scope, priority, status
- `docs/platform/architecture/system-overview.md` — System architecture, auth flow, payment flow
- `.kiro/specs/*/requirements.md` — Deep implementation specs for each workstream
- `.kiro/steering/tech.md` — Technology stack decisions and common commands
- `.kiro/steering/structure.md` — Planned directory structure and naming conventions
- `docs/glossary.md` — Domain terms and abbreviations
