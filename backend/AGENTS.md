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
| `admin` | `/v1/admin/*` admin panel API — 18 controllers, 18 services. Includes trip-package CRUD (`admin-trips.*`) and customer status/role management | `admin.module.ts`, `controllers/`, `services/`, `interceptors/audit.interceptor.ts`, `websocket/admin.gateway.ts` |
| `ai-tools` | `/v1/ai-tools/*` endpoints for the AI agent, including the chat-transcript archive (`chat-sessions*`) | `ai-tools.controller.ts`, `ai-tools.service.ts`, `ai-tools.dto.ts` |
| `auth` | JWT access + refresh, Telegram OAuth | `auth.controller.ts`, `auth.service.ts` |
| `bookings` | Booking creation, confirmation, cancellation, holds | `bookings.controller.ts`, `use-cases/`, `dto/` |
| `guides` | Tour guide catalogue | `guides.controller.ts`, `list-guides.use-case.ts`, `utils/` |
| `hotels` | Hotel catalogue (types, rooms, star ratings) | `hotels.controller.ts`, `list-hotels.use-case.ts`, `dto/` |
| `places` | Points of interest | `places.controller.ts`, `list-places.use-case.ts` |
| `prisma` | Prisma service + client | `prisma.service.ts` |
| `redis` | Redis connection, cache, rate limiting | `redis.service.ts` |
| `search` | Global search across all catalogues | `search.controller.ts`, `global-search.use-case.ts` |
| `storage` | MinIO presigned URLs for admin media | `minio.service.ts`, `storage.controller.ts` |
| `telegram` | `/v1/telegram/*` driver bot: webhook, commands, BullMQ queues | `telegram.controller.ts`, `telegram.service.ts`, `handlers/`, `jobs/` |
| `transportation` | Vehicle catalogue | `transportation.controller.ts`, `list-vehicles.use-case.ts` |
| `trips` | Trip packages (incl. custom trips). Public read-only; admin CRUD lives in `admin` | `trips.controller.ts`, `list-trips.use-case.ts` |
| `users` | User profiles, loyalty points | `users.controller.ts`, `users.service.ts` |

Cross-cutting code lives in `src/common/`:

| Directory | Purpose |
|-----------|---------|
| `guards/` | JWT guard, roles guard, admin-role guard, service-key guard, throttler guard |
| `interceptors/` | Logging interceptor |
| `filters/` | Prisma filter, all-exceptions filter |
| `decorators/` | Public, current-user, roles, admin-roles, current-admin |
| `dto/` | List query DTO, base DTOs |
| `errors/` | Error codes, custom exceptions |
| `cache/` | Cached service base, cache keys |
| `i18n/` | Language types, translation helpers |
| `types/` | Paginated response type |

---

## API Conventions

- Prefix: `/v1/` (user-facing), `/v1/ai-tools/*` (AI agent, X-Service-Key auth), `/v1/admin/*` (admin panel, JWT + admin role), `/v1/telegram/*` (driver bot, webhook secret / PIN)
- **Do not write `v1/` inside `@Controller()`** — `main.ts` calls `setGlobalPrefix('v1')`. Doing both gives `/v1/v1/...`, which silently 404s.
- Envelope: `{ success, data, message, error }`
- Auth: Bearer JWT in `Authorization` header; service-to-service via `X-Service-Key`
- `forbidNonWhitelisted: true` — every new query param **must** be declared in the DTO or requests return 400
- Naming: NestJS controllers `feature.controller.ts`, services `feature.service.ts`, DTOs `feature.dto.ts`

---

## Database

- Schema: `prisma/schema.prisma`
- Dev: local Supabase on port 54322
- VPS (Coolify): point `DATABASE_URL` at Coolify-managed Postgres
- Migrations: write the SQL by hand, then `npx prisma migrate deploy`.
  Generate a candidate with:
  `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  and review it before applying. Prefer `migrate deploy` over `migrate dev`.
- Seed: `npm run prisma:seed` (idempotent, dependency-ordered)

---

## Dev Gotchas

- **NVIDIA_API_KEY shadowing** (affects AI agent, not backend directly): unset before launching the agent
- **DB drift**: as of the admin-panel merge (2026-08-19) there is **none** — replaying all migrations into a shadow database produced SQL byte-identical to a diff against the live database. The earlier warning here predates `20260805090000_baseline_sync`, which fixed it. Still prefer `migrate deploy` and reviewed SQL.
- **Guards are global**: `JwtAuthGuard`, `RolesGuard` and `AdminRoleGuard` are registered as `APP_GUARD` in `common.module.ts`. Do not add `@UseGuards(JwtAuthGuard)` to controllers. Use `@Public()` to opt out, `@Roles()` for the JWT claim, `@AdminRoles()` for the `admin_users` grant. **A route with no `@AdminRoles()` is not admin-protected** — the guard passes it through.
- **Compiled entrypoint is `dist/src/main.js`**, not `dist/main.js`, because `debug_e2e.ts` at the project root shifts the TypeScript rootDir. `package.json`'s `start:prod` script still has the old path and fails with MODULE_NOT_FOUND.
- **forbidNonWhitelisted**: every new query param must be in the DTO
- **`@CurrentUser('sub')` returns a claim, not the payload.** The decorator honours
  its argument; passing none yields the whole `JwtPayload`. It used to ignore the
  argument entirely, so all 41 call sites silently received an object where a
  string was annotated — which made every explicit `createAuditLog` fail Prisma
  validation inside a swallowing try/catch.
- **Refresh tokens live only in Redis** at `session:{userId}:{tokenId}`. The
  `refresh_tokens` table is never written to, so `refreshToken.updateMany` matches
  nothing. To revoke a session you must delete the Redis keys — see
  `RedisService.delByPattern`.
- **Paginated admin handlers must return the service result directly** so
  `TransformInterceptor` wraps it as `{ success, data: { data, meta } }`. Building
  an envelope by hand puts `meta` outside `data`, and the admin panel's axios
  interceptor (which replaces the body with `body.data`) then drops pagination.
- **`SEED_ADMIN_PASSWORD` is often present-but-empty.** Use a length check, not
  `??`, when falling back to the dev default — an empty string is not nullish.

---

## External References

| File | Purpose |
|------|---------|
| `RAYU.md` | RAYU project-wide conventions |
| `AGENTS.md` | Agent routing (root level) |
| `CLAUDE.md` | Claude Code project-wide conventions |
| `docs/admin-merge/` | Admin-panel merge: baseline, port inventory, deliberate behaviour changes |
