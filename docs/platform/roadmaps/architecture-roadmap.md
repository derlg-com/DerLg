# Roadmap: Official Architecture Document

> **Purpose:** Track the creation of the single official `architecture.md` that describes how the entire DerLg system works — services, data flow, tech stack, hosting, and integrations. This roadmap ensures the architecture doc is comprehensive, consistent, and references the correct source documents.

**Target output:** `docs/platform/architecture/*.md` — multi-file architecture documentation suite (replaces the single outdated `system-overview.md`)

**Primary references:**
- [`.kiro/steering/product.md`](../../.kiro/steering/product.md) — Product overview, features, users, business model
- [`.kiro/steering/structure.md`](../../.kiro/steering/structure.md) — Repository layout, directory structure, naming conventions
- [`.kiro/steering/tech.md`](../../.kiro/steering/tech.md) — Technology stack, common commands, API conventions, security

---

## How to Use This Roadmap

1. **Work in order.** Each section builds context for the next.
2. **Check boxes when the section is drafted in `architecture.md`.**
3. **Resolve conflicts** between the three steering files before writing (e.g., `structure.md` says Next.js 14 but `tech.md` says Next.js 16).
4. **Delete the old `docs/architecture.md` only after the new one is complete.**

---

## Phase 0: Reconcile Source Documents

*Before writing a single line of architecture.md, fix contradictions in the steering files.*

- [x] **Version Alignment**
  - [x] `structure.md` says Next.js 14 → reconcile with `tech.md` (Next.js 16) and actual `package.json` → **Resolved: Next.js 16.2.6, React 19.2.4**
  - [x] `structure.md` says NestJS 10 → reconcile with `tech.md` and actual `package.json` → **Resolved: NestJS 11.x**
  - [x] `tech.md` says Claude Sonnet 4.5 → confirm model name accuracy → **Resolved: Claude 4 Sonnet**

- [x] **Directory Naming**
  - [x] `structure.md` references `docs/architectures/` but actual directory was `docs/architechture/` → now consolidated under `docs/platform/` → **Verified: `docs/platform/architecture/` is correct; old typo folder does not exist**
  - [x] `structure.md` references `vibe-booking/` but no such directory exists yet → note as planned vs. actual → **Documented as planned directory**

- [x] **Scope Confirmation**
  - [x] Confirm which third-party services are committed vs. aspirational (e.g. OpenWeatherMap, Google Maps API) → **Resolved: OpenStreetMap + Leaflet committed; Google Maps aspirational; OpenWeatherMap aspirational**
  - [x] Confirm AI agent directory name and location → **Resolved: `vibe-booking/` at repo root**

---

## Phase 1: System Overview

*The 30,000-foot view. Anyone reading this should understand what DerLg is and why it exists.*

- [x] **Product Context** *(ref: `product.md`)*
  - [x] Core value proposition (1–2 sentences)
  - [x] Target users and primary market (Chinese tourists, students, etc.)
  - [x] Business model (commission-based + loyalty)

- [x] **System Diagram**
  - [x] High-level architecture diagram (Mermaid)
  - [x] All three services shown: Frontend → Backend → AI Agent
  - [x] Data stores shown: PostgreSQL, Redis, Supabase Storage
  - [x] External services shown: Stripe, FCM, Resend, etc.

- [x] **Key Design Principles**
  - [x] Mobile-first PWA
  - [x] AI-assisted booking ("Vibe Booking")
  - [x] Multi-language support (EN/ZH/KM)
  - [x] Offline-capable where possible

---

## Phase 2: Service Boundaries

*What each service owns, what it does not own, and how they talk.*

- [x] **Frontend (Next.js 16)** *(ref: `tech.md`, `structure.md`)*
  - [x] Responsibility: UI rendering, client state, PWA shell, offline caching
  - [x] Rendering strategy: App Router, Server Components by default
  - [x] Key libraries: Tailwind, Zustand, React Query, next-intl, Leaflet
  - [x] Port: 3000
  - [x] Deployment target: Docker on VPS (AWS/DigitalOcean)

- [x] **Backend (NestJS 11)** *(ref: `tech.md`, `structure.md`)*
  - [x] Responsibility: Business logic, auth, bookings, payments, notifications
  - [x] Module list: all 16 modules documented
  - [x] Key libraries: Prisma, Supabase Auth, Stripe SDK, class-validator
  - [x] Port: 3001
  - [x] Deployment target: Docker on VPS (AWS/DigitalOcean)

- [x] **AI Agent (Python/FastAPI)** *(ref: `tech.md`, `structure.md`)*
  - [x] Responsibility: Conversational assistant, trip recommendations, booking via tools
  - [x] Key libraries: LangGraph, Claude 4 Sonnet, FastAPI
  - [x] Communication: WebSocket (chat), HTTP (tool calls to backend)
  - [x] Constraint: **No direct database access** — only via backend API
  - [x] Session storage: Redis with 7-day TTL

- [x] **Service Communication Matrix**
  - [x] Frontend ↔ Backend: REST API (`/v1/*`)
  - [x] Frontend ↔ AI Agent: WebSocket (**direct**, same Docker network)
  - [x] AI Agent ↔ Backend: HTTP (`/v1/ai-tools/*` with `X-Service-Key`)
  - [x] Backend → External: Stripe, Resend, FCM, ExchangeRate-API
  - [x] Bakong: separate payment service → Backend webhooks

---

## Phase 3: Data Architecture

*Where data lives, how it moves, and who owns it.*

- [x] **Primary Database (PostgreSQL / Supabase)**
  - [x] Role: Source of truth for all business data
  - [x] Hosting: Supabase (production) vs. Docker `postgres:15-alpine` (dev)
  - [x] ORM: Prisma — schema location, migration strategy
  - [x] Row-Level Security (RLS) policy noted

- [x] **Cache & Sessions (Redis)**
  - [x] Role: Session store, rate limiting, pub/sub, AI conversation state
  - [x] Hosting: Upstash (production) vs. Docker `redis:7-alpine` (dev)
  - [x] Key patterns: TTL policies, key naming conventions

- [x] **File Storage (Supabase Storage)**
  - [x] Role: Avatars, ID verifications, hotel images
  - [x] Access pattern: Public URL (images) vs. signed URL (uploads, receipts)

- [x] **Data Flow Diagrams**
  - [x] Read flow: Frontend → Backend → Prisma → PostgreSQL
  - [x] Write flow: Frontend → Backend → Prisma → PostgreSQL → Redis cache invalidation
  - [x] AI flow: User message → AI Agent → Tool call → Backend → Database → Response

---

## Phase 4: Authentication & Security Architecture

*The most critical cross-cutting concern. Must be consistent across all three services.*

- [x] **Auth Strategy** *(ref: `tech.md`)*
  - [x] Supabase Auth for email/password + Google OAuth
  - [x] Backend-issued JWT access token (15 min) + refresh token (7 days, httpOnly cookie)
  - [x] AI Agent auth: `X-Service-Key` header for internal endpoints

- [x] **Identity Flow**
  - [x] Registration → Supabase creates user → Backend creates `users` record with `supabase_uid`
  - [x] Login → Supabase validates → Backend issues JWT pair
  - [x] Token refresh → Client sends refresh cookie → Backend issues new access token
  - [x] Logout → Backend revokes refresh token → Client clears state

- [x] **Authorization**
  - [x] Role definitions: `user`, `guide`, `admin`, `student`
  - [x] Permission model: **RBAC**
  - [x] AI Agent permissions: Documented — `/v1/ai-tools/*` allowed; payments/admin denied

- [x] **Security Baseline**
  - [x] Rate limiting (Redis-backed)
  - [x] CORS whitelist
  - [x] Input validation (class-validator DTOs)
  - [x] Secret management (no hardcoded keys)
  - [x] Stripe webhook signature verification

---

## Phase 5: Payment Architecture

*Money flow is the most failure-sensitive part of the system.*

- [x] **Payment Methods**
  - [x] Stripe: Card payments (**Payment Intent + Stripe Elements**)
  - [x] Bakong / ABA QR: Cambodia-local payment method (**separate service**)

- [x] **Booking Hold & Confirmation Flow**
  - [x] Step 1: User completes booking form → Backend creates booking with `RESERVED` status (15-min hold)
  - [x] Step 2: Backend creates Stripe Payment Intent → returns `client_secret` to frontend
  - [x] Step 3: Frontend completes payment (Stripe Elements or QR scan)
  - [x] Step 4: Stripe webhook → Backend confirms payment → Booking status → `CONFIRMED`
  - [x] Step 5: Side effects triggered (loyalty points, notifications, receipt email)

- [x] **Failure Handling**
  - [x] Hold expiration: Redis TTL + cron backup releases inventory
  - [x] Failed payment: Retry policy documented (1 hold extension)
  - [x] Refund tiers: 100% (>7 days), 50% (1–7 days), 0% (<24h)

- [x] **Idempotency**
  - [x] Webhook idempotency key strategy (Redis `webhook:stripe:{event_id}`)
  - [x] Duplicate payment prevention (one active PaymentIntent per booking)

---

## Phase 6: Real-Time Communication

*How live data moves between services and users.*

- [x] **AI Chat**
  - [x] Protocol: WebSocket
  - [x] Connection path: Frontend → AI Agent (**direct**, same Docker network)
  - [x] Message history: Redis (active, 7d TTL) + PostgreSQL (archive)

- [x] **Payment Status Updates**
  - [x] Protocol: **Server-Sent Events (SSE)** — primary; short-polling fallback
  - [x] Flow: Stripe webhook → Backend publishes → Frontend subscribes via SSE

- [x] **Push Notifications**
  - [x] Protocol: Firebase Cloud Messaging (FCM)
  - [x] Trigger events: Booking confirmed, payment failed, trip reminder, emergency alert

---

## Phase 7: AI Integration Architecture

*The AI agent is a fourth participant in most user journeys. Document its role clearly.*

- [x] **Agent Capabilities**
  - [x] Conversational trip planning
  - [x] Search and recommendation (hotels, trips, guides)
  - [x] Booking assistance (create holds, suggest dates)
  - [x] Emergency guidance

- [x] **Tool Calling**
  - [x] Backend exposes `/v1/ai-tools/*` endpoints
  - [x] AI agent calls these with `X-Service-Key`
  - [x] Tools available: search hotels, search trips, create booking hold, check availability, get weather, etc.

- [x] **State Machine**
  - [x] LangGraph orchestrates conversation flow
  - [x] Session state in Redis (7-day TTL)
  - [x] Human-in-the-loop for payment execution (AI never charges directly)

---

## Phase 8: Deployment & Hosting

*Where everything runs in production and how it gets there.*

- [x] **Frontend**
  - [x] Hosting platform: Docker on VPS (AWS/DigitalOcean)
  - [x] Environment variables: `NEXT_PUBLIC_API_URL`, etc.
  - [x] CDN for static assets and images

- [x] **Backend**
  - [x] Hosting platform: Docker on VPS (AWS/DigitalOcean)
  - [x] Database connection pooling (Supabase pooler / PgBouncer)
  - [x] Health check endpoint (`/health`) for load balancers

- [x] **AI Agent**
  - [x] Hosting platform: Docker on VPS (same host)
  - [x] GPU requirements: None (Claude is API-based)

- [x] **Data Stores**
  - [x] PostgreSQL: Supabase managed (prod) / Docker (dev)
  - [x] Redis: Upstash (prod) / Docker (dev)
  - [x] Storage: Supabase Storage

- [x] **CI/CD**
  - [x] Build pipeline for each service (GitHub Actions → Docker Hub → VPS)
  - [x] Database migration strategy: `prisma migrate deploy` in CI/on startup
  - [x] Deployment triggers: push to `main`; manual rollback via workflow dispatch

---

## Phase 9: External Integrations

*Third-party services and how they fit.*

- [x] **Payment**: Stripe + Bakong/ABA QR
- [x] **Email**: Resend (transactional emails)
- [x] **Push**: Firebase Cloud Messaging (FCM)
- [x] **Maps**: **OpenStreetMap + Leaflet** (committed); Google Maps API (aspirational)
- [x] **Weather**: OpenWeatherMap API (**aspirational**)
- [x] **Currency**: ExchangeRate-API (daily USD/KHR/CNY conversion)
- [x] **Storage**: Supabase Storage
- [x] **Error Tracking**: Sentry

---

## Phase 10: Development Environment

*How a new developer gets the entire system running locally.*

- [x] **Docker Compose**
  - [x] Services: PostgreSQL, Redis, Backend, Frontend, AI Agent
  - [x] Hot reload for all services
  - [x] Prisma migrate + seed on first startup
  - [x] File location: **repo root**

- [x] **Environment Files**
  - [x] `.env.example` for each service
  - [x] Required variables list per service
  - [x] Secret generation guide (JWT secrets, service keys, Stripe keys)

- [x] **Local Tooling**
  - [x] Node.js version manager (nvm recommended)
  - [x] Python virtual environment (venv)
  - [x] Database GUI (Prisma Studio + optional pgAdmin)

---

## Phase 11: Observability & Operations

*How you know the system is healthy and what to do when it's not.*

- [x] **Health Checks**
  - [x] `/health` endpoint (backend): DB + Redis connectivity
  - [x] Frontend health: build status, error rate (CI + Sentry)

- [x] **Monitoring**
  - [x] Error tracking: Sentry integration (frontend, backend, AI agent)
  - [x] Logs: structured JSON logging from NestJS + Python structlog
  - [x] Metrics: API latency, error rate, booking success rate

- [x] **Alerting**
  - [x] Critical: Payment webhook failures, database connectivity loss
  - [x] Warning: High error rate, slow API responses

---

## Phase 12: Documentation Cross-References

*Link the architecture doc to the rest of the documentation ecosystem.*

- [x] **Per-Feature Architecture**: Link to `docs/modules/*/README.md`
- [x] **API Specifications**: Link to `docs/modules/*/README.md` and `.kiro/specs/*/requirements.md`
- [x] **Backend Roadmap**: Link to `roadmap-backend.md`
- [x] **Frontend Roadmap**: Link to `roadmap-frontend.md`
- [x] **Kiro Specs**: Link to `.kiro/specs/` for implementation details

---

## Completion Checklist

*Before marking this roadmap complete:*

- [x] `docs/platform/architecture/*.md` is written and covers all sections above (replaced single-file approach with 7 focused files)
- [x] All contradictions between `.kiro/steering/*` files are resolved in the docs
- [x] Old `docs/architecture.md` does not exist; outdated `system-overview.md` deleted
- [x] Empty `docs/architechture/` folder does not exist
- [x] At least one other person (or future you) can read `index.md` and understand the whole system

---

## Quick Links

- [Product Steering](../../.kiro/steering/product.md)
- [Structure Steering](../../.kiro/steering/structure.md)
- [Tech Steering](../../.kiro/steering/tech.md)
- [Backend Roadmap](roadmap-backend.md)
- [Frontend Roadmap](roadmap-frontend.md)
- [Architecture Index](../architecture/index.md)
