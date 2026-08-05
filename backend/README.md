# DerLg Backend

NestJS 11 API for the DerLg Cambodia travel booking platform. Exposes REST endpoints under `/v1/` for the web frontend and `/v1/ai-tools/*` for the AI agent service.

## Stack

NestJS 11 · Prisma 6 · TypeScript 5.7 · Jest 30 · class-validator · Passport JWT · pino

## Modules

```
src/modules/
  ai-tools    # /v1/ai-tools/* endpoints for the AI agent (X-Service-Key auth)
  auth        # JWT access + refresh, Telegram OAuth
  bookings    # Booking creation, confirmation, cancellation, holds
  guides      # Tour guide catalogue (languages, specialties, trip packages)
  hotels      # Hotel catalogue (types, rooms, star ratings)
  places      # Points of interest (categories, regions)
  prisma      # Prisma service + client
  redis       # Redis connection, cache, rate limiting
  search      # Global search across trips/places/hotels/guides
  transportation # Vehicle catalogue (tiers, subtypes, availability)
  trips       # Trip packages (categories, custom trips, itineraries)
  users       # User profiles, loyalty points
```

Cross-cutting code: `src/common/` (guards, interceptors, filters, decorators, DTOs, errors, cache, i18n, types).

## Getting started

```bash
cd backend
npm install
cp .env.example .env          # then edit secrets (JWT_ACCESS_SECRET, AI_SERVICE_KEY, etc.)
npx prisma migrate deploy     # apply migrations (use db push if migrate dev fails)
npm run prisma:seed           # seed the catalogue
npm run start:dev              # http://localhost:3003/v1
```

> Dev runs on port **4007** via `PORT=4007 npm run start:dev` to avoid clashes with the configured 3003.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres URL. Dev: local Supabase on `localhost:54322`. VPS: Coolify-managed Postgres. |
| `DIRECT_URL` | yes | Direct connection for migrations |
| `JWT_ACCESS_SECRET` | yes | ≥32 chars |
| `JWT_REFRESH_SECRET` | yes | ≥32 chars |
| `AI_SERVICE_KEY` | yes | ≥32 chars. Must match `vibe-booking/.env` and `web/.env.local` |
| `REDIS_URL` | yes | `redis://localhost:6379/0` |
| `MINIO_ACCESS_KEY` | yes | MinIO credentials |
| `MINIO_SECRET_KEY` | yes | MinIO credentials |
| `STRIPE_SECRET_KEY` | no | Empty → payments return 503 |

## Database

Dev uses a **local Supabase** instance (port 54322). For VPS deployment via Coolify, point `DATABASE_URL` at the Coolify-managed Postgres — the app works with any standard PostgreSQL, no Supabase dependency required.

The DB has pre-existing drift from earlier `db push` operations. Use `npx prisma migrate deploy` or `npx prisma db push` rather than `migrate dev`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Hot-reload dev server |
| `npm run build` | Compile TS → dist/ |
| `npm run test` / `npm run test:e2e` | Jest unit / E2E |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npm run prisma:seed` | Seed the catalogue |

## API conventions

- Prefix: `/v1/` (user-facing), `/v1/ai-tools/*` (AI agent, X-Service-Key auth)
- Envelope: `{ success, data, message, error }`
- Auth: Bearer JWT in `Authorization` header
- `forbidNonWhitelisted: true` — every query param must be declared in the DTO or requests return 400
