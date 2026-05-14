# DerLg — Agent Orchestrator

> **DerLg** is a Cambodia travel booking platform with an AI-powered "Vibe Booking" feature.
> It is a full-stack monorepo composed of a **Next.js frontend**, a **NestJS backend**, and a **Python AI agent service**.
>
> **This file is the Orchestrator.** If you are an AI agent about to work on this project, your first step is to identify which layer you are implementing and follow the routing instructions below.

---

## Project Overview

| Aspect | Detail |
|--------|--------|
| **Product** | Mobile-first PWA for booking trips, hotels, transportation, and tour guides in Cambodia, with a conversational AI concierge |
| **Target users** | International tourists, Chinese tourists (primary market), students, safety-conscious travelers |
| **Languages** | English (EN), Chinese (ZH), Khmer (KM) |
| **Repo layout** | Monorepo with `frontend/`, `backend/`, `vibe-booking/`, `docs/`, and `.kiro/` |

### High-level architecture (planned)

```
┌──────────────┐     REST      ┌──────────────┐     Tools    ┌──────────────┐
│  Next.js     │ ◄──────────►  │   NestJS     │ ◄──────────► │ Python AI    │
│  (Frontend)  │   (/v1/*)     │  (Backend)   │   (/v1/ai-tools/*) │  (LangGraph) │
│  Port 3000   │               │  Port 3001   │              │              │
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
- `.kiro/specs/backend-nestjs-supabase/` — implementation tasks, API contracts, database schema decisions, and acceptance criteria.

### 2. Implementing the Frontend?
→ **Read `@frontend/AGENTS.md`** for detailed frontend conventions, Next.js App Router patterns, Tailwind/shadcn/ui rules, and component organization.

→ **Then read the spec directories:**
- `.kiro/specs/frontend-nextjs-implementation/` — core frontend build tasks, routing, state management, and shared components.
- `.kiro/specs/vibe-booking-frontend/` — Vibe Booking UI-specific tasks, chat interface, and AI concierge frontend integration.

### 3. Implementing the Vibe Booking AI Agent?
→ **Read `@vibe-booking/AGENT.md`** for detailed agent architecture, LangGraph workflow design, Python service conventions, tool definitions, and memory patterns.

→ **Then read the spec directories:**
- `.kiro/specs/vibe-booking/` — AI agent implementation tasks, LangGraph node definitions, tool calling specs, and backend integration contract.
- `.kiro/specs/vibe-booking-frontend/` — how the AI agent interfaces with the frontend chat UI.

---

## Cross-Cutting Conventions (Global)

These rules apply to **all** layers regardless of which agent is working:

- **Language:** TypeScript 5 (frontend & backend), Python 3.12+ (AI agent).
- **Never hardcode secrets.** All API keys, tokens, and credentials must be environment variables.
- **Environment files** (`.env`, `.env.local`, `.env.*.local`) are gitignored — do not commit them.
- **API base prefix:** `/v1/` (backend) and `/v1/ai-tools/*` (AI service endpoints).
- **Response envelope:** `{ success, data, message, error }` (backend).
- **Auth:** Bearer JWT in `Authorization` header; `httpOnly Secure SameSite=Strict` cookies for refresh tokens.
- **Naming:** React components `PascalCase`, utilities `kebab-case`, variables/functions `camelCase`, constants `UPPER_SNAKE_CASE`, DB tables `snake_case`.
- **CORS** must be whitelisted to production origins only.

---

## Quick-Reference: Stack & Ports

| Layer | Tech | Dev Port | Directory |
|-------|------|----------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 | `3000` | `frontend/` |
| Backend | NestJS 11 + Prisma + Supabase PG | `3001` | `backend/` |
| AI Agent | Python + LangGraph + FastAPI | TBD | `vibe-booking/` |
| Cache | Redis (Upstash prod / Docker dev) | `6379` | — |
| Storage | MinIO (self-hosted Docker) | `9000` | — |
| DB | PostgreSQL via Supabase | `5432` | — |

---

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
