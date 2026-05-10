# Backend Architecture Design Roadmap

> **Purpose:** Track architectural decisions, design phases, and completion status for the DerLg NestJS backend. This is a living document — update it as decisions are made or revised.

---

## How to Use This File

1. **Work top-down.** Each phase builds on the previous. Do not skip ahead.
2. **Check boxes only after the design is documented.** "Documented" means a decision is written down (in this repo, in a spec, or in code) — not just discussed.
3. **Use the Decision Log at the bottom** to record "why" for irreversible choices.

---

## Phase 0: Foundation & Constraints

*Lock these before any module design begins.*

- [ ] **Runtime Contract**
  - [ ] Confirm NestJS version (currently v11 — update specs if they reference v10)
  - [ ] Node.js version target (LTS?)
  - [ ] Deployment target (Docker container, serverless, VPS?)

- [ ] **Data Layer Decision**
  - [ ] Prisma as ORM (confirmed?)
  - [ ] Database: Supabase hosted PostgreSQL vs. self-hosted/Docker
  - [ ] Redis: Upstash vs. Docker `redis:7-alpine`
  - [ ] Connection pooling strategy (PgBouncer, Supabase pooler, Prisma direct?)

- [ ] **Auth Ownership** *(highest impact decision)*
  - [ ] **Option A**: Supabase Auth is source of truth; backend validates Supabase JWTs only
  - [ ] **Option B**: Backend issues custom JWTs (access + refresh); Supabase used for OAuth/password hashing only
  - [ ] **Option C**: Hybrid — document exactly which flows use which tokens
  - [ ] Decision recorded in Decision Log below

- [ ] **Project Bootstrap**
  - [ ] Docker Compose location: repo root or `backend/`?
  - [ ] `.env` strategy: single root file or split per service?
  - [ ] `prisma/schema.prisma` created with base connection
  - [ ] `backend/.env.example` created with all required keys listed

---

## Phase 1: Core Infrastructure (No Business Logic)

*Build the "basement" every module will stand on.*

- [ ] **Configuration**
  - [ ] `ConfigModule` with validation schema (Joi or custom)
  - [ ] Environment variable typing (`@nestjs/config` with `ConfigService`)

- [ ] **Database Access**
  - [ ] `PrismaModule` as global singleton
  - [ ] Prisma Client lifecycle (connect on init, disconnect on shutdown)
  - [ ] Raw query escape hatch policy (when is it allowed?)

- [ ] **Global HTTP Pipeline**
  - [ ] API prefix: `/v1/` confirmed
  - [ ] Response envelope: `{ success, data, message, error }` — enforce globally or per-controller?
  - [ ] Global exception filter mapping (Prisma errors → HTTP status codes)
  - [ ] Global validation pipe (`class-validator` + `class-transformer` settings)

- [ ] **Cross-Cutting Behaviors**
  - [ ] Request ID / correlation ID injection (logging + tracing)
  - [ ] Structured logging strategy (Winston / Pino / NestJS built-in)
  - [ ] Rate limiting: `@nestjs/throttler` with Redis store
  - [ ] CORS whitelist configuration

- [ ] **Security Baseline**
  - [ ] Helmet middleware
  - [ ] Content Security Policy (if serving any HTML)
  - [ ] Secret management: never commit secrets; validate at startup

---

## Phase 2: Shared Kernel (`common/`)

*Reusable primitives used by feature modules.*

- [ ] **Guards**
  - [ ] `JwtAuthGuard` (or `SupabaseAuthGuard` depending on Phase 0 decision)
  - [ ] `RolesGuard` (RBAC decorator + guard)
  - [ ] `ThrottlerGuard` configuration

- [ ] **Decorators**
  - [ ] `@CurrentUser()` to extract user from request
  - [ ] `@Roles()` for RBAC
  - [ ] `@Public()` to bypass auth on specific routes

- [ ] **Interceptors**
  - [ ] Logging interceptor (request/response with timing)
  - [ ] Transform interceptor (envelope wrapper)
  - [ ] Cache interceptor policy (when to use Redis cache vs. Prisma queries)

- [ ] **Filters**
  - [ ] Prisma exception filter (`P2002` unique constraint → 409, `P2025` not found → 404, etc.)
  - [ ] Catch-all exception filter (unknown errors → 500 with safe message)

- [ ] **Utilities**
  - [ ] Pagination DTO (`limit`, `offset`, `cursor`)
  - [ ] Sorting / filtering query parser
  - [ ] Date/time handling (UTC enforcement policy)

---

## Phase 3: Domain Foundation (`auth` + `users`)

*These block every other module. Get them right.*

- [ ] **Users Module**
  - [ ] Prisma `User` model finalized
  - [ ] User profile CRUD
  - [ ] Avatar upload policy (Supabase Storage? local?)

- [ ] **Auth Module**
  - [ ] Login flow (password validation strategy)
  - [ ] Token issuance (access + refresh) or Supabase session validation
  - [ ] Refresh token rotation (if custom JWT)
  - [ ] Logout / revoke token logic
  - [ ] Google OAuth flow (redirect, callback, account linking)
  - [ ] Password reset flow (who sends email — Supabase or backend via Resend?)

- [ ] **Authorization Matrix**
  - [ ] Roles defined: `user`, `guide`, `admin`, `student`?
  - [ ] Permissions mapped (e.g. `booking:cancel-own`, `booking:cancel-any`)

---

## Phase 4: Inventory Modules (`trips`, `hotels`, `guides`, `transport`, `explore`)

*Read-heavy, write-restricted modules. Define boundaries carefully.*

- [ ] **Module Boundaries**
  - [ ] Each module exposes its own service interface
  - [ ] Inventory modules **do not** import `bookings` or `payments` (dependency direction enforced)

- [ ] **Common Patterns**
  - [ ] Availability / capacity model (how is "slots remaining" calculated?)
  - [ ] Pricing model (base price, seasonal modifiers, currency?)
  - [ ] Media handling (images stored where? served via CDN?)

- [ ] **Per Module**
  - [ ] `trips`: itinerary schema, group vs. private trips
  - [ ] `hotels`: room types, amenities, cancellation policy per hotel
  - [ ] `guides`: language skills, certification, availability calendar
  - [ ] `transport`: vehicle types, routes, pricing tiers
  - [ ] `explore`: categories, search indexing strategy (full-text?)

---

## Phase 5: Orchestration Modules (`bookings` + `payments`)

*The most complex business logic. Design for failure.*

- [ ] **Booking State Machine**
  - [ ] States defined: `PENDING_HOLD` → `HELD` → `PAYMENT_INITIATED` → `CONFIRMED` | `EXPIRED` | `CANCELLED`
  - [ ] State transitions guarded (which roles/actions trigger which moves?)
  - [ ] 15-minute hold expiration mechanism (cron job? Redis TTL?)
  - [ ] Inventory release on expiry/cancellation

- [ ] **Payment Architecture**
  - [ ] Stripe integration: checkout session vs. payment intent?
  - [ ] Bakong / ABA QR code flow (manual confirmation or webhook?)
  - [ ] Webhook handling: idempotency key strategy
  - [ ] Refund policy tiers documented and enforced in code
  - [ ] Failed payment retry policy

- [ ] **Transaction Boundaries**
  - [ ] Prisma `$transaction` usage rules (when to use, when to avoid)
  - [ ] Saga pattern for multi-step bookings (compensating actions defined)

---

## Phase 6: Reactive / Async Modules (`notifications`, `loyalty`, `emergency`)

*Event-driven or time-sensitive. Decouple from core booking flow.*

- [ ] **Event System**
  - [ ] NestJS `EventEmitter` vs. Redis Pub/Sub vs. in-memory queue
  - [ ] Event naming convention (`BookingCreatedEvent`, `PaymentSucceededEvent`)

- [ ] **Notifications**
  - [ ] Channels: email (Resend), push (FCM), SMS?
  - [ ] Notification template system
  - [ ] Retry policy for failed deliveries

- [ ] **Loyalty**
  - [ ] Point accrual rules (2 pts/USD confirmed?)
  - [ ] Redemption flow (100 pts = $1 confirmed?)
  - [ ] Expiration policy

- [ ] **Emergency**
  - [ ] SOS trigger flow (who gets notified? real-time or batched?)
  - [ ] Location data retention policy (privacy)

---

## Phase 7: AI Integration (`ai-tools`)

*Bridge between NestJS backend and Python AI agent.*

- [ ] **Service Boundary**
  - [ ] Confirmed data flow:
    ```
    Frontend → Backend → Python AI (chat)
    Python AI → Backend /v1/ai-tools/* (tool calls)
    ```
  - [ ] `X-Service-Key` header validation
  - [ ] AI service client module in NestJS (HTTP client with timeout/retry)

- [ ] **Tool Endpoints**
  - [ ] List of tools AI can call (search hotels, create booking hold, etc.)
  - [ ] Input/output schemas for each tool
  - [ ] Rate limiting on `/v1/ai-tools/*` (separate from public rate limits)

---

## Phase 8: Operational Readiness

*Production concerns. Design these before launch, not after.*

- [ ] **Observability**
  - [ ] Health check endpoint (`/health`) with DB + Redis probes
  - [ ] Metrics endpoint (Prometheus?)
  - [ ] Error tracking (Sentry integration?)

- [ ] **Data Integrity**
  - [ ] Database backup strategy
  - [ ] Soft-delete policy (global or per-module?)
  - [ ] Audit log table / mechanism

- [ ] **Compliance**
  - [ ] GDPR / data deletion flow
  - [ ] PII handling rules
  - [ ] Data retention limits

- [ ] **Testing Strategy**
  - [ ] Unit test conventions (colocated `*.spec.ts`)
  - [ ] E2E test scope (which flows are critical?)
  - [ ] Database test isolation (transaction rollback per test?)

---

## Decision Log

*Record irreversible decisions here. Date each entry.*

| Date | Decision | Context | Consequences if Reversed |
|------|----------|---------|--------------------------|
| YYYY-MM-DD | Example: Use custom JWTs, not Supabase Auth | Need refresh token rotation + logout-all-devices | Requires rebuilding AuthModule, re-issuing all tokens |
| | | | |
| | | | |

---

## Current Status

**Phase in Progress:** `Phase 0 — Foundation & Constraints`

**Blockers:**
- None recorded yet.

**Next Review Date:**
- YYYY-MM-DD

---

## Quick Links

- [Project Architecture](../architecture/system-overview.md)
- [Feature Decisions](../../product/feature-decisions.md)
- [Backend Implementation Spec](../../.kiro/specs/backend-nestjs-supabase/)
- [Backend Source](../../backend/)
