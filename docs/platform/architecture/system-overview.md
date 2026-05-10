# DerLg — System Architecture

## Overview

DerLg is a fullstack travel booking platform composed of three main services:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 14+   │◄───►│  NestJS Backend │◄───►│  Python AI Bot  │
│   (Frontend)    │ REST│   (Port 3001)   │Tools│  (LangGraph)    │
│   PWA + i18n    │     │                 │     │  (Claude LLM)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌──────────┐
              │Supabase │  │  Redis  │  │  Stripe  │
              │  (PG)   │  │ (Cache) │  │(Payments)│
              └─────────┘  └─────────┘  └──────────┘
```

## Service Boundaries

### Frontend (Next.js 14 App Router)
- **Responsibility**: UI rendering, client state, PWA shell, offline caching
- **Key Tech**: TypeScript, Tailwind CSS, Zustand, React Query, Leaflet.js
- **Ports**: 3000 (dev)
- **Deployment**: Vercel / containerized

### Backend (NestJS 10)
- **Responsibility**: Business logic, auth, bookings, payments, notifications
- **Key Tech**: TypeScript, Prisma ORM, Supabase PostgreSQL, Redis, Stripe SDK
- **Ports**: 3001
- **Modules**: auth, users, trips, bookings, payments, transportation, hotels, guides, explore, festivals, emergency, student-discount, loyalty, notifications, currency, ai-tools

### AI Agent (Python)
- **Responsibility**: Conversational travel assistant, trip recommendations, booking via tools
- **Key Tech**: Python 3.11, LangGraph, Claude (Anthropic), WebSocket
- **Integration**: Calls backend `/v1/ai-tools/*` endpoints with service key auth

## Data Stores

| Store | Role | Production | Development |
|-------|------|------------|-------------|
| PostgreSQL | Primary database | Supabase | Docker `postgres:15-alpine` |
| Redis | Cache, sessions, pub/sub | Upstash | Docker `redis:7-alpine` |
| Supabase Storage | File uploads (avatars, IDs, images) | Supabase | Supabase (local or cloud) |

## Authentication Flow

1. User registers via Supabase Auth (email/password or Google OAuth)
2. Backend creates linked `users` record with `supabase_uid`
3. Backend issues JWT access token (15 min) + refresh token (7 days, httpOnly cookie)
4. Frontend includes access token in `Authorization` header for API calls
5. AI agent uses `X-Service-Key` header for tool endpoints

## Payment Flow

1. User completes booking form → backend creates booking with `RESERVED` status (15-min hold)
2. Backend creates Stripe Payment Intent → returns `client_secret` to frontend
3. Frontend completes Stripe Elements / QR code payment
4. Stripe webhook → backend updates booking to `CONFIRMED`, awards loyalty points, sends notifications

## Real-Time Communication

| Channel | Protocol | Use Case |
|---------|----------|----------|
| AI Chat | WebSocket | Bidirectional chat with AI agent |
| Payment Status | Redis Pub/Sub | Real-time payment updates to frontend |
| Push Notifications | FCM | Booking reminders, marketing |

## Development Environment

All services run via Docker Compose:
- `docker-compose up` spins up PostgreSQL, Redis, Backend, Frontend, AI Chatbot
- Hot reload enabled for all services
- Prisma migrations + seed run automatically on first startup

See `docker-compose.yml` and `.kiro/specs/backend-nestjs-supabase/` for detailed Docker configuration.

## External Integrations

| Service | Purpose |
|---------|---------|
| Stripe | Card payments + webhook processing |
| ExchangeRate-API | Daily currency conversion (USD/KHR/CNY) |
| Resend | Transactional emails |
| FCM | Push notifications |
| OpenStreetMap + Leaflet | Map tiles and offline caching |

---

*For API contracts, see `.kiro/specs/*/requirements.md`. For deployment details, see `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 41–54).*