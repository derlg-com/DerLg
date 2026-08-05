# DerLg Backend — Agent Context Index

> This file lives in the backend root to keep agent context **local to this directory**. When working on backend code, read the files listed here first.

---

## Quick Start

When starting work on the backend, read these files **in this order**:

1. `src/app.module.ts` — module dependency graph and imports
2. `prisma/schema.prisma` — database schema (Prisma)
3. `src/common/` — cross-cutting code (guards, interceptors, filters, errors, cache, i18n)
4. The relevant module under `src/modules/<name>/`

Then read the relevant domain specs for the task at hand.

---

## Module Index

All implementation is under `src/modules/`:

| Module | Purpose | Key Files |
|--------|---------|-----------|
| `ai-tools` | `/v1/ai-tools/*` endpoints for the AI agent | `ai-tools.controller.ts`, `ai-tools.service.ts`, `ai-tools.dto.ts` |
| `auth` | JWT access + refresh, Telegram OAuth | `auth.controller.ts`, `auth.service.ts` |
| `bookings` | Booking creation, confirmation, cancellation, holds | `bookings.controller.ts`, `use-cases/`, `dto/` |
| `guides` | Tour guide catalogue | `guides.controller.ts`, `list-guides.use-case.ts`, `utils/` |
| `hotels` | Hotel catalogue (types, rooms, star ratings) | `hotels.controller.ts`, `list-hotels.use-case.ts`, `dto/` |
| `places` | Points of interest | `places.controller.ts`, `list-places.use-case.ts` |
| `prisma` | Prisma service + client | `prisma.service.ts` |
| `redis` | Redis connection, cache, rate limiting | `redis.service.ts` |
| `search` | Global search across all catalogues | `search.controller.ts`, `global-search.use-case.ts` |
| `transportation` | Vehicle catalogue | `transportation.controller.ts`, `list-vehicles.use-case.ts` |
| `trips` | Trip packages (incl. custom trips) | `trips.controller.ts`, `list-trips.use-case.ts` |
| `users` | User profiles, loyalty points | `users.controller.ts`, `users.service.ts` |

Cross-cutting code lives in `src/common/`:

| Directory | Purpose |
|-----------|---------|
| `guards/` | JWT guard, service-key guard, current-user guard |
| `interceptors/` | Logging interceptor |
| `filters/` | Prisma filter, all-exceptions filter |
| `decorators/` | Public decorator, current-user decorator |
| `dto/` | List query DTO, base DTOs |
| `errors/` | Error codes, custom exceptions |
| `cache/` | Cached service base, cache keys |
| `i18n/` | Language types, translation helpers |
| `types/` | Paginated response type |

---

## API Conventions

- Prefix: `/v1/` (user-facing), `/v1/ai-tools/*` (AI agent, X-Service-Key auth)
- Envelope: `{ success, data, message, error }`
- Auth: Bearer JWT in `Authorization` header; service-to-service via `X-Service-Key`
- `forbidNonWhitelisted: true` — every new query param **must** be declared in the DTO or requests return 400
- Naming: NestJS controllers `feature.controller.ts`, services `feature.service.ts`, DTOs `feature.dto.ts`

---

## Database

- Schema: `prisma/schema.prisma`
- Dev: local Supabase on port 54322
- VPS (Coolify): point `DATABASE_URL` at Coolify-managed Postgres
- Migrations: `npx prisma migrate deploy` (use `db push` if `migrate dev` fails — DB has pre-existing drift)
- Seed: `npm run prisma:seed` (idempotent, dependency-ordered)

---

## Dev Gotchas

- **NVIDIA_API_KEY shadowing** (affects AI agent, not backend directly): unset before launching the agent
- **Pre-existing DB drift**: `prisma migrate dev` won't work cleanly; use `migrate deploy` or `db push`
- **forbidNonWhitelisted**: every new query param must be in the DTO

---

## External References

| File | Purpose |
|------|---------|
| `RAYU.md` | RAYU project-wide conventions |
| `AGENTS.md` | Agent routing (root level) |
| `CLAUDE.md` | Claude Code project-wide conventions |
