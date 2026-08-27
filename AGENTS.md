# DerLg — Agent Orchestrator

> **DerLg** is a Cambodia travel booking platform with an AI-powered "Vibe Booking" feature.
> It is a full-stack monorepo composed of a **Next.js frontend** (`web/`), a **NestJS backend** (`backend/`), a **Python AI agent service** (`vibe-booking/`), and an **admin panel frontend** (`derlg-system-admin/frontend_admin/`).
>
> The admin panel's API is **inside `backend/`** at `/v1/admin/*`. It used to be a
> separate NestJS service pointed at a different database; that was merged in and
> the standalone service deleted.
>
> **This file is the Orchestrator.** If you are an AI agent about to work on this project, your first step is to identify which layer you are implementing and follow the routing instructions below.

---

## Project Overview

| Aspect | Detail |
|--------|--------|
| **Product** | Mobile-first PWA for booking trips, hotels, transportation, and tour guides in Cambodia, with a conversational AI concierge |
| **Target users** | International tourists, Chinese tourists (primary market), students, safety-conscious travelers |
| **Languages** | English (EN), Chinese (ZH), Khmer (KM) |
| **Repo layout** | Monorepo with `web/`, `backend/`, `vibe-booking/`, `derlg-system-admin/`, and `.kiro/` |

### High-level architecture

```
┌──────────────┐     REST      ┌──────────────┐     Tools    ┌──────────────┐
│  Next.js     │ ◄──────────►  │   NestJS     │ ◄──────────► │ Python AI    │
│  (Frontend)  │   (/v1/*)     │  (Backend)   │   (/v1/ai-tools/*) │  (FastAPI)   │
│  Port 3002   │               │  Port 3003   │              │  Port 8001   │
└──────────────┘               └──────┬───────┘              └──────────────┘
                                     │
                    ┌────────────────┼────────────────┬────────────────┐
                    ▼                ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ Supabase │    │  Redis   │    │  Stripe  │    │  MinIO   │
              │   (PG)   │    │ (Cache)  │    │(Payments)│    │ (Images, │
              └──────────┘    └──────────┘    └──────────┘    │  Media)  │
                                                              └──────────┘
```

---

## Agent Routing — READ THIS FIRST

### 1. Implementing the Backend?
→ **Read `@backend/AGENTS.md`** for detailed backend conventions, NestJS patterns, module structure, API standards, and Prisma/Supabase guidelines.

→ **Then read the spec directory:**
- `backend/prisma/schema.prisma` — database schema
- `backend/src/modules/` — implementation code (per-module README/docs)
- `backend/context/` — specs and guides (if present)

### 2. Implementing the Frontend?
→ **Read `@web/AGENTS.md`** for detailed frontend conventions, Next.js App Router patterns, Tailwind/shadcn/ui rules, and component organization.

→ **Then read the spec directories:**
- `.kiro/specs/frontend-nextjs-implementation/` — core frontend build tasks, routing, state management, and shared components.
- `.kiro/specs/vibe-booking-frontend/` — Vibe Booking UI-specific tasks, chat interface, and AI concierge frontend integration.

### 3. Implementing the Admin Panel?
→ **API work** (endpoints, guards, Prisma, Telegram bot, storage): the admin API is part of the backend. Read `@backend/AGENTS.md`, then `backend/src/modules/admin/`, `backend/src/modules/telegram/`, `backend/src/modules/storage/`.

→ **UI work**: read `@derlg-system-admin/frontend_admin/AGENTS.md`.

→ **Context on the merge**: `backend/docs/admin-merge/` records the baseline, the port map, and every behaviour deliberately changed.

### 4. Implementing the Vibe Booking AI Agent?
→ **Read `@vibe-booking/AGENT.md`** for detailed agent architecture, workflow design, Python service conventions, tool definitions, and memory patterns.

→ **Then read the spec directories:**
- `.kiro/specs/vibe-booking/` — AI agent implementation tasks, tool calling specs, and backend integration contract.
- `.kiro/specs/vibe-booking-frontend/` — how the AI agent interfaces with the frontend chat UI.

---

## Cross-Cutting Conventions (Global)

These rules apply to **all** layers regardless of which agent is working:

- **Language:** TypeScript 5 (frontend & backend), Python 3.12+ (AI agent).
- **Never hardcode secrets.** All API keys, tokens, and credentials must be environment variables.
- **Environment files** (`.env`, `.env.local`, `.env.*.local`) are gitignored — do not commit them.
- **API base prefix:** `/v1/` (backend), `/v1/ai-tools/*` (AI service), `/v1/admin/*` (admin panel), `/v1/telegram/*` (driver bot).
- **Never put `v1/` in a `@Controller()` path.** `main.ts` already applies the global prefix; doing both yields `/v1/v1/...`.
- **Response envelope:** `{ success, data, message, error }` (backend).
- **Auth:** Bearer JWT in `Authorization` header; `httpOnly Secure SameSite=Strict` cookies for refresh tokens.
- **Naming:** React components `PascalCase`, utilities `kebab-case`, variables/functions `camelCase`, constants `UPPER_SNAKE_CASE`, DB tables `snake_case`.
- **CORS** must be whitelisted to production origins only.

## Quick-Reference: Stack & Ports

| Layer | Tech | Configured Port | Directory |
|-------|------|-----------------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 | `3002` | `web/` |
| Backend | NestJS 11 + Prisma + PostgreSQL | `3003` | `backend/` |
| Admin panel | Next.js 16 + React 19 + Tailwind v4 | `5000` | `derlg-system-admin/frontend_admin/` |
| AI Agent | Python + FastAPI + NVIDIA gpt-oss-120b | `8001` | `vibe-booking/` |
| Cache | Redis (Upstash prod / Docker dev) | `6379` | — |
| Storage | MinIO (self-hosted Docker) | `9000` | — |
| DB | PostgreSQL (local Supabase stack in dev) | `54322` | — |

> The admin panel has **no backend of its own**. It calls `backend/` at `/v1/admin/*`.

> Dev runs on ports 4007 (backend), 4008 (web), 4009 (AI agent) and 4010 (admin panel) via `./run-all.sh`, to avoid clashing with the configured defaults.

## Documentation Index

| Document | Purpose |
|----------|---------|
| `docs/product/prd.md` | Product Requirements Document |
| `docs/platform/architecture/system-overview.md` | Auth flow, payment flow, real-time channels |
| `docs/product/feature-decisions.md` | Canonical feature registry (scope, priority, status, owner) |
| `docs/modules/README.md` | Per-feature API specs index |
| `.kiro/steering/tech.md` | Technology stack decisions |
| `.kiro/steering/structure.md` | Planned directory structure & naming conventions |
| `.kiro/steering/product.md` | Product context |
| `backend/docs/admin-merge/` | Admin-panel merge: baseline, port inventory, deliberate behaviour changes |
