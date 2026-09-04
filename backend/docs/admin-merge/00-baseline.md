# Task 1 — Verified Baseline

Captured 2026-08-19 14:15–14:17, before any change to schema, code, or database.

## Target database

`backend/.env` → `DATABASE_URL` and `DIRECT_URL` both point at
`postgresql://postgres:postgres@localhost:54322/postgres`.

That port is served by the Docker container `supabase_db_das-tern`
(`public.ecr.aws/supabase/postgres:15.8.1.085`), healthy, up 4 hours. This is the
**local** Postgres the public site already uses — it is the merge target. No
remote Supabase project is involved from here on.

Supporting containers already running and matching `backend/.env`:

| Service | Container | Port |
|---|---|---|
| Postgres | `supabase_db_das-tern` | 54322 |
| Redis | `telegramscanning-redis-1` | 6379 |
| MinIO | `derlg-minio` | 9000 / 9001 |

## Schema state

38 tables in `public`. All 8 Prisma migrations applied, none rolled back:

```
20260512051242_init
20260529171749_add_booking_method_and_snapshot
20260529194742_merge_booking_methods
20260805090000_baseline_sync
20260805100000_add_hotel_type
20260805110000_guide_languages_specialties_packages
20260805120000_vehicle_tier_subtype
20260805130000_custom_trips
```

A clean, fully-applied history means `prisma migrate diff --from-migrations` is
safe to use for generating the Task 4 migration.

### The 7 admin tables are confirmed absent

```
MISSING: drivers
MISSING: driver_assignments
MISSING: vehicle_maintenance
MISSING: admin_users
MISSING: support_tickets
MISSING: broadcast_messages
MISSING: backups
```

Because they hold no rows, the foreign keys added in Task 3 cannot fail on dirty
data.

### `emergency_alerts.driver_id` is pre-staged

```
 driver_id | uuid |  |  |
Indexes:
    "emergency_alerts_driver_id_idx" btree (driver_id)
Foreign-key constraints:
    (none)
```

Column and index exist from `20260805090000_baseline_sync`; the FK does not.
Task 3 adds exactly one FK here.

### Canonical names already correct in the DB

`guide_specialties` exists (not the admin schema's `guide_specialities`),
confirming the physical DB matches `backend/prisma/schema.prisma`, not
`backend_admin`'s stale introspection.

## Row counts

| Table | Rows |
|---|---|
| places | 43 |
| hotel_rooms | 11 |
| transportation_vehicles | 8 |
| users | 7 |
| discount_codes | 6 |
| hotels | 5 |
| trips | 5 |
| guides | 4 |
| ai_chat_sessions | 0 |
| audit_logs | 0 |
| booking_items | 0 |
| bookings | 0 |
| emergency_alerts | 0 |
| payments | 0 |

**Consequence for later tasks:** there are zero bookings, so the demos for
Task 10 (assignments), Task 11 (bookings) and Task 12 (room availability) need
booking fixtures first. `prisma/seeds/dummy-bulk.ts` is the candidate; if it
does not create bookings, Task 5 must.

## Rollback point

```
/tmp/derlg-baseline/derlg-public-20260819-141536.sql   (199K, pg_dump --schema=public --no-owner --no-acl)
```

Restore with:

```bash
docker exec -i supabase_db_das-tern psql -U postgres -d postgres \
  < /tmp/derlg-baseline/derlg-public-20260819-141536.sql
```

## Build, test and boot baseline — all green

| Check | Result |
|---|---|
| `npm run build` | exit 0, no errors |
| `npm test` | 25 suites, 135 tests, all passed (4.1s) |
| Boot | `Nest application successfully started`, 59 routes mapped |
| `GET /v1/trips?limit=1` | HTTP 200, `total: 5` from the real DB |

Any later failure in these is attributable to the merge, not pre-existing.

The one `ERROR` line in the test output
(`[SendResetEmailUseCase] Failed to send reset email`) is an intentional
assertion inside a passing test, not a failure.

## Two incidental bugs found while establishing the baseline

Not in the plan's scope; recorded so they are not mistaken for merge damage.

1. **`package.json` `start:prod` is wrong.** It runs `node dist/main`, but
   `debug_e2e.ts` sitting at the project root shifts the TypeScript rootDir, so
   the real entrypoint is `dist/src/main.js`. `start:prod` therefore fails with
   `MODULE_NOT_FOUND`. `derlg-system-admin/start.sh` has the same shape
   (`node dist/src/main`) and happens to be correct.
2. **No `GET /v1/auth/me`.** Confirmed against the 59 mapped routes.
   `/v1/users/me` exists instead. Task 7 adds `/v1/auth/me` as planned.
