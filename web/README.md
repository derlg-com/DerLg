# DerLg Web Client

The DerLg web client: Cambodia travel booking with the Vibe Booking AI concierge.

| App | Port | Directory |
|-----|------|-----------|
| **This app** | `3002` | `web/` |
| Backend API (NestJS) | `3003` | `backend/` |
| AI agent (FastAPI) | `8001` | `vibe-booking/` |

> Dev runs on ports **4008/4007/4009** via shell env overrides to avoid clashes with the configured defaults.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · TanStack Query (server state) · Zustand (client state) · React Hook Form + Zod · next-intl (EN/ZH/KM) · Leaflet + OpenStreetMap · react-markdown + remark-gfm (AI chat) · Vitest + Testing Library · Playwright.

## Getting started

```bash
cd web
npm install
cp .env.local.example .env.local   # then fill in AI_SERVICE_KEY
npm run dev                        # http://localhost:3002
```

> Dev runs on port **4008** via `npx next dev -p 4008` to avoid clashes with the configured 3002.

### Environment variables

See `.env.local.example` for the full annotated list. Key values:

- **`AI_SERVICE_KEY`** — must be the exact same value as `AI_SERVICE_KEY` in `backend/.env`. Read **only** by server-side BFF route handlers under `app/api/ai/*`. Must never have a `NEXT_PUBLIC_` prefix.
- **`JWT_ACCESS_SECRET`** — must equal `backend/.env`'s `JWT_ACCESS_SECRET` for BFF token verification.
- **`NEXT_PUBLIC_API_URL`** — backend URL (default: `http://localhost:3003`)
- **`NEXT_PUBLIC_AI_WS_URL`** — AI agent WebSocket URL (default: `ws://localhost:8001`)

No Google Maps key is needed — maps use Leaflet with OpenStreetMap tiles.

## Running the full stack

All three services must be up for end-to-end features (browse, chat, book, pay).

```bash
# 1. Infrastructure (Redis, MinIO)
cd backend && docker compose up -d

# 2. Backend API on :3003
cd backend && npm run start:dev

# 3. AI agent on :8001
cd vibe-booking && source .venv/bin/activate && env -u NVIDIA_API_KEY uvicorn main:app --port 8001  # no --reload

# 4. This app on :3002
cd web && npm run dev
```

### Required config in the other services

The origin `http://localhost:3002` (or `4008` in dev) must be allowlisted:

- `backend/.env` → add to `CORS_ORIGINS`
- `backend/.env` → set `DEMO_PAYMENTS=true` for sandbox payment confirmation
- `vibe-booking/.env` → add to `ALLOWED_WS_ORIGINS` (otherwise the chat WebSocket closes with code 4403)
- `vibe-booking/.env` → `JWT_SECRET` must equal `backend/.env`'s `JWT_ACCESS_SECRET`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (next build + Serwist PWA) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run test` / `npm run test:watch` | Vitest |
| `npm run test:coverage` | Vitest with coverage |
| `npm run e2e` / `npm run e2e:ui` | Playwright E2E |
| `npm run verify` | typecheck + lint + unit tests |

## Internationalisation

Routes live under `app/[locale]/`, so every URL carries its language: `/en/trips`, `/zh/trips`, `/km/trips`. Locale resolution: URL prefix → `NEXT_LOCALE` cookie → `Accept-Language`.

The same locale drives three systems, and `lib/i18n/config.ts` owns the mappings:

| Consumer | Shape | Example for Khmer |
|----------|-------|-------------------|
| next-intl | short code | `km` |
| `<html lang>` | BCP 47 tag | `km-KH` |
| Backend | `Accept-Language` | `km-KH,en-US;q=0.8` |
| AI agent | uppercase enum | `KH` (not `KM`) |

Translations live in `messages/{en,zh,km}.json`. `tests/i18n.test.ts` fails the build if catalogues drift.

## Architecture

```
Server Components ──fetch, Accept-Language──> NestJS /v1 (:3003)
Client Components ──TanStack Query──────────> NestJS /v1 (:3003)
Client Components ──> BFF /api/ai/* ──x-service-key──> /v1/ai-tools/*
Typed WS client ────────────────────────────> FastAPI agent (:8001/ws/chat)
```

Directory conventions:

```
app/[locale]/     Localised routes (en | zh | km)
app/api/          BFF route handlers — the only place the service key is read
components/ui/    Design system primitives
components/chat/  Vibe Booking chat + payload block renderers
lib/api/          Typed API client, envelope handling, query keys
lib/vibe/         Typed WebSocket client
schemas/          Zod contracts (agent payloads, forms)
stores/           Zustand client state
```

## Features

- **Vibe Booking AI Chat** — WebSocket chat with NVIDIA gpt-oss-120b agent. Markdown responses, trip/hotel/guide/transport cards, custom trip composition, payment QR codes.
- **Trip Discovery** — Curated packages (temples, nature, culture, adventure, food, custom). Category filtering.
- **Hotel Booking** — Hotel types (resort/boutique/hotel/guesthouse/hostel/villa), star ratings, room availability.
- **Transportation** — Tuk-tuks, vans (Starex/Hiace/Alphard), buses (small/large). Tier filtering (Normal/VIP).
- **Verified Guides** — 10 languages, 8 specialties, linked trip packages.
- **Multi-Booking** — Compose hotel + guide + transport + extras in one booking.
- **Smart Availability** — 15-minute holds with Redis TTL.
- **Payments** — Stripe card + Bakong/ABA QR codes.
- **PWA** — Installable with offline caching.

## Known constraints

- **Payments are sandbox only.** `POST /v1/bookings/:id/confirm` marks a booking paid without a real charge, gated behind `DEMO_PAYMENTS`.
- **AI responses are Markdown.** Rendered with react-markdown (HTML escaped by default).
