# DerLg Backend

NestJS 11 API for the DerLg Cambodia travel booking platform. **One server, four API surfaces**:

| Surface | Prefix | Auth | Consumer |
|---------|--------|------|----------|
| Public | `/v1/*` | Bearer JWT (guest routes are `@Public()`) | Web customer site |
| AI tools | `/v1/ai-tools/*` | `X-Service-Key` header | Vibe Booking agent, web BFF |
| Admin | `/v1/admin/*` | JWT + `admin_users` role grant | Admin panel |
| Telegram | `/v1/telegram/*` | Webhook secret / driver PIN | Driver bot |

> Part of the [DerLg monorepo](../README.md). Dev port **4007** via `run-all.sh` (`backend/.env` sets 3003; code fallback 3001).

---

## Contents

- [Stack](#stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Module index](#module-index)
- [API conventions](#api-conventions)
- [Authentication and guards](#authentication-and-guards)
- [Database and migrations](#database-and-migrations)
- [Payments](#payments)
- [Scripts](#scripts)
- [Testing](#testing)
- [Dev gotchas](#dev-gotchas)
- [Further reading](#further-reading)

---

## Stack

NestJS 11 · Prisma 6 · TypeScript 5.7 · PostgreSQL 16 · Redis · MinIO · BullMQ · Socket.io · Stripe · GramJS (Telegram MTProto) · class-validator · Passport JWT · Jest 30 · pino

## Getting started

```bash
cd backend
npm install
cp .env.example .env            # annotated; fill in secrets (see below)

# Infrastructure — pick ONE:
docker compose up -d            # Option A (fallback/CI): Postgres :5433, Redis :6380
#                               # Option B (primary dev): native Postgres :5434 + Redis :6380 via systemd

npx prisma migrate deploy       # apply migrations — never `migrate dev`
npm run prisma:seed             # catalogue, admin accounts, fleet + booking fixtures
PORT=4007 npm run start:dev     # http://localhost:4007/v1
```

Verify: `curl http://localhost:4007/v1/health` → `{"success":true,...}`

The simplest path is `./run-all.sh backend` from the repo root, which sets `PORT`, `CORS_ORIGINS`, and `DISABLE_THROTTLER` for you.

**Production:** `npm run build && npm run start:prod`. The compiled entrypoint is `dist/src/main.js` (not `dist/main.js`) because a root-level `debug_e2e.ts` shifts TypeScript's rootDir; `start:prod` already accounts for this.

## Environment variables

`src/config/` validates every variable with **Zod at boot** and exits rather than run half-configured. The error names the offending key. Full annotated reference: [`.env.example`](.env.example).

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` / `DIRECT_URL` | yes | Postgres. Native dev `:5434`, Docker fallback `:5433`, Coolify-managed in prod. **No Supabase anywhere.** |
| `REDIS_URL` | yes | `redis://localhost:6380/0`. Must be the **same instance** as the AI agent's |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | yes | ≥32 chars. Access secret must match web's `JWT_ACCESS_SECRET` and agent's `JWT_SECRET` |
| `AI_SERVICE_KEY` | yes | ≥32 chars, high entropy. Must match `vibe-booking/.env` and `web/.env.local` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | yes | MinIO credentials (media storage, `:9000`) |
| `CORS_ORIGINS` | yes | Comma-separated allowlist; include web (`:4008`) and admin (`:4010`) dev origins |
| `TRUST_PROXY_HOPS` | yes | Reverse-proxy hop count for rate-limit IP keying. `0` direct, `1` behind nginx/Coolify. Never overstate |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | no | Empty → card payments 503. See [docs/payments.md](docs/payments.md) |
| `ABA_STATIC_QR`, `ABA_TELEGRAM_GROUP_ID`, `ABA_ALERT_SENDER_IDS` | no | ABA KHQR payments. **Set the sender allowlist** or anyone in the group can fake a settlement |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` / `TELEGRAM_SESSION` | no | MTProto userbot reading ABA credit alerts (`npm run telegram:login`). Session string is a full credential |
| `TELEGRAM_BOT_ENABLED` / `TELEGRAM_BOT_TOKEN` / … | no | Driver bot, off by default so the API boots without a token |
| `DEMO_PAYMENTS` | no | `true` lets `POST /v1/bookings/:id/confirm` mark paid without a charge. **Demos only, never production** |
| `SEED_ADMIN_PASSWORD` | prod only | Seed aborts in production without it; dev falls back to a documented default |
| `BOOKING_HOLD_TTL_SECONDS` | no | Hold TTL, default 900 (15 min) |

## Module index

All feature code lives in `src/modules/` (16 modules):

| Module | Purpose |
|--------|---------|
| `admin` | `/v1/admin/*` — 19 controllers, 20 services: dashboard, bookings, trips CRUD, customers, payments ledger + ABA exception queue, fleet, audit log, Socket.io gateway (`websocket/admin.gateway.ts`) |
| `ai-tools` | `/v1/ai-tools/*` for the agent: search, availability, booking holds, payments/QR, budget, weather, SOS, loyalty, custom trips, chat-transcript archive |
| `auth` | JWT access (15 min) + refresh, Telegram OAuth, Google OAuth |
| `bookings` | Booking creation, confirmation, cancellation, 15-minute Redis holds (`use-cases/`) |
| `guides` | Tour guide catalogue (languages, specialties, trip packages) |
| `hotels` | Hotel catalogue (types, rooms, star ratings) |
| `payments` | Stripe cards + ABA dynamic KHQR, webhook settlement, Telegram userbot listener, tiered refunds → [docs/payments.md](docs/payments.md) |
| `places` | Points of interest (categories, regions) |
| `prisma` | Prisma service + client lifecycle |
| `redis` | Connection, cache, rate limiting, `delByPattern` |
| `search` | Global search across trips/places/hotels/guides |
| `storage` | MinIO presigned URLs for admin media |
| `telegram` | `/v1/telegram/*` driver bot: webhook, command handlers, BullMQ jobs |
| `transportation` | Vehicle catalogue (tiers, subtypes, availability) |
| `trips` | Trip packages incl. custom trips. Public read-only; admin CRUD lives in `admin` |
| `users` | Profiles, loyalty points |

Cross-cutting code in `src/common/`: global guards, `TransformInterceptor` (response envelope), exception filters (Prisma + all-exceptions), decorators (`@Public`, `@CurrentUser`, `@Roles`, `@AdminRoles`, `@RateLimit`), cache base, i18n helpers, throttler.

## API conventions

- **Prefix**: `main.ts` calls `setGlobalPrefix('v1')`. **Never write `v1/` inside `@Controller()`** — doing both yields `/v1/v1/...`, which silently 404s.
- **Envelope**: every success response is wrapped by `TransformInterceptor` as `{ success, data, message, error }`. Paginated handlers must return the service result **directly** so it wraps as `{ success, data: { data, meta } }`; hand-built envelopes drop pagination in the admin client.
- **Validation**: `forbidNonWhitelisted: true` — every new query param **must** be declared in the DTO or requests return 400.
- **Naming**: `feature.controller.ts`, `feature.service.ts`, `feature.dto.ts`.
- **i18n**: honour `Accept-Language` (`en-US`, `zh-CN`, `km-KH`, quality-weighted).

## Authentication and guards

Guards are **global** (`APP_GUARD` in `common.module.ts`): `CustomThrottlerGuard` (first), `JwtAuthGuard`, `RolesGuard`, `AdminRoleGuard`.

- Do **not** add `@UseGuards(JwtAuthGuard)` to controllers. Use `@Public()` to opt out.
- `@Roles()` checks the JWT claim; `@AdminRoles()` checks the `admin_users` grant. **An admin route without `@AdminRoles()` is not admin-protected** — the guard passes it through.
- Access tokens last 15 minutes. **Refresh tokens live only in Redis** at `session:{userId}:{tokenId}`; the `refresh_tokens` table is never written. Revoke sessions via `RedisService.delByPattern`.
- Rate limiting: one throttler only; per-route limits via `@RateLimit('AUTH' | 'PAYMENT' | ...)`. The guard bypasses itself under Jest unless `THROTTLE_IN_TESTS=true`.

## Database and migrations

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma). Dev data lives in DerLg's own Postgres — native `:5434` (check `pg_lsclusters`) or Docker `:5433`.
- **Migration workflow**: edit the schema, generate a candidate, review it, commit the SQL, deploy:

  ```bash
  npx prisma migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma --script
  # review, save under prisma/migrations/<timestamp>_<name>/migration.sql
  npx prisma migrate deploy
  ```

  Prefer `migrate deploy` over `migrate dev`. As of the admin merge (`20260805090000_baseline_sync`) there is **no drift**: replaying all migrations reproduces the live database byte-identically.
- Seed: `npm run prisma:seed` — idempotent, dependency-ordered (`prisma/seeds/01…15`), covers reference data, catalogue, admin accounts, drivers/vehicles, booking fixtures, and MinIO imagery helpers.

## Payments

Two providers, two confirmation models — full setup and internals in **[docs/payments.md](docs/payments.md)**:

| | Stripe (card) | ABA (KHQR) |
|---|---|---|
| Confirmed by | Signed Stripe webhook | Telegram credit alert from an allowlisted sender |
| Refunds | Automatic via API | Manual payout queued for an operator |
| Unconfigured | 503 | 400 |

The one rule: **the browser never decides a payment succeeded.** Only `PaymentsService.settle()` writes `status: confirmed`, fed exclusively by the webhook or the ABA listener. `rawBody: true` in `main.ts` is load-bearing for webhook signature verification.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Hot-reload dev server (`nest start --watch`) |
| `npm run build` / `npm run start:prod` | Compile → `dist/` · run `node dist/src/main` |
| `npm test` / `npm run test:e2e` / `npm run test:cov` | Jest unit / e2e / coverage |
| `npm run lint` / `npm run format` | ESLint (fix) / Prettier |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npm run prisma:seed` | Seed everything (idempotent) |
| `npm run prisma:studio` | Browse the database |
| `npm run telegram:login` | One-time GramJS session for the ABA userbot |

## Testing

```bash
npm test               # unit
npm run test:e2e       # e2e (test/jest-e2e.json)
npm run test:cov       # coverage
```

The throttler auto-disables under Jest (`JEST_WORKER_ID`); set `THROTTLE_IN_TESTS=true` to exercise rate limits.

## Dev gotchas

The full list lives in [AGENTS.md](AGENTS.md#dev-gotchas). The ones that bite hardest:

- `dist/src/main.js` is the entrypoint, not `dist/main.js`.
- `rawBody: true` — remove it and every Stripe webhook 400s.
- BigInt columns (`drivers.telegram_id`) need the JSON replacer in `main.ts`.
- `@CurrentUser('sub')` returns a claim, not the payload; pass the argument.
- `SEED_ADMIN_PASSWORD` is often present-but-empty — use a length check, not `??`.
- ABA settlement is out-of-band and an ambiguous amount match deliberately settles **nothing**.

## Further reading

| Document | Contents |
|----------|----------|
| [AGENTS.md](AGENTS.md) | Agent context index: reading order, module key files, full gotcha list |
| [docs/payments.md](docs/payments.md) | Stripe + ABA setup, settlement, refunds, test cards |
| [docs/admin-merge/](docs/admin-merge/) | Admin-panel merge baseline and port inventory |
| [../README.md](../README.md) | Monorepo overview and cross-service setup |
| [../derlg-system-admin/START.md](../derlg-system-admin/START.md) | Admin panel health checks against this API |