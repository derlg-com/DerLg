# DerLg Backend — Supabase Workflow Guide

> How to work with Prisma + Supabase in development and Docker PostgreSQL in production.

---

## Quick Reference

| Task | Command | Uses URL |
|------|---------|----------|
| Generate Prisma Client | `npx prisma generate` | None |
| Create migration (dev) | `npx prisma migrate dev` | `DIRECT_URL` (port 5432) |
| Apply migrations (prod) | `npx prisma migrate deploy` | `DIRECT_URL` |
| Seed database | `npx prisma db seed` | `DATABASE_URL` (port 6543) |
| Open Prisma Studio | `npx prisma studio` | `DATABASE_URL` (port 6543) |
| Validate schema | `npx prisma validate` | None |
| Format schema | `npx prisma format` | None |
| Reset database (dev) | `npx prisma migrate reset` | `DIRECT_URL` |
| Push schema (no migration) | `npx prisma db push` | `DIRECT_URL` |

---

## Environment URLs

### Development (Supabase)

```
DATABASE_URL → postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true
                └─ PgBouncer pooler ──┘
                Required for Prisma Client queries (connection pooling)

DIRECT_URL   → postgresql://...@pooler.supabase.com:5432/postgres
                └─ Direct connection ──┘
                Required for Prisma Migrate (migrations can't run through pooler)
```

### Production (Docker)

```
DATABASE_URL → postgresql://derlg:derlg@postgres:5432/derlg?schema=public
DIRECT_URL   → postgresql://derlg:derlg@postgres:5432/derlg?schema=public
                Both identical — no pooler in Docker
```

---

## Daily Development Workflow

### 1. Start Local Infrastructure

```bash
# Start Redis only (Supabase provides PostgreSQL)
docker-compose up -d

# Verify Redis is healthy
docker-compose ps
```

### 2. Generate Prisma Client

Run after every schema change:

```bash
npx prisma generate
```

This creates the TypeScript types in `node_modules/@prisma/client`. No database connection needed.

### 3. Create a Migration (Development)

When you change `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name add_user_preferences
```

- Uses **`DIRECT_URL`** (port 5432) — migrations cannot run through PgBouncer
- Creates a new migration file in `prisma/migrations/`
- Applies the migration to your Supabase database
- Regenerates the Prisma Client automatically

### 4. Seed the Database

```bash
npx prisma db seed
```

- Uses **`DATABASE_URL`** (port 6543, via pooler)
- Runs `prisma/seeds/run.ts`
- Idempotent — safe to run multiple times

### 5. Browse Data

```bash
npx prisma studio
```

- Opens `http://localhost:5555`
- Uses **`DATABASE_URL`** (pooled connection)

### 6. Start the Backend

```bash
npm run start:dev
```

The backend reads `DATABASE_URL` from `.env` and connects to Supabase via PgBouncer.

---

## Schema Changes Checklist

When modifying `prisma/schema.prisma`:

1. Edit the schema
2. `npx prisma format` — auto-format
3. `npx prisma validate` — check for errors
4. `npx prisma migrate dev --name <description>` — create migration
5. `npx prisma generate` — ensure client is up to date
6. `npx prisma db seed` — re-seed if new required fields were added
7. Commit: `schema.prisma` + migration folder

---

## Production Deployment

### 1. Build and Start

```bash
# Copy and fill production env
cp .env.production .env.production.local
# edit .env.production.local

# Start full stack
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Apply Migrations

```bash
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

- Uses `DIRECT_URL` pointing to Docker PostgreSQL
- Non-interactive — safe for CI/CD

### 3. Seed (First Deploy Only)

```bash
docker-compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

---

## Troubleshooting

### `P1001`: Can't reach database

```
Error: P1001: Can't reach database server at `...`:`6543`
```

- Check your `.env` file exists and has correct `DATABASE_URL`
- Verify Supabase project is active (not paused)
- Check network connectivity: `telnet pooler.supabase.com 6543`

### `P1003`: Database does not exist

- Your Supabase project may be new and empty — this is normal before first migration
- Run `npx prisma migrate dev` to create tables

### `P3018`: Migration already applied

Happens when switching between dev/prod databases. Use:

```bash
npx prisma migrate resolve --applied <migration_name>
```

### `P6009`: PgBouncer query timeout

Supabase PgBouncer has a 5-minute idle timeout. Prisma handles this automatically with connection pooling, but if you see timeouts:

- Ensure `?pgbouncer=true` is in `DATABASE_URL`
- Reduce `connection_limit` in the URL (default is fine)

### `P5004`: Migration lock timeout

If a migration hangs:

```bash
# Check migration status
npx prisma migrate status

# Reset (dev only — wipes data)
npx prisma migrate reset
```

---

## FAQ

**Q: Why do I need two URLs?**
> Prisma Migrate needs a direct connection (no PgBouncer) to run transactions and DDL. Prisma Client works better with a connection pooler for queries.

**Q: Can I use `prisma db push` instead of `migrate dev`?**
> Yes, for rapid prototyping: `npx prisma db push`. But prefer `migrate dev` for tracked, reversible schema changes.

**Q: Where do migration files go?**
> `prisma/migrations/YYYYMMDDHHMMSS_description/`. Commit these to git.

**Q: Does `prisma migrate deploy` create the database?**
> No. The database must already exist. `prisma migrate deploy` only creates tables.

**Q: Can I connect Prisma Studio to production?**
> Yes, but use `npx prisma studio` locally with `DATABASE_URL` pointing to prod (not recommended for routine use).

---

## References

- `backend/.env` — Development credentials (gitignored)
- `backend/.env.production` — Production template
- `backend/prisma/schema.prisma` — Database schema
- `backend/context/specs/SCHEMA.md` — Full schema specification
- `backend/context/plans/SEED-SPEC.md` — Seed data specification
