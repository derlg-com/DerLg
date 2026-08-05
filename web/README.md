# DerLg Web Client

The DerLg web client: Cambodia travel booking with the Vibe Booking AI concierge.

This app lives alongside the legacy `frontend/` app and does not modify it. Both can run at
the same time on different ports.

| App                    | Port   | Directory   |
| ---------------------- | ------ | ----------- |
| **This app**           | `3002` | `web/`      |
| Legacy frontend        | `3000` | `frontend/` |
| Backend API (NestJS)   | `3003` | `backend/`  |
| AI agent (FastAPI)     | `8000` | `vibe-booking/` |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · TanStack Query
(server state) · Zustand (client state) · React Hook Form + Zod · next-intl (EN/ZH/KM) ·
Leaflet + OpenStreetMap · Vitest + Testing Library · Playwright.

## Getting started

```bash
cd web
npm install
cp .env.local.example .env.local   # then fill in AI_SERVICE_KEY
npm run dev                        # http://localhost:3002
```

### Environment variables

See `.env.local.example` for the full annotated list. One value needs filling in by hand:

- **`AI_SERVICE_KEY`** — must be the exact same value as `AI_SERVICE_KEY` in `backend/.env`.
  It is read **only** by the server-side BFF route handlers under `app/api/ai/*`, which
  proxy the service-key-protected `/v1/ai-tools/*` endpoints. It must never be given a
  `NEXT_PUBLIC_` prefix; ESLint fails the build if it is.

No Google Maps key is needed — maps use Leaflet with OpenStreetMap tiles.

## Running the full stack

All three services must be up for end-to-end features (browse, chat, book, pay).

```bash
# 1. Infrastructure (Redis, MinIO)
cd backend && docker compose up -d

# 2. Backend API on :3003
cd backend && npm run start:dev

# 3. AI agent on :8000
cd vibe-booking && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# 4. This app on :3002
cd web && npm run dev
```

### Required config in the other services

The new origin `http://localhost:3002` must be allowlisted, or requests are rejected:

- `backend/.env` → add `http://localhost:3002` to `CORS_ORIGINS`
- `backend/.env` → set `DEMO_PAYMENTS=true` to enable the sandbox payment confirmation
- `vibe-booking/.env` → add `http://localhost:3002` to `ALLOWED_WS_ORIGINS` (otherwise the
  chat WebSocket closes with code 4403)
- `vibe-booking/.env` → `JWT_SECRET` must equal `backend/.env`'s `JWT_ACCESS_SECRET`, or
  signed-in chat silently degrades to guest mode and booking stays locked

## Scripts

| Command                 | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Dev server on port 3002                       |
| `npm run build`         | Production build                              |
| `npm run start`         | Serve the production build on port 3002       |
| `npm run typecheck`     | `tsc --noEmit`                                |
| `npm run lint`          | ESLint                                        |
| `npm run test`          | Vitest unit + component tests                 |
| `npm run test:coverage` | Vitest with coverage                          |
| `npm run e2e`           | Playwright end-to-end tests                   |
| `npm run verify`        | typecheck + lint + unit tests                 |

End-to-end tests run against a **production build** by default, because the dev server
compiles routes on demand and that races with the first interaction on each route. For a
faster inner loop while iterating on one spec, use the dev server instead:

```bash
E2E_DEV=1 npx playwright test e2e/i18n.spec.ts
```

To test against an already-running server, set `E2E_BASE_URL=http://localhost:3002`.

## Internationalisation

Routes live under `app/[locale]/`, so every URL carries its language: `/en/trips`,
`/zh/trips`, `/km/trips`. `proxy.ts` (the Next 16 rename of `middleware.ts`) resolves the
locale from the URL prefix, then the `NEXT_LOCALE` cookie, then `Accept-Language`.

The same locale drives three different systems, and `lib/i18n/config.ts` owns the mappings:

| Consumer      | Shape                | Example for Khmer |
| ------------- | -------------------- | ----------------- |
| next-intl     | short code           | `km`              |
| `<html lang>` | BCP 47 tag           | `km-KH`           |
| Backend       | `Accept-Language`    | `km-KH,en-US;q=0.8` |
| AI agent      | uppercase enum       | `KH` (not `KM`)   |

Translations live in `messages/{en,zh,km}.json` (849 keys each). `tests/i18n.test.ts` fails
the build if the three catalogues drift apart, if any translation is empty, or if ICU
placeholders differ between locales.

## Architecture

```
Server Components ──fetch, Accept-Language──> NestJS /v1 (:3003)
Client Components ──TanStack Query──────────> NestJS /v1 (:3003)
Client Components ──> BFF /api/ai/* ──x-service-key──> /v1/ai-tools/*
Typed WS client ────────────────────────────> FastAPI agent (:8000/ws/chat)
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

## Known constraints

- **Payments are sandbox only.** The backend has no PaymentIntent endpoint;
  `POST /v1/bookings/:id/confirm` marks a booking paid without a real charge and is gated
  behind `DEMO_PAYMENTS`. The card path is labelled as a sandbox flow in the UI.
- **Reviews and notifications are local-only.** No backend module exists, so they persist to
  `localStorage` and are visibly marked as not synced.
- **Festivals, loyalty, weather, budget, emergency contacts and payment QR** are only
  reachable through the BFF, because the backend exposes them solely under the
  service-key-protected `/v1/ai-tools/*` prefix.
