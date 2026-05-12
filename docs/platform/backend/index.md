# Backend System Design

> **Audience:** Engineering department  
> **Scope:** High-level architecture for the DerLg NestJS backend. Feature-level business logic lives in `docs/modules/`.  
> **Status:** In progress — Phase 0 (Foundation) & Phase 1 (Infrastructure)

---

## Purpose

This directory contains the canonical system design for the DerLg backend. It defines:

- Runtime constraints and bootstrap contract
- Data layer architecture (Prisma, PostgreSQL, Redis)
- Global HTTP pipeline (routing, validation, error handling)
- Security model (custom JWT auth, RBAC, rate limiting)
- Cross-cutting concerns (logging, request IDs, pagination)
- Async architecture (events, background jobs)
- AI service integration boundary
- Operational readiness (observability, compliance, testing)

---

## How to Use These Docs

1. **Work top-down.** Each doc builds on the previous. Do not skip ahead.
2. **Check boxes only after the design is documented** in code or spec — not just discussed.
3. **Update the Decision Log** in `operations.md` whenever an irreversible choice is made.

---

## Doc Index

| Doc | Concern | Current Phase |
|-----|---------|---------------|
| [Foundation](./foundation.md) | Runtime, data layer, auth ownership, bootstrap, schema conventions | 0 |
| [Infrastructure](./infrastructure.md) | Config, DB access, HTTP pipeline, validation, filters, error architecture, Redis | 1 |
| [Security](./security.md) | Auth strategy, guards, RBAC, rate limiting, CORS, helmet | 1–3 |
| [Shared Kernel](./shared-kernel.md) | Reusable guards, decorators, interceptors, utilities, shared interfaces | 2 |
| [Async Architecture](./async-architecture.md) | Event system, background jobs, notification plumbing | 6 |
| [AI Integration](./ai-integration.md) | Backend ↔ Python AI boundary, tool endpoints | 7 |
| [Operations](./operations.md) | Observability, health, compliance, testing, deployment, decision log | 8 |

---

## Module Structure

```
src/
├── main.ts                    # Application bootstrap (graceful shutdown, global pipes/filters)
├── app.module.ts              # Root module importing all feature & infrastructure modules
│
├── config/                    # Global configuration module
│   ├── config.module.ts
│   └── env.validation.ts      # Joi / zod schema for env vars
│
├── common/                    # Shared kernel (no business logic)
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── types/                 # Shared interfaces (response, pagination)
│
├── auth/                      # Authentication & authorization infrastructure
├── users/                     # User management (profile, avatar, roles)
│
├── prisma/                    # Prisma module (global singleton, lifecycle hooks)
├── redis/                     # Redis module (client wrapper, key helpers)
├── jobs/                      # Background jobs scheduler (NestJS Schedule)
│
├── ai-tools/                  # AI agent integration module
├── notifications/             # Notification delivery plumbing (channels, retry)
│
└── [feature modules]/         # Business logic — see docs/modules/ for specs
    ├── bookings/
    ├── payments/
    ├── trips/
    ├── hotels/
    ├── guides/
    ├── transportation/
    ├── explore/
    ├── festivals/
    ├── emergency/
    ├── student-discount/
    └── loyalty/
```

**Dependency rule:** Feature modules may depend on `common/`, `prisma/`, `redis/`, `auth/`, `users/`, and `notifications/`. They must **not** import each other directly (e.g., `trips` cannot import `bookings`). Orchestration happens at the controller or event level.

---

## Request Flows

### Standard API Request Flow

1. **Request arrives** at NestJS application (`main.ts`)
2. **CORS middleware** validates origin against whitelist
3. **Helmet** applies security headers
4. **JWT Auth Guard** validates access token and extracts user claims (or `@Public()` bypasses)
5. **Rate Limiter** checks Redis for request count per IP / user
6. **Validation Pipe** validates request DTO using `class-validator`
7. **Audit / Logging Interceptor** injects correlation ID and logs request
8. **Controller** receives validated request and calls service
9. **Service** executes business logic and database operations
10. **Response Transform Interceptor** wraps response in standard envelope
11. **Response** sent to client

### AI Tools Request Flow

1. **Request arrives** at `/v1/ai-tools/*`
2. **Service Key Guard** validates `X-Service-Key` header
3. **Validation Pipe** validates tool-specific DTO
4. **AI Tools Controller** delegates to feature services (reuses same services as frontend-facing APIs)
5. **Response Transform Interceptor** wraps response
6. **Response** sent to Python AI agent

---

## Quick Links

- [Project Architecture](../architecture/system-overview.md)
- [Feature Decisions](../../product/feature-decisions.md)
- [Backend Implementation Spec](../../.kiro/specs/backend-nestjs-supabase/)
- [Backend Source](../../backend/)
- [Modules Index](../../modules/README.md)
