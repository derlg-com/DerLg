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
| **Vibe Booking (AI Chat)** | Full-screen WebSocket chat with a LangGraph + Claude AI agent. Renders trip cards, hotel listings, action buttons, and payment QR codes inline. |
| **Trip Discovery** | Curated Cambodia trip packages — temples, nature, culture, adventure, food. Hero home screen with category filtering. |
| **Multi-Booking Engine** | Book trips, hotels, transportation (van/bus/tuk-tuk), and verified tour guides in one place. |
| **Smart Availability** | 15-minute booking holds with Redis TTL, conflict detection, and auto-cancellation. |
| **Payments** | Stripe card payments (3D Secure) + Bakong/ABA QR codes for Cambodian and Chinese markets. |
| **Multi-Language** | Full support for **English, Chinese (中文), and Khmer (ខ្មែរ)** across all content. |
| **PWA** | Installable Progressive Web App with offline static asset caching. Feels like a native app without the app store. |

### Coming Soon

| Feature | Description | Release |
|---------|-------------|---------|
| **Loyalty Points** | Earn 2 points per USD spent. Redeem at checkout (100 pts = $1). | v1.1 |
| **Student Discounts** | Verify student ID for automatic discounts across bookings. | v1.1 |
| **Offline Maps** | Downloadable OpenStreetMap packs for rural Cambodia navigation. | v1.1 |
| **Emergency SOS** | GPS-tracked SOS alerts with 5-second cancel countdown. Direct push + SMS to support team. | v1.2 |
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

This repo is a monorepo of two apps: a **Next.js web** client and a **NestJS API** that also hosts the Vibe Booking AI agent in-process (no separate Python service).

```
Next.js web (3100)  ──REST /v1──►  NestJS API (3101)  ──OpenAI-compatible chat completions──►  LLM
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                    PostgreSQL      Redis        Cloudflare R2
                  (catalog,       (sessions,    (seed images,
                   bookings)      holds TTL)     optional)
```

| App | Directory | Port | Technology |
|-----|-----------|------|------------|
| Web | `apps/web` | 3100 | Next.js 16, React 19, TypeScript 5, Tailwind v4, Zustand, React Query, Stripe Elements |
| API | `apps/api` | 3101 | NestJS 11, Prisma 6, TypeScript 5, Jest, OpenAI-compatible LLM (NVIDIA NIM by default) |

Shared infra: PostgreSQL, Redis, Cloudflare R2 (optional), Stripe (optional). Each optional service **degrades to HTTP 503** when unconfigured — the app always boots.

> **Why 3100/3101?** Ports 3000/3001 are occupied by the older `frontend/`/`backend/`/`vibe-booking/` projects still in this tree. The `apps/` monorepo uses 3100/3101 so both can coexist on one machine.

---

## Architecture Highlights

- **Conversational booking loop** — the Vibe agent renders interactive trip/booking cards inline. The frontend owns all rendering; the API sends structured `content_payload`.
- **Grounding guardrails** — the agent only ever sees real catalogue ids returned by its read tools, and the only money-moving tool (`create_booking_hold`) is server-validated. The agent never writes to the DB directly.
- **15-minute holds** with a Redis TTL; expired holds are released by a scheduled job.
- **Tiered refunds** — 100% if cancelled ≥7 days out, 50% at 1–7 days, 0% inside 24h.
- **Idempotent seeding** — re-runnable; `--upload-r2` migrates seed images to R2 and rewrites `PlaceImage.url` while preserving CC BY-SA attribution.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/product/prd.md`](docs/product/prd.md) | Full Product Requirements Document |
| [`docs/product/feature-decisions.md`](docs/product/feature-decisions.md) | Feature registry with scope, priority, status |
| [`docs/platform/architecture/system-overview.md`](docs/platform/architecture/system-overview.md) | System architecture, auth flow, payment flow |
| [`docs/modules/`](docs/modules/) | Per-feature API specs and architecture |
| [`CLAUDE.md`](CLAUDE.md) | Development guide for Claude Code |

---

## Running it

### One command — Docker

The whole stack (Postgres, Redis, API, web) comes up with one command:

```bash
docker compose up --build
```

- The API applies pending Prisma migrations on every start, so the schema is ready immediately.
- Web → http://localhost:3100, API → http://localhost:3101/v1.
- Seed the catalogue once: `docker compose exec api npm run db:seed`
  - With R2: `docker compose exec api npm run db:seed -- --upload-r2` (needs R2 env, see below).
- Stripe / the LLM / R2 are left blank by default; their endpoints return 503 until you wire them (see below).

> SSR caveat: inside the web container, server-side catalogue fetches use the browser URL and degrade to "no featured trips". Client-side fetching and the booking funnel are unaffected.

### Local dev (no Docker)

```bash
# 1. Start Postgres + Redis (mapped to non-default ports to avoid clashes)
docker compose up -d postgres redis

# 2. API
cd apps/api
cp .env.example .env          # then edit secrets (JWT_ACCESS_SECRET etc.)
npm install
npx prisma migrate dev        # create + apply the schema
npm run db:seed               # seed the catalogue
npm run start:dev              # http://localhost:3101/v1

# 3. Web (other terminal)
cd apps/web
cp .env.example .env.local
npm install
npm run dev                    # http://localhost:3100
```

### Environment variables

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`, then fill in the secrets you need. Empty values are treated as "not configured" — the app boots either way.

#### API (`apps/api/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NODE_ENV` | yes | `development` / `production` |
| `PORT` | yes | `3101` |
| `CORS_ORIGINS` | yes | Comma-separated browser origins (`http://localhost:3100`) |
| `DATABASE_URL` | yes | Postgres URL. Local docker: `postgresql://derlg:derlg_dev_password@localhost:55433/derlg?schema=public` |
| `REDIS_URL` | yes | `redis://localhost:56380` (local docker) |
| `JWT_ACCESS_SECRET` | yes | ≥32 chars. Generate: `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | yes | ≥32 chars. Generate separately |
| `JWT_ACCESS_TTL` | yes | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | yes | `30` |
| `COOKIE_DOMAIN` | no | Leave empty for localhost |
| `STRIPE_SECRET_KEY` | no | Test key from Stripe dashboard. Empty → payments return 503 |
| `STRIPE_WEBHOOK_SECRET` | no | `whsec_…` from `stripe listen` (see below) |
| `STRIPE_PUBLISHABLE_KEY` | no | Test publishable key |
| `OPENAI_BASE_URL` | yes | `https://integrate.api.nvidia.com/v1` (swap provider freely) |
| `OPENAI_API_KEY` | no | Provider key. Empty → Vibe returns 503 |
| `OPENAI_MODEL` | yes | `meta/llama-3.1-8b-instruct` (fast). `meta/llama-3.1-70b-instruct` = better prose, slower |
| `OPENAI_TIMEOUT_MS` | yes | `60000` |
| `R2_ACCOUNT_ID` | no | Cloudflare R2. All four R2_* core vars needed together or 503 |
| `R2_ACCESS_KEY_ID` | no | R2 access key |
| `R2_SECRET_ACCESS_KEY` | no | R2 secret |
| `R2_BUCKET` | no | R2 bucket name |
| `R2_PUBLIC_BASE_URL` | no | Public R2 domain; when unset, reads use 1h presigned URLs |

#### Web (`apps/web/.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | yes | `http://localhost:3101/v1` (browser-facing API base) |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3100` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | Test publishable key. Payment UI shows a notice until set |
| `R2_PUBLIC_BASE_URL` | no | Set to allow the Next image optimizer to serve R2 images |

### Stripe — test cards end to end

The card-payment path only runs with Stripe test keys and a forwarding webhook. From the Stripe dashboard, copy the **test** secret + publishable keys, then:

```bash
# 1. Put keys in env:
#    apps/api/.env:        STRIPE_SECRET_KEY=sk_test_...   STRIPE_PUBLISHABLE_KEY=pk_test_...
#    apps/web/.env.local:  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# 2. Forward webhooks to the local API (run in its own terminal):
stripe listen --forward-to localhost:3101/v1/payments/webhook
#    It prints: > Ready! Your webhook signing secret is whsec_xxx
#    Put that into apps/api/.env as STRIPE_WEBHOOK_SECRET=whsec_xxx

# 3. Restart the API so it picks up STRIPE_WEBHOOK_SECRET.

# 4. Pay in the checkout with the test card:
#    4242 4242 4242 4242   any future date   any CVC
#    The booking flips to CONFIRMED and a check-in code is issued.
```

### Testing

| Suite | Where | Command |
|-------|-------|---------|
| API unit | `apps/api` | `npm test` |
| API e2e | `apps/api` | `npm run test:e2e` |
| Web unit (Vitest) | `apps/web` | `npm test` |
| Web typecheck | `apps/web` | `npm run typecheck` |
| Web lint | `apps/web` | `npm run lint` |
| Web production build | `apps/web` | `npm run build` |
| Golden-path E2E (Playwright) | `apps/web` | `npm run e2e` (needs the stack up + Stripe/LLM as above) |

---

## Project Status

**Phase:** MVP build of the `apps/` monorepo. The full booking loop (browse → customize → hold → checkout) and the AI concierge (compose → hold) are implemented and under test — see the test table above. Stripe live card runs, R2 image hosting, and Playwright golden paths are wired and ready; the items left are environment credentials (Stripe test keys, an LLM key) noted in "Running it".

**MVP Goal:** Prove the core loop — *discover → chat → book → pay*.

For the full feature roadmap and release timeline, see [`docs/product/feature-decisions.md`](docs/product/feature-decisions.md).

---

*Built for travelers. Built for Cambodia.*
