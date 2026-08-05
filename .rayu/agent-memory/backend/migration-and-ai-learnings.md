---
name: DerLg backend migration + AI model learnings
description: How to safely migrate the drifted live DB (localhost:54322) and the gpt-oss-120b latency facts that drove vibe-booking timeout config
type: project
---

## Facts

1. **Live DB (localhost:54322) cannot use `prisma migrate dev`.** It was created via `db push`, not from the migration history, and the `users` table carries Supabase-auth leftovers. `migrate dev` always demands a destructive reset. Working pattern (verified 2026-08-05): mark legacy migrations applied via `npx prisma migrate resolve --applied <name>`, add a `baseline_sync` migration folder (generated with `prisma migrate diff --from-migrations --shadow-database-url <url> --to-schema-datamodel ...`), apply new migration SQL with `prisma db execute --file <migration.sql>`, then `migrate resolve --applied <name>`. Keep new migrations hand-written to match Prisma conventions (implicit m2m = PRIMARY KEY (A,B), not unique index).
2. **`CREATE TYPE ... IF NOT EXISTS` is not supported in PostgreSQL** — use `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_type ...) $$` guards in hand-applied SQL.
3. **NVIDIA gpt-oss-120b on the free tier measures 60–90 s per call** (reasoning model; verified with a trivial curl). The planned 25 s timeout made every chat turn fail → `MODEL_TIMEOUT_S=90` in vibe-booking/.env. Streaming can also emit chunks with an EMPTY `choices` array → nvidia.py was hardened (IndexError bug).
4. **vibe-booking uvicorn `--reload` can hang** ("Waiting for background tasks") when a slow LLM call is in flight during a reload — relaunch without `--reload`.

**Why:** Phase 1 (P1-P6) of the 9-problem fix; these constraints shaped all schema + AI changes.
**How to apply:** any future backend schema change on this repo must use the db-execute + resolve pattern, never `migrate dev`; any change to model timeouts must respect the ~90 s reasoning-model latency; relaunch vibe-booking with `env -u NVIDIA_API_KEY` (shell-exported key shadows .env → 403 every turn).
