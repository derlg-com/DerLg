# DerLg Backend Tech Stack

> Exact versions, purposes, and key configuration decisions. This is the canonical reference for what runs on port 3001.

---

## Runtime & Framework

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| Node.js | 22.x LTS | Runtime | `NODE_ENV=production` in prod |
| @nestjs/core | 11.x | HTTP framework, DI, modules | `GlobalPipes`, `GlobalFilters`, `GlobalInterceptors` in `main.ts` |
| @nestjs/platform-express | 11.x | HTTP adapter | Default, no custom config needed |
| @nestjs/common | 11.x | Decorators, utilities | — |
| @nestjs/config | 11.x | Env var loading | `isGlobal: true`, validation schema at startup |
| @nestjs/swagger | 11.x | OpenAPI docs | Auto-generated from decorators, served at `/api/docs` |

---

## Language & TypeScript

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| typescript | 5.7.3 | Language | `strictNullChecks: true`, `noImplicitAny: false`, `strictBindCallApply: false` |
| ts-node | 10.x | Dev execution | `transpileOnly: true` for speed |
| ts-jest | 30.x | Test compilation | `isolatedModules: true` |

**TypeScript config highlights:**
- `moduleResolution: nodenext`
- `emitDecoratorMetadata: true` (required for `class-transformer`)
- `esModuleInterop: true`
- `skipLibCheck: true`

---

## Database

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| prisma | 6.x | Schema, migrations, client generation | `previewFeatures: []` (stable only) |
| @prisma/client | 6.x | Type-safe DB client | Generated from schema, singleton in `PrismaModule` |

**Database:** PostgreSQL 15 (Supabase in production, Docker `postgres:15-alpine` locally)

**Connection:**
- Production: Supabase connection pooler + Prisma direct connection for migrations
- Pool size: 5 (serverless), 20 (containerized)
- URL format: `postgresql://user:pass@host:6543/db?pgbouncer=true&connection_limit=5`

---

## Validation & Serialization

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| class-validator | 0.14.x | DTO validation | `whitelist: true`, `forbidNonWhitelisted: true` in `ValidationPipe` |
| class-transformer | 0.5.x | Object transformation | `transform: true` in `ValidationPipe` |

**Validation pipe (global):**
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

---

## Authentication

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| @nestjs/jwt | 11.x | JWT signing/verification | `secret` from env, `expiresIn: 15m` |
| @nestjs/passport | 11.x | Auth guard framework | — |
| passport | 0.7.x | Auth strategies | — |
| passport-jwt | 4.x | JWT strategy | Extract from `Authorization: Bearer` header |
| bcrypt | 5.x | Password hashing | Cost factor: 12 |

**Token config:**
- Access token: 15 minutes, `JWT_ACCESS_SECRET`
- Refresh token: 7 days, `JWT_REFRESH_SECRET`, stored in Redis

---

## Caching & Session

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| ioredis | 5.x | Redis client | `enableReadyCheck: true`, `maxRetriesPerRequest: 3` |
| @nestjs/throttler | 6.x | Rate limiting | Store in Redis, default: 10 req / 60s / IP |

**Redis:** Upstash in production, Docker `redis:7-alpine` locally

---

## Payments

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| stripe | 17.x | Payment processing | `apiVersion: '2025-03-31.basil'` |

**Stripe features:**
- Payment intents for card payments
- Webhook signature verification with `STRIPE_WEBHOOK_SECRET`
- QR code generation for Bakong/ABA (via Stripe or custom)

---

## Background Jobs & Events

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| @nestjs/schedule | 5.x | Cron/interval decorators | `CronExpression.EVERY_5_MINUTES` for cleanup |
| @nestjs/event-emitter | 3.x | Intra-process events | — |

---

## Observability

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| pino | 9.x | Structured logging | `level: info` in prod, `debug` in dev |
| pino-http | 10.x | HTTP request logging | `redact: ['req.headers.authorization', 'req.body.password']` |
| nestjs-pino | 4.x | NestJS Pino integration | Auto-injected logger |

**Log redaction:** `password`, `token`, `authorization`, `card`, `cvv`, `secret`

---

## Testing

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| jest | 30.x | Test runner | `rootDir: src`, `testRegex: .*\.spec\.ts$` |
| @nestjs/testing | 11.x | Test utilities | `Test.createTestingModule()` |
| supertest | 7.x | HTTP assertions | — |
| fast-check | 3.x | Property-based testing | — |

**Coverage gates:**
- Unit: 80% line coverage minimum
- Critical paths: 90% minimum
- E2E: auth flow, booking creation, payment, cancellation

---

## Security

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| helmet | 8.x | HTTP security headers | `contentSecurityPolicy: false` (API only) |
| @nestjs/throttler | 6.x | Rate limiting | Redis store, auth: 5/5min, payments: 3/min |
| cors | 2.x | CORS handling | Whitelist array from env |

---

## Development & Build

| Package | Version | Purpose | Key Config |
|---------|---------|---------|------------|
| eslint | 9.x | Linting | `@typescript-eslint/no-explicit-any: off` |
| @typescript-eslint/* | 8.x | TypeScript rules | `recommended-type-checked` |
| prettier | 3.x | Formatting | `singleQuote: true`, `trailingComma: all` |
| nodemon | 3.x | Dev auto-restart | `watch: src`, `ext: ts` |
| @nestjs/cli | 11.x | Code generation | — |

---

## Environment Variables

Required at runtime (validated at startup):

```
# Database
DATABASE_URL              # Prisma connection string
DIRECT_URL                # Direct connection for migrations

# Auth
JWT_ACCESS_SECRET         # Access token signing key
JWT_REFRESH_SECRET        # Refresh token signing key

# Redis
REDIS_URL                 # Redis connection string

# Stripe
STRIPE_SECRET_KEY         # Stripe API key
STRIPE_WEBHOOK_SECRET     # Webhook signature secret

# AI Service
AI_SERVICE_KEY            # Shared secret for AI tool endpoints

# App
PORT                      # Server port (default: 3001)
NODE_ENV                  # development | production | test
CORS_ORIGINS              # Comma-separated allowed origins
```

---

## Docker

| Image | Version | Purpose |
|-------|---------|---------|
| node | 22-alpine | Backend runtime |
| postgres | 15-alpine | Local database |
| redis | 7-alpine | Local cache |

**Multi-stage Dockerfile:**
1. `deps` — install dependencies
2. `build` — compile TypeScript
3. `production` — copy `dist/` + `node_modules`, run `node dist/main`

---

## External Services

| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| Supabase PostgreSQL | Primary database | Prisma |
| Upstash Redis | Cache, sessions, rate limits | ioredis |
| Stripe | Card payments, QR payments | stripe SDK |
| Resend | Transactional email | HTTP API (background) |
| FCM | Push notifications | HTTP API (background) |
| ExchangeRate-API | Currency conversion | HTTP API (cached) |

---

## Planned (Not Yet Installed)

| Package | Purpose | When |
|---------|---------|------|
| @nestjs/websockets | WebSocket gateway for AI chat | Phase 7 |
| @nestjs/platform-ws | WebSocket adapter | Phase 7 |
| @nestjs/mapped-types | DTO partial types | As needed |
| @nestjs/swagger | Already listed, but will add response examples | Phase 1 |

---

## Version Pinning Policy

- **Runtime dependencies:** pinned to minor version (`^11.0.0` → accept patches only after testing)
- **Dev dependencies:** pinned to major version (`^30.0.0`)
- **Security updates:** apply within 48 hours of CVE disclosure
- **Feature updates:** evaluate quarterly, never auto-update in production

---

## References

- Full requirements: `.kiro/specs/backend-nestjs-supabase/requirements.md`
- Design details: `.kiro/specs/backend-nestjs-supabase/design.md`
- Backend foundation: `docs/platform/backend/foundation.md`
- Backend infrastructure: `docs/platform/backend/infrastructure.md`
