# Roadmap: Official Architecture Document

> **Purpose:** Track the creation of the single official `architecture.md` that describes how the entire DerLg system works — services, data flow, tech stack, hosting, and integrations. This roadmap ensures the architecture doc is comprehensive, consistent, and references the correct source documents.

**Target output file:** `docs/platform/architecture/system-overview.md` (replaces the current outdated version)

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

- [ ] **Version Alignment**
  - [ ] `structure.md` says Next.js 14 → reconcile with `tech.md` (Next.js 16) and actual `package.json`
  - [ ] `structure.md` says NestJS 10 → reconcile with `tech.md` and actual `package.json`
  - [ ] `tech.md` says Claude Sonnet 4.5 → confirm model name accuracy

- [ ] **Directory Naming**
  - [ ] `structure.md` references `docs/architectures/` but actual directory was `docs/architechture/` → now consolidated under `docs/platform/`
  - [ ] `structure.md` references `llm_agentic_chatbot/` but no such directory exists yet → note as planned vs. actual

- [ ] **Scope Confirmation**
  - [ ] Confirm which third-party services are committed vs. aspirational (e.g. OpenWeatherMap, Google Maps API)
  - [ ] Confirm AI agent directory name and location

---

## Phase 1: System Overview

*The 30,000-foot view. Anyone reading this should understand what DerLg is and why it exists.*

- [ ] **Product Context** *(ref: `product.md`)*
  - [ ] Core value proposition (1–2 sentences)
  - [ ] Target users and primary market (Chinese tourists, students, etc.)
  - [ ] Business model (commission-based + loyalty)

- [ ] **System Diagram**
  - [ ] High-level architecture diagram (ASCII or Mermaid)
  - [ ] All three services shown: Frontend → Backend → AI Agent
  - [ ] Data stores shown: PostgreSQL, Redis, Supabase Storage
  - [ ] External services shown: Stripe, FCM, Resend, etc.

- [ ] **Key Design Principles**
  - [ ] Mobile-first PWA
  - [ ] AI-assisted booking ("Vibe Booking")
  - [ ] Multi-language support (EN/ZH/KM)
  - [ ] Offline-capable where possible

---

## Phase 2: Service Boundaries

*What each service owns, what it does not own, and how they talk.*

- [ ] **Frontend (Next.js)** *(ref: `tech.md`, `structure.md`)*
  - [ ] Responsibility: UI rendering, client state, PWA shell, offline caching
  - [ ] Rendering strategy: App Router, Server Components by default
  - [ ] Key libraries: Tailwind, Zustand, React Query, next-intl, Leaflet
  - [ ] Port: 3000
  - [ ] Deployment target: TBD (Vercel? Docker?)

- [ ] **Backend (NestJS)** *(ref: `tech.md`, `structure.md`)*
  - [ ] Responsibility: Business logic, auth, bookings, payments, notifications
  - [ ] Module list: all 16 modules documented
  - [ ] Key libraries: Prisma, Supabase Auth, Stripe SDK, class-validator
  - [ ] Port: 3001
  - [ ] Deployment target: TBD

- [ ] **AI Agent (Python/FastAPI)** *(ref: `tech.md`, `structure.md`)*
  - [ ] Responsibility: Conversational assistant, trip recommendations, booking via tools
  - [ ] Key libraries: LangGraph, Anthropic Claude, FastAPI
  - [ ] Communication: WebSocket (chat), HTTP (tool calls to backend)
  - [ ] Constraint: **No direct database access** — only via backend API
  - [ ] Session storage: Redis with 7-day TTL

- [ ] **Service Communication Matrix**
  - [ ] Frontend ↔ Backend: REST API (`/v1/*`)
  - [ ] Frontend ↔ AI Agent: WebSocket (direct or proxied through backend?)
  - [ ] AI Agent ↔ Backend: HTTP (`/v1/ai-tools/*` with `X-Service-Key`)
  - [ ] Backend → External: Stripe, Resend, FCM, ExchangeRate-API

---

## Phase 3: Data Architecture

*Where data lives, how it moves, and who owns it.*

- [ ] **Primary Database (PostgreSQL / Supabase)**
  - [ ] Role: Source of truth for all business data
  - [ ] Hosting: Supabase (production) vs. Docker `postgres:15-alpine` (dev)
  - [ ] ORM: Prisma — schema location, migration strategy
  - [ ] Row-Level Security (RLS) policy noted

- [ ] **Cache & Sessions (Redis)**
  - [ ] Role: Session store, rate limiting, pub/sub, AI conversation state
  - [ ] Hosting: Upstash (production) vs. Docker `redis:7-alpine` (dev)
  - [ ] Key patterns: TTL policies, key naming conventions

- [ ] **File Storage (Supabase Storage)**
  - [ ] Role: Avatars, ID verifications, hotel images
  - [ ] Access pattern: Public URL vs. signed URL?

- [ ] **Data Flow Diagrams**
  - [ ] Read flow: Frontend → Backend → Prisma → PostgreSQL
  - [ ] Write flow: Frontend → Backend → Prisma → PostgreSQL → Redis cache invalidation
  - [ ] AI flow: User message → AI Agent → Tool call → Backend → Database → Response

---

## Phase 4: Authentication & Security Architecture

*The most critical cross-cutting concern. Must be consistent across all three services.*

- [ ] **Auth Strategy** *(ref: `tech.md`)*
  - [ ] Supabase Auth for email/password + Google OAuth
  - [ ] Backend-issued JWT access token (15 min) + refresh token (7 days, httpOnly cookie)
  - [ ] AI Agent auth: `X-Service-Key` header for internal endpoints

- [ ] **Identity Flow**
  - [ ] Registration → Supabase creates user → Backend creates `users` record with `supabase_uid`
  - [ ] Login → Supabase validates → Backend issues JWT pair
  - [ ] Token refresh → Client sends refresh cookie → Backend issues new access token
  - [ ] Logout → Backend revokes refresh token → Client clears state

- [ ] **Authorization**
  - [ ] Role definitions: `user`, `guide`, `admin`, `student`
  - [ ] Permission model: RBAC or attribute-based?
  - [ ] AI Agent permissions: Which endpoints can it call? Which can it not?

- [ ] **Security Baseline**
  - [ ] Rate limiting (Redis-backed)
  - [ ] CORS whitelist
  - [ ] Input validation (class-validator DTOs)
  - [ ] Secret management (no hardcoded keys)
  - [ ] Stripe webhook signature verification

---

## Phase 5: Payment Architecture

*Money flow is the most failure-sensitive part of the system.*

- [ ] **Payment Methods**
  - [ ] Stripe: Card payments (Payment Intent or Checkout Session?)
  - [ ] Bakong / ABA QR: Cambodia-local payment method

- [ ] **Booking Hold & Confirmation Flow**
  - [ ] Step 1: User completes booking form → Backend creates booking with `RESERVED` status (15-min hold)
  - [ ] Step 2: Backend creates Stripe Payment Intent → returns `client_secret` to frontend
  - [ ] Step 3: Frontend completes payment (Stripe Elements or QR scan)
  - [ ] Step 4: Stripe webhook → Backend confirms payment → Booking status → `CONFIRMED`
  - [ ] Step 5: Side effects triggered (loyalty points, notifications, receipt email)

- [ ] **Failure Handling**
  - [ ] Hold expiration: Cron or Redis TTL releases inventory
  - [ ] Failed payment: Retry policy? User notification?
  - [ ] Refund tiers: 100% (>7 days), 50% (1–7 days), 0% (<24h)

- [ ] **Idempotency**
  - [ ] Webhook idempotency key strategy
  - [ ] Duplicate payment prevention

---

## Phase 6: Real-Time Communication

*How live data moves between services and users.*

- [ ] **AI Chat**
  - [ ] Protocol: WebSocket
  - [ ] Connection path: Frontend → AI Agent (direct?) or Frontend → Backend → AI Agent?
  - [ ] Message history: Persisted in Redis or PostgreSQL?

- [ ] **Payment Status Updates**
  - [ ] Protocol: Redis Pub/Sub or Server-Sent Events?
  - [ ] Flow: Stripe webhook → Backend publishes → Frontend subscribes

- [ ] **Push Notifications**
  - [ ] Protocol: Firebase Cloud Messaging (FCM)
  - [ ] Trigger events: Booking confirmed, payment failed, trip reminder, emergency alert

---

## Phase 7: AI Integration Architecture

*The AI agent is a fourth participant in most user journeys. Document its role clearly.*

- [ ] **Agent Capabilities**
  - [ ] Conversational trip planning
  - [ ] Search and recommendation (hotels, trips, guides)
  - [ ] Booking assistance (create holds, suggest dates)
  - [ ] Emergency guidance

- [ ] **Tool Calling**
  - [ ] Backend exposes `/v1/ai-tools/*` endpoints
  - [ ] AI agent calls these with `X-Service-Key`
  - [ ] Tools available: search hotels, search trips, create booking hold, check availability, get weather, etc.

- [ ] **State Machine**
  - [ ] LangGraph orchestrates conversation flow
  - [ ] Session state in Redis (7-day TTL)
  - [ ] Human-in-the-loop for payment execution (AI never charges directly)

---

## Phase 8: Deployment & Hosting

*Where everything runs in production and how it gets there.*

- [ ] **Frontend**
  - [ ] Hosting platform: Vercel? Docker on VPS? AWS?
  - [ ] Environment variables: `NEXT_PUBLIC_API_URL`, etc.
  - [ ] CDN for static assets and images

- [ ] **Backend**
  - [ ] Hosting platform: Docker? Railway? Render? AWS ECS?
  - [ ] Database connection pooling (PgBouncer? Supabase pooler?)
  - [ ] Health check endpoint for load balancers

- [ ] **AI Agent**
  - [ ] Hosting platform: Docker? Python-specific platform?
  - [ ] GPU requirements? (Claude is API-based, so likely none)

- [ ] **Data Stores**
  - [ ] PostgreSQL: Supabase managed vs. self-hosted
  - [ ] Redis: Upstash vs. self-hosted
  - [ ] Storage: Supabase Storage

- [ ] **CI/CD**
  - [ ] Build pipeline for each service
  - [ ] Database migration strategy (run in CI or manually?)
  - [ ] Deployment triggers (push to `main`? manual?)

---

## Phase 9: External Integrations

*Third-party services and how they fit.*

- [ ] **Payment**: Stripe + Bakong/ABA QR
- [ ] **Email**: Resend (transactional emails)
- [ ] **Push**: Firebase Cloud Messaging (FCM)
- [ ] **Maps**: Google Maps API or OpenStreetMap + Leaflet?
- [ ] **Weather**: OpenWeatherMap API (confirm if committed)
- [ ] **Currency**: ExchangeRate-API (daily USD/KHR/CNY conversion)
- [ ] **Storage**: Supabase Storage
- [ ] **Error Tracking**: Sentry

---

## Phase 10: Development Environment

*How a new developer gets the entire system running locally.*

- [ ] **Docker Compose**
  - [ ] Services: PostgreSQL, Redis, Backend, Frontend, AI Agent
  - [ ] Hot reload for all services
  - [ ] Prisma migrate + seed on first startup
  - [ ] File location: repo root or `backend/`?

- [ ] **Environment Files**
  - [ ] `.env.example` for each service
  - [ ] Required variables list per service
  - [ ] Secret generation guide (JWT secrets, service keys, Stripe keys)

- [ ] **Local Tooling**
  - [ ] Node.js version manager (nvm?)
  - [ ] Python virtual environment (venv? poetry?)
  - [ ] Database GUI (Prisma Studio? pgAdmin?)

---

## Phase 11: Observability & Operations

*How you know the system is healthy and what to do when it's not.*

- [ ] **Health Checks**
  - [ ] `/health` endpoint (backend): DB + Redis connectivity
  - [ ] Frontend health: build status, error rate

- [ ] **Monitoring**
  - [ ] Error tracking: Sentry integration
  - [ ] Logs: structured JSON logging from NestJS
  - [ ] Metrics: API latency, error rate, booking success rate

- [ ] **Alerting**
  - [ ] Critical: Payment webhook failures, database connectivity loss
  - [ ] Warning: High error rate, slow API responses

---

## Phase 12: Documentation Cross-References

*Link the architecture doc to the rest of the documentation ecosystem.*

- [ ] **Per-Feature Architecture**: Link to `docs/modules/*/architecture.md`
- [ ] **API Specifications**: Link to `docs/features/F*/api.yaml`
- [ ] **Backend Roadmap**: Link to `roadmap-backend.md`
- [ ] **Frontend Roadmap**: Link to `roadmap-frontend.md`
- [ ] **Kiro Specs**: Link to `.kiro/specs/` for implementation details

---

## Completion Checklist

*Before marking this roadmap complete:*

- [ ] `docs/platform/architecture/system-overview.md` is written and covers all sections above
- [ ] All contradictions between `.kiro/steering/*` files are resolved in the doc
- [ ] Old `docs/architecture.md` is archived or overwritten (migrated to `docs/platform/architecture/system-overview.md`)
- [ ] Empty `docs/architechture/` folder is deleted (typo fixed; content migrated to `docs/platform/`)
- [ ] At least one other person (or future you) can read the doc and understand the whole system

---

## Quick Links

- [Product Steering](../../.kiro/steering/product.md)
- [Structure Steering](../../.kiro/steering/structure.md)
- [Tech Steering](../../.kiro/steering/tech.md)
- [Backend Roadmap](roadmap-backend.md)
- [Frontend Roadmap](roadmap-frontend.md)
- [Current (Outdated) Architecture](../architecture/system-overview.md)
