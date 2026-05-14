# DerLg Backend — Agent Context Index

> This file lives in the backend root to keep agent context **local to this directory**. When working on backend code, read the files listed here first. Do not rely on global project memory — these specs are the source of truth.

---

## Quick Start

When starting work on the backend, read these files **in this order**:

1. `context/guides/MISSION.md` — Why this backend exists and what success looks like
2. `context/guides/CONSTITUTION.md` — Rules all backend code must follow
3. `context/guides/CODE-STANDARD.md` — How we write code (formatting, patterns, NestJS conventions)
4. `context/guides/TECH-STACK.md` — Exact package versions and configs
5. `context/plans/ROADMAP.md` — Current phase and what comes next
6. `context/specs/SCHEMA.md` — Database schema (Prisma)
7. `context/specs/API-CONTRACT.md` — All endpoints as TypeScript contracts

Then read the relevant domain specs for the task at hand.

---

## Context Files

All spec files are in `backend/context/` organized by category.

### `context/guides/` — How We Work (read first)

| File | Purpose | When to Read |
|------|---------|-------------|
| `guides/MISSION.md` | Purpose, success criteria, scope vs. out-of-scope, definition of done, target state | Before any implementation — understand the "why" |
| `guides/CONSTITUTION.md` | Immutable rules: module structure, dependency DAG, API envelope, auth strategy, naming conventions, testing gates | Before any implementation |
| `guides/CODE-STANDARD.md` | Code style: Prettier/ESLint config, import order, TypeScript patterns, NestJS patterns, DTO rules, git practices, PR checklist, security checklist | Before writing code, during code review |
| `guides/TECH-STACK.md` | Exact versions for every package, env var list, Docker images, external services, version pinning policy | Before installing packages, debugging version issues |

### `context/specs/` — What We Build (domain specs)

| File | Purpose | When to Read |
|------|---------|-------------|
| `specs/SCHEMA.md` | Complete Prisma schema: 20 models, 18 enums, all relations, indexes, soft delete conventions | When writing database queries, migrations, or DTOs |
| `specs/API-CONTRACT.md` | All ~80 endpoints: request DTOs, response types, auth requirements, error codes per endpoint | When implementing or modifying endpoints |
| `specs/ERROR-REGISTRY.md` | ~100 error codes by domain: code format, HTTP status, message template, module assignment | When adding new errors, writing exception handling |
| `specs/EVENT-CATALOG.md` | 18 domain events: payload TypeScript interfaces, producers, consumers, priority, implementation examples | When emitting or handling events, adding cross-module communication |

### `context/plans/` — Planning & Operations

| File | Purpose | When to Read |
|------|---------|-------------|
| `plans/IMPLEMENTATION-ROADMAP.md` | **Primary task index:** 7 tracks, ~60 tasks, dependency graph, week-by-week execution, spec references per task | **Start here** when picking next work |
| `plans/ROADMAP.md` | 13 sequential phases with deliverables, milestone summary, dependency graph, decision log, risk register | When planning work, estimating timelines |
| `plans/TEST-PLAN.md` | Test strategy: levels, coverage gates, 9 critical E2E flows, unit/integration patterns, property-based tests, CI pipeline | When writing tests, estimating test effort |
| `plans/SEED-SPEC.md` | Seed data: 5 users, 5 guides, 3 hotels, 8 places, 5 trips, vehicles, discount codes, festivals, seed order | When setting up local dev, writing E2E tests, demo prep |

---

## Directory Layout

```
backend/
  AGENTS.md              <-- you are here
  context/               <-- all spec files live here
    guides/              <-- how we work (read first)
      CONSTITUTION.md
      CODE-STANDARD.md
      TECH-STACK.md
    specs/               <-- what we build (domain specs)
      SCHEMA.md
      API-CONTRACT.md
      ERROR-REGISTRY.md
      EVENT-CATALOG.md
    plans/               <-- planning & operations
      ROADMAP.md
      TEST-PLAN.md
      SEED-SPEC.md
  src/                   <-- implementation code
  prisma/                <-- schema.prisma, migrations, seed.ts
  test/                  <-- E2E tests
  docker-compose.yml     <-- local services
  Dockerfile             <-- production build
```

---

## How to Use This Index

### Starting a new feature
1. Read `plans/ROADMAP.md` — identify the phase and milestone
2. Read `guides/CONSTITUTION.md` — verify module structure and dependency rules
3. Read `specs/SCHEMA.md` — understand the data model
4. Read `specs/API-CONTRACT.md` — implement the endpoint contracts
5. Read `plans/TEST-PLAN.md` — write tests to the specified level

### Fixing a bug
1. Read `specs/ERROR-REGISTRY.md` — check if the error code exists
2. Read `guides/CODE-STANDARD.md` — ensure the fix follows patterns
3. Read relevant section of `specs/API-CONTRACT.md` — verify expected behavior

### Adding a new error code
1. Read `specs/ERROR-REGISTRY.md` — check for duplicates
2. Add to `specs/ERROR-REGISTRY.md` first
3. Add to `src/common/errors/error-codes.ts`
4. Update `specs/API-CONTRACT.md` if endpoint behavior changes

### Modifying the database schema
1. Read `specs/SCHEMA.md` — understand current state
2. Edit `specs/SCHEMA.md` to reflect the change
3. Edit `prisma/schema.prisma` to match
4. Run migration: `npx prisma migrate dev`
5. Update `specs/API-CONTRACT.md` if response shapes change
6. Update `plans/SEED-SPEC.md` if new required fields are added

---

## Change Process

When a spec file changes, update **all affected files**:

| Change In | Also Update |
|-----------|-------------|
| `specs/SCHEMA.md` | `prisma/schema.prisma`, `specs/API-CONTRACT.md` (if shapes change), `plans/SEED-SPEC.md` |
| `specs/API-CONTRACT.md` | Implementation code, `specs/ERROR-REGISTRY.md` (if new errors) |
| `specs/ERROR-REGISTRY.md` | `src/common/errors/error-codes.ts` |
| `specs/EVENT-CATALOG.md` | Event producer/consumer implementations |
| `guides/CONSTITUTION.md` | All implementation code that may be affected (amendment process) |
| `plans/ROADMAP.md` | Nothing — this is planning-only |

---

## External References

These files live outside `backend/` but are relevant:

| File | Purpose |
|------|---------|
| `docs/modules/*/api.yaml` | Original OpenAPI specs (source for `API-CONTRACT.md`) |
| `docs/platform/backend/*.md` | Architecture deep-dives: security, async, AI integration, operations |
| `.kiro/specs/backend-nestjs-supabase/*.md` | Detailed requirements, design, and task breakdown |
| `CLAUDE.md` | Project-wide conventions (frontend + backend) |

---

## Agent Reminders

- **Do not use global memory** for backend decisions — check these files first
- **Do not guess error codes** — use `specs/ERROR-REGISTRY.md`
- **Do not guess schema fields** — use `specs/SCHEMA.md`
- **Do not skip tests** — follow `plans/TEST-PLAN.md` coverage gates
- **Do not add cross-module imports** — follow `guides/CONSTITUTION.md` dependency rules
- **Run lint and format before finishing** — per `guides/CODE-STANDARD.md`
