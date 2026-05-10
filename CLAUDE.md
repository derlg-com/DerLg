# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DerLg** is a Cambodia travel booking platform with an AI-powered "Vibe Booking" feature — a conversational AI concierge that lets travelers discover, plan, and book trips through natural language chat. It is a full-stack application in early scaffolding: Next.js frontend, NestJS backend, and a planned Python AI agent service.

**Target users:** International tourists, Chinese tourists (primary market), students, and safety-conscious travelers. **Languages:** English (EN), Chinese (ZH), Khmer (KM).

**Current state:** Both frontend and backend are mostly default boilerplate from `create-next-app` and the NestJS CLI. Extensive planning docs live in `docs/` and `.kiro/specs/`, but implementation work has not yet begun in earnest.

---

## Monorepo Layout

```
derlg/
├── frontend/          # Next.js 16 App Router (port 3000)
├── backend/           # NestJS 11 API (port 3001)
├── docs/              # PRD, architecture, feature specs
│   ├── product/       # prd.md, feature-decisions.md
│   ├── platform/      # system-overview.md, roadmaps, guides
│   └── modules/       # Per-feature API specs (api.yaml)
└── .kiro/             # Kiro workspace config
    ├── steering/      # tech.md, structure.md, product.md
    └── specs/         # Detailed implementation specs per workstream
```

For detailed requirements and design decisions, see `docs/product/prd.md` and `docs/product/feature-decisions.md`. For module-level API contracts, see `docs/modules/<feature>/api.yaml`.

---

## Technology Stack

### Frontend (`frontend/`)
- **Framework:** Next.js 16.2.6 with App Router
- **React:** 19.2.4
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 with `@tailwindcss/postcss`
- **Fonts:** Geist (via `next/font/google`)
- **Path alias:** `@/*` maps to `./*`

### Backend (`backend/`)
- **Framework:** NestJS 11
- **Language:** TypeScript 5.7.3
- **Testing:** Jest 30, ts-jest, Supertest
- **Linting:** ESLint 9 with `typescript-eslint` recommended-type-checked
- **Formatting:** Prettier 3 (`singleQuote: true`, `trailingComma: "all"`)
- **TypeScript:** `nodenext` module resolution, `emitDecoratorMetadata`, `strictNullChecks: true`, `noImplicitAny: false`

### Planned (not yet installed)
- **Frontend:** shadcn/ui, Zustand, React Query, Leaflet.js, next-intl
- **Backend:** Prisma ORM, class-validator, class-transformer, Passport, Stripe SDK
- **Data:** PostgreSQL via Supabase, Redis (Upstash), Supabase Storage
- **AI:** Python FastAPI + LangGraph + Claude Sonnet
- **Payments:** Stripe + Bakong/ABA QR codes

---

## Common Commands

### Frontend (run from `frontend/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server on `http://localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Backend (run from `backend/`)

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | NestJS with hot reload (`--watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled app (`node dist/main`) |
| `npm run start` | Standard NestJS start (no watch) |
| `npm run test` | Run Jest unit tests (`*.spec.ts` in `src/`) |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:cov` | Jest with coverage report to `coverage/` |
| `npm run test:e2e` | Run E2E tests (`*.e2e-spec.ts` in `test/`) |
| `npm run lint` | ESLint with auto-fix on `src/`, `apps/`, `libs/`, `test/` |
| `npm run format` | Prettier write on `src/**/*.ts` and `test/**/*.ts` |

**Run a single test file:** `npx jest src/path/to/file.spec.ts` or `npm test -- src/path/to/file.spec.ts`

### Database (planned — Prisma)
| Command | Purpose |
|---------|---------|
| `npx prisma generate` | Generate Prisma Client |
| `npx prisma migrate dev` | Create and apply migration |
| `npx prisma studio` | Open Prisma Studio GUI |
| `npx prisma db push` | Push schema without migration |

---

## High-Level Architecture

```
┌──────────────┐     REST      ┌──────────────┐     Tools     ┌──────────────┐
│  Next.js     │ ◄──────────► │   NestJS     │ ◄──────────► │ Python AI    │
│  (Frontend)  │   (/v1/*)    │  (Backend)   │   (/v1/ai-tools/*) │  (LangGraph) │
│  Port 3000   │              │  Port 3001   │              │              │
└──────────────┘              └──────┬───────┘              └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ Supabase │    │  Redis   │    │  Stripe  │
              │   (PG)   │    │ (Cache)  │    │(Payments)│
              └──────────┘    └──────────┘    └──────────┘
```

### Communication Patterns
- **Frontend ↔ Backend:** REST JSON with `{ success, data, message, error }` envelope. Base prefix `/v1/`. Auth via Bearer JWT in `Authorization` header.
- **Frontend ↔ AI Agent:** WebSocket for chat; structured message types (text, card, action, qr).
- **AI Agent ↔ Backend:** REST tool endpoints with service key auth (`X-Service-Key` header).
- **Backend → External:** Stripe API, Resend email, FCM push, ExchangeRate-API.

### Data Model
Key entities (planned): `users`, `trips`, `places`, `hotels`/`hotel_rooms`, `transportation_vehicles`, `guides`, `bookings`, `payments`, `reviews`, `festivals`, `discount_codes`, `loyalty_transactions`, `emergency_alerts`, `student_verifications`, `notifications`, `ai_sessions`, `audit_logs`. All tables use UUID primary keys, `TIMESTAMPTZ`, `DECIMAL(10,2)` for money, `JSONB` for flexible structures.

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
| Zustand stores | feature.store.ts | `auth.store.ts` |

### Imports
- **Frontend:** Use `@/` alias for absolute imports from project root. Use relative imports within the same feature.
- **Backend:** Use relative imports within the same module; use absolute imports (`src/...`) for cross-module dependencies.

### TypeScript
- **Frontend:** `strict: true` (enforced in `tsconfig.json`).
- **Backend:** `strictNullChecks: true`, `noImplicitAny: false`, `strictBindCallApply: false`.
- Backend ESLint: `@typescript-eslint/no-explicit-any: off`, `@typescript-eslint/no-floating-promises: warn`, `prettier/prettier: error`.

---

## Planned Directory Structure

### Frontend (not yet created)
- `app/(public)/` — marketing pages (SSR)
- `app/(auth)/` — login, register, reset-password
- `app/(app)/` — authenticated app shell (home, explore, booking, chat, my-trips, profile)
- `components/ui/` — shadcn/ui base components
- `components/shared/` — reusable cross-feature components
- `lib/` — api client, WebSocket manager, i18n, offline helpers, currency utilities
- `stores/` — Zustand stores (auth, booking, chat, language)

### Backend (not yet created)
Modules: `auth`, `users`, `trips`, `bookings`, `payments`, `transportation`, `hotels`, `guides`, `explore`, `festivals`, `emergency`, `student-discount`, `loyalty`, `notifications`, `currency`, `ai-tools`, plus `common/` (guards, interceptors, filters, decorators, pipes) and `config/`.

---

## Testing

### Backend
- **Unit tests:** Colocated or alongside source files, named `*.spec.ts`. Jest config is inline in `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`, `coverageDirectory: ../coverage`).
- **E2E tests:** Located in `test/`, named `*.e2e-spec.ts`. Uses separate `jest-e2e.json` config with `rootDir: "."`.
- Run tests from the `backend/` directory.

### Frontend
- No testing framework is currently installed. The plan includes adding Jest or Vitest + React Testing Library.

---

## Security & Auth

- Never hardcode API keys or secrets. Environment files (`.env`, `.env.local`, `.env.*.local`) are gitignored.
- Required backend env vars (planned): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AI_SERVICE_KEY`, `REDIS_URL`.
- JWT access tokens expire after 15 minutes; refresh tokens expire after 7 days and are stored in `httpOnly Secure SameSite=Strict` cookies.
- Rate limiting planned: auth endpoints 5 requests / 5 min / IP; payment intent 3 requests / min / user.
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
