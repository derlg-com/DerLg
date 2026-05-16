# Phase 0: Bootstrap & Tooling — Requirements

> Why this phase exists, what decisions have been made, and what context shapes the implementation.

---

## Scope

This branch delivers the foundational tooling and local development environment for the DerLg backend. It covers **Tasks 0.1 through 0.5** from `IMPLEMENTATION-ROADMAP.md`.

**In scope:**
- TypeScript strictness and module resolution alignment
- ESLint + Prettier rule enforcement
- Docker Compose for Redis 8.6 (dev) and PostgreSQL 15 + Redis 8.6 (prod)
- Multi-stage `Dockerfile` (deps, build, production, development targets)
- `.env.example` documenting every required environment variable with Supabase/Docker dual setup
- Health check endpoint on port 3001

**Out of scope (deferred):**
- GitHub Actions CI pipeline (Task 0.6) — user will implement later in a separate branch
- Seed data or Prisma migration execution (Phase 2)

---

## Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| Keep existing NestJS boilerplate, add missing pieces only | The scaffold is already NestJS 11 and functional; re-scaffolding would be churn with no benefit. | User preference |
| Defer GitHub Actions CI to a follow-up branch | User wants to implement CI separately after the local foundation is solid. | User preference |
| Place feature spec under `backend/context/` | Keeps all backend context (guides, specs, plans) in one discoverable location per `AGENTS.md`. | User preference |
| **Supabase for development, Docker for production** | Team uses Supabase cloud PG in dev for managed backups/branching; Docker in prod for cost/control. | Team decision |
| **PostgreSQL 15 in Docker** (not 17/18) | Supabase runs PostgreSQL 15. Matching dev/prod versions eliminates compatibility risk. | Version alignment |
| **Redis 8.6** (upgraded from 7) | Redis 8.0 reached EOL Feb 2026. 8.6 is current stable with built-in modules (Search, JSON, TimeSeries). | Security + features |
| **No Postgres in dev docker-compose.yml** | Dev uses Supabase cloud; local Postgres would conflict and be redundant. | Architecture |
| **Multi-stage Dockerfile** | Provides both `development` (hot-reload) and `production` (minimal) targets in one file. | Best practice |

---

## Context

### Current State (Baseline)
- NestJS 11 scaffold exists under `backend/src/` — default boilerplate from `nest new`.
- `prisma/schema.prisma` is written (38 KB, all models) with `directUrl` already configured for Supabase.
- `tsconfig.json` already aligned with project standards.
- `.prettierrc` and `eslint.config.mjs` already configured per spec.
- Context docs (`backend/context/`) are fully authored and serve as the spec suite.
- No `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `Dockerfile`, or custom health endpoint exists.

### Target State (Milestone M0)
> A new developer can clone the repo, fill in `.env` with Supabase credentials, run `docker-compose up` for Redis, and have the backend running locally against Supabase with health checks passing.

### Environment Architecture
```
Development:
  Backend (local) ──→ Supabase PostgreSQL (cloud)
  Backend (local) ──→ Redis (Docker local)

Production:
  Backend (Docker) ──→ PostgreSQL 15 (Docker)
  Backend (Docker) ──→ Redis 8.6 (Docker)
```

### Prisma Connection Strategy
- **`DATABASE_URL`** → Pooled connection (PgBouncer, port 6543) for all Prisma Client queries
- **`DIRECT_URL`** → Direct connection (port 5432) for `prisma migrate` commands only
- In production (Docker), both URLs point to the same direct connection (no pooler).

### Dependencies
- **None** — this is the first track. All subsequent tracks depend on M0 being complete.

### Key References
- `backend/context/guides/MISSION.md` — Purpose, success criteria, definition of done
- `backend/context/guides/CONSTITUTION.md` — Immutable rules (module structure, API envelope, auth strategy)
- `backend/context/guides/CODE-STANDARD.md` — Prettier/ESLint config, import order, git practices
- `backend/context/guides/TECH-STACK.md` — Exact package versions, env var list, Docker images
- `backend/context/plans/IMPLEMENTATION-ROADMAP.md` — Task index and dependency graph
- `backend/context/plans/TEST-PLAN.md` — Test strategy and coverage gates

---

## Constraints

- **Node.js 22.x LTS** — runtime version is pinned.
- **Port 3001** — backend must not conflict with frontend on 3000.
- **No secrets in repo** — `.env.example` must never contain real values.
- **Lint/format gate** — code must pass before any Phase 1 work begins.
- **Supabase version match** — Docker Postgres must match Supabase's PostgreSQL version (15).
- **Redis 8.6** — must use current stable, not EOL versions.
