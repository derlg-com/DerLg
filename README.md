# DerLg

> **Cambodia Travel Booking, Reimagined.**
>
> Book trips, hotels, transport, and guides through natural language conversation — no more endless tabs, no more decision fatigue.

---

## What is DerLg?

**DerLg** is a mobile-first travel booking platform for Cambodia. Unlike generic OTAs that make you browse through hundreds of listings, DerLg lets you **chat with an AI travel concierge** to plan and book your entire trip — from temple tours in Siem Reap to tuk-tuk rides in Phnom Penh.

Our mission: *"Make Cambodia travel booking as easy as texting a friend who knows every temple, tuk-tuk driver, and hidden beach."*

---

## The Big Idea: Vibe Booking

**Vibe Booking** is our signature feature — an AI-powered conversational booking experience.

Instead of navigating complex search filters and comparison tables, you simply *chat*:

> **You:** "I want a 3-day temple tour near Siem Reap with a guide who speaks Chinese"
>
> **DerLg AI:** *"Great choice! I found 3 packages that match. The first includes Angkor Wat, Bayon, and Ta Prohm with a Mandarin-speaking guide, hotel pickup, and lunch — $189 per person. Want me to hold a spot for 15 minutes while you decide?"*

The AI handles the entire loop: **discover → plan → book → pay** — all within the chat. No context switching. No research fatigue.

### Why Vibe Booking Matters

- **Lower barrier for non-English speakers** — chat naturally in Chinese, Khmer, or English
- **Reduces decision fatigue** — AI curates options based on your intent, not just keywords
- **Closes the booking loop** — confirm reservations and pay without leaving the conversation
- **Works offline** — message queueing for spotty Cambodian mobile networks

---

## Features

### Live Now (MVP)

| Feature | Description |
|---------|-------------|
| **Vibe Booking (AI Chat)** | Full-screen WebSocket chat with an NVIDIA gpt-oss-120b AI agent. Renders trip cards, hotel listings, guide profiles, transport options, custom trip packages, and payment QR codes inline. Markdown-formatted responses. |
| **Trip Discovery** | Curated Cambodia trip packages — temples, nature, culture, adventure, food, and AI-composed custom trips. |
| **Hotel Booking** | Hotels with types (resort, boutique, hotel, guesthouse, hostel, villa), star ratings, room availability. |
| **Transportation** | Book tuk-tuks, vans (Starex/Hiace/Alphard), and buses (small 25-seat, large 45-seat) — filtered by tier (Normal/VIP). |
| **Verified Guides** | Tour guides with spoken languages (10 languages), specialties (culture, food, adventure, photography, etc.), and linked trip packages. |
| **Multi-Booking Engine** | Book trips, hotels, transportation, and verified tour guides — compose multi-item bookings. |
| **Smart Availability** | 15-minute booking holds with Redis TTL, conflict detection, and auto-cancellation. |
| **Payments** | Stripe card payments (3D Secure) + Bakong/ABA QR codes for Cambodian and Chinese markets. |
| **Multi-Language** | Full support for **English, Chinese (中文), and Khmer (ខ្មែរ)** across all content. |
| **PWA** | Installable Progressive Web App with offline static asset caching. |

### Coming Soon

| Feature | Description | Release |
|---------|-------------|---------|
| **Loyalty Points** | Earn points per USD spent. Redeem for awards. | v1.1 |
| **Student Discounts** | Verify student ID for automatic discounts across bookings. | v1.1 |
| **Offline Maps** | Downloadable OpenStreetMap packs for rural Cambodia navigation. | v1.1 |
| **Emergency SOS** | GPS-tracked SOS alerts with cancel countdown. Push + SMS to support. | v1.2 |
| **Location Sharing** | Share live location with family via unique tracking links. | v1.2 |
| **Festival Calendar** | Cultural events with auto-generated discount codes. | v1.2 |
| **Admin Dashboard** | Metrics, bookings, users, revenue charts for operations. | v2.0 |

---

## Who Is This For?

| Traveler | Need | How DerLg Helps |
|----------|------|-----------------|
| **Backpacker Ben** (25-35, International) | Discover trips, compare prices, book on mobile | AI chat, trip discovery, offline maps |
| **WeChat Wendy** (30-45, Chinese) | Mandarin support, trusted payment, QR pay | AI chat in Chinese, Bakong/ABA QR, social sharing |
| **Student Srey** (18-24, Cambodian/ASEAN) | Budget travel, verified discounts | Student verification, discount auto-apply |
| **Solo Sarah** (28-40, Safety-conscious) | Reliable transport, emergency help | Emergency SOS, live location sharing, female-friendly guides |

---

## Tech Stack

This repo is a monorepo of three independently runnable services:

```
web (3002)  ──REST /v1──►  backend (3003)  ──X-Service-Key──►  vibe-booking (8001)
                                     │
                        ┌────────────┼────────────┐
                        ▼            ▼            ▼
                  PostgreSQL      Redis        MinIO
                (catalog,       (sessions,    (seed images,
                 bookings)      holds TTL)     media)
```

| Service | Directory | Port | Technology |
|---------|-----------|------|------------|
| Web | `web/` | 3002 | Next.js 16, React 19, TypeScript 5, Tailwind v4, Zustand, React Query, next-intl, Leaflet, react-markdown |
| API | `backend/` | 3003 | NestJS 11, Prisma 6, TypeScript 5, Jest, class-validator, Passport JWT |
| AI Agent | `vibe-booking/` | 8001 | Python 3.12, FastAPI, NVIDIA gpt-oss-120b, Redis sessions, hand-rolled async tool loop |

> Dev runs on ports 4007/4008/4009 via shell env overrides to avoid clashes with the configured defaults.
>
> **Database:** Dev uses a local Supabase instance (port 54322). For VPS deployment via Coolify, point `DATABASE_URL` at the Coolify-managed Postgres — the app works with any standard Postgres, no Supabase dependency required.

---

## Architecture Highlights

- **Conversational booking loop** — the Vibe agent renders interactive trip/booking cards inline. The frontend owns all rendering; the API sends structured `content_payload`. AI responses render as Markdown.
- **Custom trip composition** — the AI can compose and save a bespoke trip from hotel + guide + transport + extras, with server-side pricing.
- **Grounding guardrails** — the agent only ever sees real catalogue ids returned by its read tools, and the only money-moving tool (`create_booking_hold`) is server-validated. The agent never writes to the DB directly.
- **15-minute holds** with a Redis TTL; expired holds are released automatically.
- **Idempotent seeding** — re-runnable seed script populates all catalogue data.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/product/prd.md`](docs/product/prd.md) | Full Product Requirements Document |
| [`docs/product/feature-decisions.md`](docs/product/feature-decisions.md) | Feature registry with scope, priority, status |
| [`docs/platform/architecture/system-overview.md`](docs/platform/architecture/system-overview.md) | System architecture, auth flow, payment flow |
| [`docs/modules/`](docs/modules/) | Per-feature API specs and architecture |
| [`CLAUDE.md`](CLAUDE.md) | Development guide for Claude Code |
| [`RAYU.md`](RAYU.md) | Development guide for RAYU |
| [`AGENTS.md`](AGENTS.md) | Agent routing and cross-cutting conventions |

---

## Running it

### Local dev

```bash
# 1. Start local Supabase (provides Postgres on 54322 + Redis on 6379)
#    Or use your own Postgres + Redis and update backend/.env accordingly.

# 2. Backend
cd backend
cp .env.example .env          # then edit secrets (JWT_ACCESS_SECRET etc.)
npm install
npx prisma migrate deploy     # apply migrations (use db push if migrate dev fails)
npm run prisma:seed           # seed the catalogue
npm run start:dev              # http://localhost:3003/v1

# 3. AI Agent (other terminal)
cd vibe-booking
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
env -u NVIDIA_API_KEY uvicorn main:app --host 0.0.0.0 --port 8001  # http://localhost:8001

# 4. Web (other terminal)
cd web
cp .env.local.example .env.local
npm install
npm run dev                    # http://localhost:3002
```

> **NVIDIA_API_KEY gotcha:** If you have `NVIDIA_API_KEY` exported in your shell, unset it before launching the agent — the shell export shadows the `.env` value and causes HTTP 403s on every chat turn.

### VPS deployment (Coolify)

Deploy each service as a separate Coolify application:

1. **Backend** — set `DATABASE_URL` / `DIRECT_URL` to the Coolify-managed Postgres, `REDIS_URL` to the Coolify-managed Redis, and all secrets (`JWT_ACCESS_SECRET`, `AI_SERVICE_KEY`, etc.). Run `npx prisma migrate deploy` on start, then `npm run prisma:seed` once.
2. **AI Agent** — set `BACKEND_URL` to the backend's Coolify URL, `REDIS_URL`, `NVIDIA_API_KEY`, `AI_SERVICE_KEY`. Run **without `--reload`**.
3. **Web** — set `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_AI_WS_URL` to the Coolify URLs for backend and agent.

The app works with any standard PostgreSQL — no Supabase dependency required in production.

### Environment variables

Copy `backend/.env.example` → `backend/.env` and `web/.env.local.example` → `web/.env.local`, then fill in the secrets you need.

#### Backend (`backend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres URL (Supabase or local) |
| `DIRECT_URL` | yes | Direct connection for migrations |
| `JWT_ACCESS_SECRET` | yes | ≥32 chars. Generate: `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | yes | ≥32 chars. Generate separately |
| `AI_SERVICE_KEY` | yes | ≥32 chars. Must match `vibe-booking/.env` |
| `REDIS_URL` | yes | `redis://localhost:6379/0` |
| `MINIO_ACCESS_KEY` | yes | MinIO credentials |
| `MINIO_SECRET_KEY` | yes | MinIO credentials |
| `STRIPE_SECRET_KEY` | no | Empty → payments return 503 |
| `STRIPE_WEBHOOK_SECRET` | no | From `stripe listen` |

#### Web (`web/.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | yes | `http://localhost:3003` |
| `NEXT_PUBLIC_AI_WS_URL` | yes | `ws://localhost:8001` |
| `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3002` |
| `AI_SERVICE_KEY` | yes | Must match `backend/.env` (for BFF routes) |
| `JWT_ACCESS_SECRET` | yes | Must match `backend/.env` (for BFF token verification) |

#### AI Agent (`vibe-booking/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NVIDIA_API_KEY` | yes | NVIDIA NIM API key |
| `MODEL_LLM` | no | Default: `openai/gpt-oss-120b` |
| `BACKEND_URL` | yes | `http://localhost:3003` |
| `AI_SERVICE_KEY` | yes | Must match `backend/.env` |
| `REDIS_URL` | yes | `redis://localhost:6379/0` |

### Testing

| Suite | Where | Command |
|-------|-------|---------|
| Backend unit | `backend/` | `npm test` |
| Backend e2e | `backend/` | `npm run test:e2e` |
| Web unit (Vitest) | `web/` | `npm run test` |
| Web typecheck | `web/` | `npm run typecheck` |
| Web lint | `web/` | `npm run lint` |
| Web production build | `web/` | `npm run build` |
| Web E2E (Playwright) | `web/` | `npm run e2e` |
| AI Agent | `vibe-booking/` | `pytest` |

---

## Project Status

**Phase:** MVP. The full booking loop (browse → chat → book → pay) and the AI concierge (discover → compose → book) are implemented and running. Stripe card runs, MinIO image hosting, and Playwright golden paths are wired and ready.

**MVP Goal:** Prove the core loop — *discover → chat → book → pay*.

For the full feature roadmap and release timeline, see [`docs/product/feature-decisions.md`](docs/product/feature-decisions.md).

---

*Built for travelers. Built for Cambodia.*
