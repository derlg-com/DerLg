# Foundation & Constraints

> **Phase 0** — Lock these decisions before any module design begins.

---

## Runtime Contract

| Decision | Choice | Rationale |
|----------|--------|-----------|
| NestJS version | v11 | Latest stable; update specs if they reference v10 |
| Node.js target | LTS (v22.x) | Align with NestJS 11 support matrix |
| Deployment target | Docker container | Portable; `Dockerfile` + `docker-compose.yml` at repo root |

---

## Data Layer Architecture

| Concern | Decision | Notes |
|---------|----------|-------|
| ORM | Prisma | Type-safe queries; schema-first migrations |
| Database | Supabase hosted PostgreSQL | Production; Docker `postgres:15-alpine` for local dev |
| Cache / Sessions | Redis | Upstash in production; Docker `redis:7-alpine` for local dev |
| Connection pooling | Supabase pooler + Prisma direct | Document fallback strategy if pooler limits are hit |

**Prisma placement:** `prisma/schema.prisma` at repo root so it is shared by backend and any standalone scripts.

---

## Schema Conventions

| Aspect | Convention | Example |
|--------|------------|---------|
| Model names | PascalCase | `User`, `Booking` |
| Field names | camelCase in Prisma | `createdAt`, `bookingRef` |
| Column names | snake_case in DB | `@map("created_at")` |
| Table names | snake_case plural | `@@map("users")` |
| Enums | PascalCase values | `UserRole { USER ADMIN }` |
| Primary keys | UUID v4 | `@id @default(uuid())` |
| Soft delete | `deletedAt` nullable DateTime | Prefer soft delete globally |
| Currency | `Decimal` with `@db.Decimal(10, 2)` | Avoid floating-point for money |
| JSON fields | `Json?` for flexible metadata | Validate shape at application layer |

### Indexing Strategy

- Every foreign key gets an index automatically (Prisma does not; add `@@index` explicitly)
- Every unique business key gets `@unique`
- Query-heavy fields (status, date ranges) get composite indexes where needed

---

## Core Models

These models are foundational and cross-cut multiple modules. Module-specific models (Trip, HotelRoom, Guide, etc.) are documented in `docs/modules/`.

```prisma
model User {
  id                    String   @id @default(uuid())
  email                 String   @unique
  name                  String
  phone                 String?
  avatarUrl             String?  @map("avatar_url")
  role                  UserRole @default(USER)
  preferredLanguage     Language @default(EN) @map("preferred_language")
  loyaltyPoints         Int      @default(0) @map("loyalty_points")
  isStudent             Boolean  @default(false) @map("is_student")
  studentVerifiedAt     DateTime? @map("student_verified_at")
  tokenVersion          Int      @default(0) @map("token_version")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@index([email])
  @@map("users")
}

enum UserRole {
  USER
  ADMIN
  SUPPORT
}

enum Language {
  EN
  KH
  ZH
}
```

**Full schema:** See `prisma/schema.prisma` and per-module docs in `docs/modules/`.

---

## Auth Ownership Decision

**Chosen approach:** Custom JWTs issued by the backend.

| Aspect | Detail |
|--------|--------|
| Access token | Short-lived (15 min), signed by `JWT_ACCESS_SECRET` |
| Refresh token | Long-lived (7 days), signed by `JWT_REFRESH_SECRET`, stored in `httpOnly` `Secure` `SameSite=Strict` cookie |
| Password hashing | bcrypt via backend (Supabase may be used for OAuth only) |
| Logout | Refresh token revoked in Redis blacklist |
| Revoke all devices | Flush user-specific refresh tokens in Redis |

**Consequences if reversed:** Rebuild `AuthModule`, re-issue all tokens, migrate session state.

---

## Project Bootstrap

| Concern | Decision |
|---------|----------|
| Docker Compose | Repo root (`docker-compose.yml`) — spins up Postgres, Redis, Backend, Frontend |
| Env strategy | Split per service: root `.env` for Docker, `backend/.env` for NestJS, `frontend/.env` for Next.js |
| Required keys in `backend/.env.example` | `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AI_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## Checklist

- [ ] Node.js LTS confirmed in `backend/package.json` `engines`
- [ ] `prisma/schema.prisma` created with base `datasource db`
- [ ] `backend/.env.example` created with all required keys listed
- [ ] `docker-compose.yml` at repo root with Postgres + Redis services
- [ ] Auth ownership decision recorded in [Operations Decision Log](./operations.md)
