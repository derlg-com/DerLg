---
inclusion: manual
---

# Project Structure

## Repository Layout

```
derlg/
├── frontend/              # Next.js 16 — mobile-first PWA
├── backend/               # NestJS API server
├── vibe-booking/          # Python AI agent (LangGraph + FastAPI)
├── docs/                  # Technical documentation
└── .kiro/                 # Kiro configuration (specs, steering, hooks)
```

## Frontend (`frontend/`)

```
frontend/
├── app/                   # Next.js App Router
│   ├── (public)/          # Marketing pages (SSR)
│   ├── (auth)/            # Authentication flows
│   └── (app)/             # Authenticated app (CSR)
├── components/            # UI components (layout, feature, shared, ui)
├── lib/                   # Utilities (api, websocket, i18n, currency)
├── stores/                # Zustand state stores
└── public/                # Static assets, locales, offline maps
```

## Backend (`backend/`)

```
backend/
├── src/
│   ├── auth/              # Authentication & JWT
│   ├── users/             # User management
│   ├── trips/             # Trip packages catalog
│   ├── bookings/          # Booking lifecycle
│   ├── payments/          # Stripe integration
│   ├── transportation/    # Van, bus, tuk-tuk
│   ├── hotels/            # Hotel management
│   ├── guides/            # Tour guide management
│   ├── ai-tools/          # AI agent tool endpoints
│   ├── common/            # Guards, interceptors, filters, pipes
│   └── config/            # Configuration modules
└── test/                  # E2E tests
```

## AI Agent (`vibe-booking/`)

```
vibe-booking/
├── src/
│   ├── agent/             # LangGraph state machine, tools, prompts
│   ├── websocket/         # WebSocket chat handler
│   ├── services/          # Claude client, Redis, backend HTTP client
│   └── models/            # Pydantic schemas
└── tests/
```

## Key Principles

- One NestJS module per domain (controller + service + DTOs + entities)
- Frontend: route-based code splitting, feature components co-located with routes
- AI Agent: no direct DB access — all mutations via backend `/v1/ai-tools/*`
- Shared utilities in `common/` (backend) or `lib/` (frontend)
