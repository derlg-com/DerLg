# Service Boundaries & External Integrations

> **Scope:** What each service owns, what it does not own, and how they talk to each other and to the outside world.

---

## Frontend (Next.js 16)

| Attribute | Detail |
|-----------|--------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **React** | 19.2.4 |
| **Port** | 3000 |
| **Deployment** | Docker container on VPS |

### Responsibilities

- **UI rendering:** Server Components by default; Client Components for interactivity.
- **PWA shell:** Service worker for offline caching, manifest for installability.
- **Client state:** Zustand stores (auth, booking, chat, language).
- **Server state:** React Query for data fetching, caching, and background updates.
- **Internationalization:** `next-intl` routing and translations (EN / ZH / KM).
- **Maps:** Leaflet.js with OpenStreetMap tiles; offline tile caching in `public/offline/maps/`.

### Key Libraries

| Library | Purpose |
|---------|---------|
| Tailwind CSS v4 | Utility-first styling |
| shadcn/ui | Base UI components |
| Zustand | Client-side state |
| React Query | Server-state synchronization |
| next-intl | i18n routing and translations |
| Leaflet.js | Interactive maps |
| React Hook Form + Zod | Form handling and validation |

### What the Frontend Does NOT Do

- It does not hold business logic beyond presentation rules.
- It does not access the database directly.
- It does not store payment credentials (Stripe Elements handles this).

---

## Backend (NestJS 11)

| Attribute | Detail |
|-----------|--------|
| **Framework** | NestJS 11 |
| **Language** | TypeScript 5.7 |
| **Port** | 3001 |
| **Deployment** | Docker container on VPS |

### Responsibilities

- **Business logic:** Auth, bookings, payments, notifications, loyalty, currency exchange.
- **API surface:** REST endpoints under `/v1/*` with consistent response envelopes.
- **Data access:** Prisma ORM is the only way to touch PostgreSQL.
- **Validation:** `class-validator` + `class-transformer` on all DTOs.
- **External coordination:** Stripe webhooks, Resend emails, FCM push notifications, ExchangeRate-API.

### Module Inventory

The backend is organized into 16 domain modules:

| Module | Responsibility |
|--------|---------------|
| `auth` | JWT issuance, token refresh, logout revocation |
| `users` | Profile management, preferences, linked `supabase_uid` records |
| `trips` | Trip packages catalog, availability, pricing |
| `bookings` | Booking lifecycle: creation, holds, confirmation, cancellation |
| `payments` | Stripe integration, webhook handling, refund logic |
| `transportation` | Tuk-tuk, van, bus bookings and scheduling |
| `hotels` | Hotel listings, rooms, availability, pricing |
| `guides` | Tour guide profiles, bookings, reviews |
| `explore` | Places, attractions, culture content |
| `festivals` | Festival calendar and event alerts |
| `emergency` | Emergency contacts, safety alerts, SOS flow |
| `student-discount` | Student verification (ID upload), discounted pricing |
| `loyalty` | Points accrual, tiers, redemption |
| `notifications` | Push (FCM) and email (Resend) orchestration |
| `currency` | Daily exchange rates (USD / KHR / CNY) via ExchangeRate-API |
| `ai-tools` | Tool endpoints exposed exclusively for the AI agent |

### What the Backend Does NOT Do

- It does not render HTML (no view layer).
- It does not run the AI model (delegated to the AI agent service).
- It does not perform long-running chat sessions (delegated to AI agent via WebSocket).

---

## AI Agent (Python / FastAPI)

| Attribute | Detail |
|-----------|--------|
| **Framework** | FastAPI (Python 3.11) |
| **Agent orchestration** | LangGraph |
| **LLM** | Claude 4 Sonnet (Anthropic API) |
| **Port** | 8000 |
| **Deployment** | Docker container on VPS |
| **Planned directory** | `vibe-booking/` (not yet created) |

### Responsibilities

- **Conversational assistant:** Natural-language trip planning, recommendations, and Q&A.
- **Booking assistance:** Create booking holds, suggest dates, check availability.
- **Emergency guidance:** Provide safety advice and route users to emergency services.
- **Tool calling:** Execute structured actions by calling backend `/v1/ai-tools/*` endpoints.

### Key Constraints

- **No direct database access.** The AI agent reads and writes data only through backend APIs.
- **No direct payment execution.** The agent can guide users to payment flows but never charges cards or creates Stripe charges.
- **Session state** is stored in Redis with a 7-day TTL.

### Internal Structure (Planned)

```
vibe-booking/
├── src/
│   ├── main.py              # FastAPI bootstrap
│   ├── agent/
│   │   ├── state_machine.py # LangGraph graph definition
│   │   ├── tools.py         # Tool definitions
│   │   ├── prompts.py       # System prompts
│   │   └── nodes.py         # Graph nodes
│   ├── websocket/
│   │   └── chat_handler.py  # WebSocket connection manager
│   ├── services/
│   │   ├── claude_client.py # Anthropic API wrapper
│   │   ├── redis_client.py  # Session storage
│   │   └── backend_client.py# HTTP client for backend
│   └── models/
│       ├── conversation.py  # Conversation state schemas
│       └── messages.py      # Message schemas
```

---

## Service Communication Matrix

| From | To | Protocol | Path / Topic | Auth |
|------|-----|----------|--------------|------|
| Frontend | Backend | REST | `/v1/*` | Bearer JWT (15-min access token) |
| Frontend | AI Agent | WebSocket | `/ws/chat` | Bearer JWT (same access token) |
| AI Agent | Backend | HTTP | `/v1/ai-tools/*` | `X-Service-Key` header |
| Backend | PostgreSQL | TCP | `5432` | Connection string + SSL |
| Backend | Redis | TCP | `6379` | Redis URL + TLS |
| Backend | Supabase Storage | HTTPS | Supabase REST API | Service role key |
| Backend | Stripe | HTTPS | `api.stripe.com` | Stripe secret key |
| Backend | Resend | HTTPS | `api.resend.com` | Resend API key |
| Backend | FCM | HTTPS | `fcm.googleapis.com` | Firebase service account |
| Backend | ExchangeRate-API | HTTPS | `api.exchangerate-api.com` | API key |
| Backend | Sentry | HTTPS | Sentry ingest URL | DSN |
| Frontend | OpenStreetMap | HTTPS | `tile.openstreetmap.org` | None (public tiles) |
| Bakong Service | Backend | Webhook / REST | TBD | TBD |

> **Note on AI chat path:** Because all services run inside the same Docker network on a single VPS, the frontend opens a direct WebSocket to the FastAPI AI agent. There is no backend proxy for chat traffic.

---

## External Integrations

### Committed Services

These services are actively integrated or have implementation specs in progress.

| Service | Purpose | Integration Point | Environment Keys |
|---------|---------|-------------------|------------------|
| **Stripe** | Card payments (international tourists) | Backend `payments` module | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Bakong / ABA QR** | Cambodia-local QR code payments | Separate microservice; webhooks to backend | TBD |
| **Resend** | Transactional emails (receipts, booking confirmations) | Backend `notifications` module | `RESEND_API_KEY` |
| **Firebase Cloud Messaging (FCM)** | Push notifications (booking updates, trip reminders, emergency alerts) | Backend `notifications` module | Firebase service account JSON |
| **Supabase Storage** | File uploads (avatars, ID verifications, hotel images) | Backend direct upload | `SUPABASE_SERVICE_ROLE_KEY` |
| **ExchangeRate-API** | Daily currency conversion (USD / KHR / CNY) | Backend `currency` module | `EXCHANGERATE_API_KEY` |
| **Sentry** | Error tracking and performance monitoring | Frontend + Backend SDKs | `SENTRY_DSN` |
| **OpenStreetMap** | Map tiles (free, no API key required) | Frontend Leaflet.js | None |

### Aspirational / Future Services

| Service | Purpose | Status |
|---------|---------|--------|
| **OpenWeatherMap API** | Weather data for trip recommendations | Not yet committed; may be added later for AI-enhanced planning. |
| **Google Maps API** | Places autocomplete, geocoding | Replaced by OpenStreetMap + Leaflet for cost control. May be revisited for Places data. |

---

## Integration Notes

### Stripe
- Backend creates **Payment Intents** and returns `client_secret` to the frontend.
- Frontend uses **Stripe Elements** to collect card details securely.
- Stripe webhooks hit the backend to confirm payment success/failure.
- See [`payments.md`](./payments.md) for the full money flow.

### Bakong / ABA QR
- Operates as a **separate payment service** (not inside the main backend).
- Generates QR codes for Cambodia-local bank transfers.
- Sends webhooks to the backend to confirm settlement.

### Resend
- Used for transactional emails only (not marketing).
- Templates: booking receipt, payment failure, trip reminder, password reset.

### FCM
- Topics: `booking_updates`, `trip_reminders`, `emergency_alerts`.
- Backend publishes; frontend subscribes per-user.

### Supabase Storage
- **Public buckets:** Hotel images, place photos (public URL).
- **Private buckets:** ID verifications, avatar uploads (signed URL, 1-hour expiry).

---

*For data architecture, see [`data.md`](./data.md). For security flows, see [`security.md`](./security.md).*
