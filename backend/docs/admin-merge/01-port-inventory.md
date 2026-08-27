# Task 2 — Port Inventory

Every file in `derlg-system-admin/backend_admin/src` and where it lands in
`backend/src`. 151 `.ts` files, 20,459 lines total. Use this to check progress;
tick a row only when the destination file builds and its tests pass.

## Deleted in this task

| File | Why |
|---|---|
| `backend_admin/add-admin-tables.sql` | Contains no SQL. It is captured stdout from a failed `prisma migrate diff` run — the text is the CLI's `--from-url was removed` error and its usage block. Task 4 generates the real migration. |

## Size by area

| Area | Files | Specs | LOC (excl. spec) |
|---|---|---|---|
| `admin/controllers` | 32 | 16 | 1,773 |
| `admin/services` | 32 | 16 | 4,685 |
| `admin/dto` | 35 | 0 | 917 |
| `admin/guards` | 2 | 0 | 147 |
| `admin/interceptors` | 1 | 0 | 114 |
| `admin/websocket` | 2 | 1 | 239 |
| `auth` | 7 | 2 | 373 |
| `telegram` (all subdirs) | 23 | 2 | 3,709 |
| `minio` | 2 | 0 | 92 |
| `prisma` | 2 | 0 | 47 |
| `redis` | 2 | 0 | 80 |
| `health` | 2 | 0 | 81 |

## Controllers → destination routes

All 16 admin controllers move to `backend/src/modules/admin/controllers/`. The
`v1/` prefix is dropped from every `@Controller()` because `backend/src/main.ts`
already calls `setGlobalPrefix('v1')`.

The "Currently" column shows what the route resolves to today. 13 of 18 are
unreachable because the controller declares `v1/...` *and* the global prefix
applies, yielding `/v1/v1/...`. The frontend calls `/v1/admin/...`, so those
endpoints are dead. This table is the record of that being fixed.

| Controller | Declared today | Resolves today | Target `@Controller()` | Final route | Task |
|---|---|---|---|---|---|
| `admin-dashboard` | `v1/admin/dashboard` | `/v1/v1/…` broken | `admin/dashboard` | `/v1/admin/dashboard` | 8 |
| `admin-drivers` | `admin/drivers` | works | `admin/drivers` | `/v1/admin/drivers` | 9 |
| `admin-vehicles` | `admin/vehicles` | works | `admin/vehicles` | `/v1/admin/vehicles` | 9 |
| `admin-maintenance` | `admin/maintenance` | works | `admin/maintenance` | `/v1/admin/maintenance` | 9 |
| `admin-assignments` | `admin/assignments` | works | `admin/assignments` | `/v1/admin/assignments` | 10 |
| `admin-bookings` | `admin/bookings` | works | `admin/bookings` | `/v1/admin/bookings` | 11 |
| `admin-hotels` | `v1/admin/hotels` | `/v1/v1/…` broken | `admin/hotels` | `/v1/admin/hotels` | 12 |
| `admin-guides` | `v1/admin/guides` | `/v1/v1/…` broken | `admin/guides` | `/v1/admin/guides` | 13 |
| `admin-customers` | `v1/admin/customers` | `/v1/v1/…` broken | `admin/customers` | `/v1/admin/customers` | 13 |
| `AdminLoyaltyController` | `v1/admin/loyalty` | `/v1/v1/…` broken | `admin/loyalty` | `/v1/admin/loyalty` | 13 |
| `admin-discounts` | `v1/admin/discounts` | `/v1/v1/…` broken | `admin/discounts` | `/v1/admin/discounts` | 14 |
| `AdminStudentVerificationsController` | `v1/admin/student-verifications` | `/v1/v1/…` broken | `admin/student-verifications` | `/v1/admin/student-verifications` | 14 |
| `admin-emergency` | `v1/admin/emergency` | `/v1/v1/…` broken | `admin/emergency` | `/v1/admin/emergency` | 14 |
| `admin-analytics` | `v1/admin/analytics` | `/v1/v1/…` broken | `admin/analytics` | `/v1/admin/analytics` | 15 |
| `admin-audit` | `v1/admin/audit-logs` | `/v1/v1/…` broken | `admin/audit-logs` | `/v1/admin/audit-logs` | 15 |
| `admin-users` | `v1/admin/users` | `/v1/v1/…` broken | `admin/users` | `/v1/admin/users` | 15 |
| `admin-export` | `v1/admin` | `/v1/v1/…` broken | `admin` | `/v1/admin/…` | 15 |
| `admin-ai-monitoring` | `v1/admin/ai-sessions` | `/v1/v1/…` broken | `admin/ai-sessions` | `/v1/admin/ai-sessions` | 15 |
| `telegram` | `v1/telegram` | `/v1/v1/…` broken | `telegram` | `/v1/telegram` | 17 |

## Services → destination

All to `backend/src/modules/admin/services/`. "Drift" is the work beyond
mechanical renaming of Prisma accessors and fields.

| Service | LOC | Drift to fix | Task |
|---|---|---|---|
| `admin-dashboard.service` | — | `booking_status` enum: `reserved` → `hold`/`pending_payment` | 8 |
| `admin-drivers.service` | — | none (new tables only) | 9 |
| `admin-vehicles.service` | — | surface `tier`, `subtype` | 9 |
| `admin-maintenance.service` | — | none (new table only) | 9 |
| `admin-assignments.service` | — | wrap in `$transaction`; capacity vs `passengerCount` | 10 |
| `admin-bookings.service` | — | `deletedAt: null`; status enum; `BookingItem.startDate`/`endDate`; `snapshot`, `method`, `singleResourceKind`, `tripTemplateId` | 11 |
| `admin-hotels.service` | — | rewrite `getRoomAvailability` to interval overlap; `Hotel.type` | 12 |
| `admin-guides.service` | — | `guide_specialities` → `guide_specialties` + `Specialty` enum; 10-value `SupportedLanguage` | 13 |
| `admin-customers.service` | — | expose `User.status` | 13 |
| `admin-discounts.service` | — | canonical `DiscountCode` | 14 |
| `admin-emergency.service` | — | can now `include` the `Driver` relation | 14 |
| `admin-analytics.service` | — | `groupBy` on camelCase; enum values | 15 |
| `admin-audit.service` | — | `AuditLog` camelCase fields | 15 |
| `admin-users.service` | — | keep `users.role` consistent with `admin_users` | 15 |
| `admin-export.service` | — | CSV escaping | 15 |
| `admin-ai-monitoring.service` | — | `AIChatSession`/`AIChatMessage` | 15 |

## Infrastructure — merge, do not copy

`backend/` already has equivalents. The admin versions are **discarded**, not
ported, and imports are repointed.

| Admin file | Action | Reason |
|---|---|---|
| `prisma/prisma.service.ts` | **discard** | `backend/src/modules/prisma/prisma.service.ts` exists. The admin one hardcodes `PrismaPg` adapter + logs "connected to Supabase". |
| `prisma/prisma.module.ts` | discard | ditto |
| `redis/redis.service.ts` | **discard** | `backend/src/modules/redis/redis.service.ts` exists and exposes `getClient()`, which is all the ported code needs. |
| `redis/redis.module.ts` | discard | ditto |
| `health/*` | discard | `/v1/health` already exists in `backend/src/app.controller.ts`. |
| `common/decorators/current-user.decorator.ts` | discard | exists in `backend/src/common/decorators/`. |
| `auth/*` (7 files) | **discard entirely** | Task 6/7 replace it. It verifies passwords with raw SQL against Supabase `auth.users.encrypted_password`, signs with `JWT_SECRET`, and stores opaque refresh UUIDs in the `refresh_tokens` table — all three contradict `backend/`'s model. |
| `admin/guards/admin.guard.ts` | **discard** | Gates on `role in ['admin','support']`; `'support'` is not a `user_role` value. Global `JwtAuthGuard` + `@Roles()` covers it. |
| `main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts` | discard | `backend/` owns bootstrap. |

## Infrastructure — genuinely port

| Admin file | Destination | Task |
|---|---|---|
| `common/decorators/admin-roles.decorator.ts` | `backend/src/common/decorators/admin-roles.decorator.ts` | 6 |
| `admin/guards/admin-role.guard.ts` | `backend/src/common/guards/admin-role.guard.ts` | 6 |
| `admin/interceptors/audit.interceptor.ts` | `backend/src/modules/admin/interceptors/` | 8 |
| `admin/websocket/admin.gateway.ts` | `backend/src/modules/admin/websocket/` | 16 |
| `minio/minio.service.ts` | `backend/src/modules/storage/minio.service.ts` | 18 |
| `telegram/**` (23 files incl. 3 locale JSONs) | `backend/src/modules/telegram/` | 17 |

`telegram/locales/{en,zh,km}.json` are **driver-facing** bot strings selected by
`Driver.preferredLanguage`. They are not admin UI strings, so they survive the
"admin panel is English only" rule and must be copied as-is.

## Endpoints the frontend calls that have no backend

Found by diffing `frontend_admin/lib/api.ts` against the mapped routes. These
are new work, not ports.

| Frontend call | Status | Task |
|---|---|---|
| `POST /admin/upload/presigned` | no controller (`minio.service.ts` has no caller) | 18 |
| `GET /admin/telegram/support-tickets` | not implemented | 17 |
| `PATCH /admin/telegram/support-tickets/:id` | not implemented | 17 |
| `PATCH /admin/telegram/support-tickets/:id/assign` | not implemented | 17 |
| `GET /admin/telegram/analytics` | not implemented | 17 |
| `POST /admin/telegram/broadcast` | exists at `telegram/broadcast`, wrong path | 17 |
| `GET /admin/telegram/broadcasts` | exists at `telegram/broadcasts`, wrong path | 17 |
| `GET /auth/me` | not implemented in `backend/` | 7 |

## Dependencies to add to `backend/package.json`

Exact pinned versions, no `^` or `~`, per project rules.

| Package | Why | Note |
|---|---|---|
| `@nestjs/websockets` | `AdminGateway` | |
| `@nestjs/platform-socket.io` | `AdminGateway` | |
| `socket.io` | transitive peer of the above | |
| `@nestjs/bullmq` | 3 queue processors | |
| `bullmq` | ditto | |
| `date-fns` | `formatDistanceToNow` in telegram handlers | |
| `minio` | storage module | **move** from `devDependencies` |

Not needed: no Telegram bot library. `telegram/services/bot-sender.service.ts`
calls the Bot API with plain `fetch`. Also not needed: `@prisma/adapter-pg`,
since `backend`'s `PrismaService` uses a plain `PrismaClient`.


## Booking fixtures — decision for Task 5

Task 1 found `bookings = 0`, and Tasks 10, 11 and 12 all need real bookings to
demo. Two options existed:

- `prisma/seeds/dummy-bulk.ts` **does** create `bookings`, `bookingItem` (with
  `startDate`/`endDate` and `snapshot`), `payments`, loyalty rows and reviews —
  so it would work. But it is opt-in behind `--with-dummy` / `ALLOW_DUMMY=1`,
  generates `N = 500` rows per table, and its own header says it "pollutes
  customer-facing search, load-testing use only". It is not in `run.ts`.
- A small, purpose-built fixture set.

**Chosen: the small fixture set.** This dev database is the one the running site
reads from, so injecting 500 synthetic trips and hotels into customer-facing
search to test an admin screen is the wrong trade. Task 5 will seed a handful of
bookings with recognisable references, spanning the cases the later demos need:

| Case | Needed by |
|---|---|
| a `confirmed` transportation booking with `passengerCount` set | Task 10 assignment + capacity check |
| a `hold` booking and an `expired` one | Task 11 status filters |
| one soft-deleted booking (`deletedAt` set) | Task 11 exclusion proof |
| a `hotel_room` booking over a known date range | Task 12 interval-overlap proof |
| one `cancelled` booking on the same room | Task 12 "cancelled is ignored" proof |

`dummy-bulk.ts` stays untouched and un-registered.
