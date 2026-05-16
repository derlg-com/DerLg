# Shared Kernel — Requirements

> Scope, decisions, and context for Phase 1 (Track 1): the infrastructure layer all feature modules depend on.

---

## Scope

Implement **all 13 tasks** from Track 1 of `context/plans/IMPLEMENTATION-ROADMAP.md`:

| Task | What | Why |
|------|------|-----|
| 1.1 | `ConfigModule` with Joi validation | Fail-fast env validation at startup per `CONSTITUTION.md` §10.4 |
| 1.2 | `PrismaModule` global singleton | One PrismaClient instance, lifecycle-aware, graceful disconnect |
| 1.3 | `RedisModule` + `RedisService` (ioredis) | Caching, session storage, booking holds, rate-limit backend |
| 1.4 | Global `ValidationPipe` | DTO validation with `class-validator` / `class-transformer` |
| 1.5 | Global exception filters | Prisma error mapping (P2002→409, P2025→404) + catch-all |
| 1.6 | `TransformInterceptor` | `{ success, data }` envelope on every response per `API-CONTRACT.md` §2.1 |
| 1.7 | `LoggingInterceptor` with Pino | Structured request logging, redaction of secrets |
| 1.8 | `JwtAuthGuard` + `RolesGuard` | JWT validation and RBAC enforcement |
| 1.9 | Decorators (`@CurrentUser`, `@Public`, `@Roles`) | Clean controller auth UX |
| 1.10 | Pagination DTO + `ApiResponse<T>` + `PaginatedResponse<T>` | Reusable types for all list endpoints |
| 1.11 | `ErrorCodes` registry — full const object | All ~100 codes from `ERROR-REGISTRY.md`, domain-prefixed |
| 1.12 | Throttler setup — Redis store | Rate limiting per `CONSTITUTION.md` §4.3 |
| 1.13 | Helmet + CORS configuration | Security headers and origin whitelist |

---

## Decisions

1. **All error codes upfront** — The `ErrorCodes` const object includes all ~100 codes from `ERROR-REGISTRY.md` now, even domain-specific ones (BKNG_*, PAY_*, etc.). This prevents future PRs from touching the shared registry and avoids merge conflicts. Implemented as a tree-shakeable const object per `CODE-STANDARD.md` §2.3, not a TS enum.
2. **Dependencies installed in this branch** — New packages (Pino, passport-jwt, @nestjs/throttler, helmet, joi) are installed as part of implementation, not a separate PR. See `TECH-STACK.md` for exact versions.
3. **Parallel implementation** — Tasks are grouped into work streams that can run in parallel via subagents:
   - **Stream A:** Config + Prisma + Redis (infra modules)
   - **Stream B:** Pipes + Filters + Interceptors (request/response pipeline)
   - **Stream C:** Auth guards + Decorators + Throttler (security layer)
   - **Stream D:** Types + ErrorCodes (static contracts)
4. **No feature modules yet** — This branch only creates shared infrastructure (`src/common/`, `src/config/`, `src/prisma/`, `src/redis/`). No controllers or services for trips, bookings, guides, hotels, etc.

---

## Context

### Why this matters
The shared kernel is the **foundation every feature module depends on**. Without it, developers cannot create a new module following existing patterns. M1 is "any developer can create a new module following existing patterns."

### Module dependency rules (from `CONSTITUTION.md` §1.2)
- `CommonModule` exports: guards, interceptors, filters, decorators, pipes
- `PrismaModule` exports: `PrismaService`
- `RedisModule` exports: `RedisService`
- Feature modules **must not** import each other directly

### Key specs referenced
- `context/guides/MISSION.md` §Target State — why the backend exists
- `context/guides/CONSTITUTION.md` — module structure, API envelope, auth strategy, naming
- `context/guides/TECH-STACK.md` — exact package versions, env vars, Docker images
- `context/guides/CODE-STANDARD.md` — formatting, TypeScript patterns, NestJS patterns, DTO rules
- `context/specs/API-CONTRACT.md` §Global Types — response envelope and pagination shapes
- `context/specs/ERROR-REGISTRY.md` — all error codes
- `context/plans/TEST-PLAN.md` §2 — coverage gates

---

## Out of Scope

- Database schema changes (migrations, seeds) — Track 2
- Auth endpoints (register, login, etc.) — Track 2B
- Swagger/OpenAPI docs — Phase 13 (but decorators ready for it)
- E2E tests for auth flows — Track 2B
- CI/CD pipeline — Phase 0 (deferred)
