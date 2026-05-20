# Plan: Core Inventory (`feature/2026-05-20-core-inventory`)

> **Phase:** 4 (Core Inventory)
> **Branch:** `feature/2026-05-20-core-inventory`
> **Started:** 2026-05-20
> **Status:** 🟡 In Progress
> **Architecture:** **Use-case pattern**, mirroring `backend/src/modules/auth/`. One `*UseCase` class per endpoint, single `execute()` method, injected directly into the controller. **No `<feature>.service.ts` files.**
> **Tests:** Deliberately deferred to a follow-up branch per user direction. Coverage gate from `TEST-PLAN.md` will be restored before merge to `main`.

This plan is a series of numbered task groups. Implement top to bottom. Sub-tasks **within** a group (e.g. multiple use-case files in the same module) may be written in any order, but **module groups (2 → 3 → 4 → 5 → 6 → 7) must be implemented strictly sequentially**, one at a time, with the per-module gate passed before the next begins. See § "⚠️ Sequential implementation rule" below.

---

## ⚠️ Sequential implementation rule (read before starting any module group)

**Implement one module at a time.** After Group 1 (shared primitives) lands, build modules **sequentially** in the order listed (Trips → Places → Hotels → Guides → Transportation → Search). Do not begin Group N+1 until Group N has passed its per-module gate.

Each module group ends with a **Per-module gate** subsection. The gate is identical for every module:

| # | Check | Command |
|---|-------|---------|
| 1 | Lint clean | `npm run lint` — zero errors / zero warnings |
| 2 | Build clean | `npm run build` succeeds |
| 3 | Type-check clean | `npx tsc --noEmit` — zero type errors |
| 4 | Endpoints respond | Run the manual smoke `curl` commands for **this module's** endpoints from `validation.md` |
| 5 | Cache populates | After two identical requests, `redis-cli KEYS 'cat:<feature>:*'` shows keys with the expected TTL |
| 6 | Update tracker | Tick the relevant boxes in `progress-tracker.md` for **this group only**; flip the group row to 🟢; append a row to "Recent Updates / Log" |
| 7 | Stop & confirm | Pause for review **before** starting the next module group |

Why sequential: the trips module is the canonical pattern; every later module copies its shape. Building one at a time lets a reviewer catch divergence early, keeps PRs reviewable, and matches the user's directive "one module at a time for AI agent to ensure quality."

---

## Code Standard — Use-Case Pattern (canonical)

Every catalog module **must** match this layout (lifted from `src/modules/auth/`):

```
src/modules/<feature>/
  <feature>.module.ts          # imports PrismaModule, RedisModule, CommonModule;
                               # providers: list ALL use cases explicitly
  <feature>.controller.ts      # thin: DTO in → useCase.execute() → DTO/JSON out
  dto/
    <action>.dto.ts            # class-validator decorators, one DTO per file
    index.ts                   # barrel
  interfaces/
    <thing>.interface.ts       # plain TS types, one per file
    index.ts                   # barrel using `export type`
  use-cases/
    <action>.use-case.ts       # @Injectable() class, single async execute()
    index.ts                   # barrel
  utils/
    <helper>.util.ts           # pure functions (mappers, calculators)
    index.ts                   # barrel
```

### Use-case class template

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { tripDetailKey } from '../../../common/cache/cache-keys';
import { mapTripDetail } from '../utils';
import type { TripDetail } from '../interfaces';
import type { Lang } from '../../../common/i18n';

@Injectable()
export class GetTripDetailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<TripDetail> {
    return this.cache.getOrSet(tripDetailKey(id, lang), 600, async () => {
      const row = await this.prisma.trip.findFirst({
        where: { id, deletedAt: null },
        include: {
          translations: { where: { lang } },
          itinerary: { include: { translations: { where: { lang } } } },
        },
      });
      if (!row) {
        throw new NotFoundException({
          code: ErrorCode.TRP_NOT_FOUND,
          message: 'Trip not found',
        });
      }
      return mapTripDetail(row, lang);
    });
  }
}
```

### Controller template (thin)

```ts
@Controller('trips')
export class TripsController {
  constructor(
    private readonly listTrips: ListTripsUseCase,
    private readonly getTripDetail: GetTripDetailUseCase,
    private readonly getRelatedTrips: GetRelatedTripsUseCase,
    private readonly getTripShareUrl: GetTripShareUrlUseCase,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListTripsDto, @Req() req: Request) {
    return this.listTrips.execute(query, parseAcceptLanguage(req));
  }
  // ... one route per use case, no business logic in handlers
}
```

### Module template

```ts
@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [TripsController],
  providers: [
    ListTripsUseCase,
    GetTripDetailUseCase,
    GetRelatedTripsUseCase,
    GetTripShareUrlUseCase,
  ],
})
export class TripsModule {}
```

### Conventions (mirrors `src/modules/auth/`)

1. **One use case per endpoint.** No mega-services. If two endpoints share logic, extract to `utils/` or a dedicated use case both consume.
2. **Constructor-only DI.** Use cases inject `PrismaService`, `RedisService`, `CachedService`, or **other use cases** — never a feature service (none exist).
3. **Public surface = `execute()`.** No additional public methods on a use case.
4. **Errors:** `throw new <Nest>Exception({ code: ErrorCode.XXX, message })`. The `ErrorCode` registry (singular) lives at `src/common/errors/error-codes.ts`. Match the existing auth style (e.g. `AUTH_EMAIL_EXISTS`).
5. **Imports:** relative paths only — `../../prisma/prisma.service`, `../../redis/redis.service`, `../../../common/errors/error-codes`, `../utils`, `../dto`, `../interfaces`. Type-only imports use `import type`.
6. **Pure utils** in `utils/` — mappers (Prisma row → API DTO), Haversine, date overlap. No state, no DI.
7. **Barrels** — every subfolder has an `index.ts` re-exporting its members.

---

## Folder Structure (target state)

> **What this section is:** the exact tree the working copy should have when this branch is ready to merge. Every file listed here is either created (no marker), modified (`(modified)`), or already in place from earlier phases (not listed). Use this as a checklist while implementing.

### Shared kernel additions / changes (`src/common/`)

```
src/common/
  cache/                                    # NEW (Group 1)
    cached.service.ts
    cache-keys.ts
    index.ts
  i18n/                                     # NEW (Group 1)
    accept-language.helper.ts
    index.ts
  dto/
    list-query.dto.ts                       (modified — adds q, lang, sort)
  errors/
    error-codes.ts                          (modified — add TRP_/PLC_/HTL_/GUI_/TRN_/SRC_ codes)
  common.module.ts                          (modified — provide CachedService + i18n re-export)
```

### TripsModule (Group 2)

```
src/modules/trips/
  trips.module.ts
  trips.controller.ts
  dto/
    list-trips.dto.ts
    index.ts
  interfaces/
    trip-summary.interface.ts
    trip-detail.interface.ts
    index.ts
  use-cases/
    list-trips.use-case.ts
    get-trip-detail.use-case.ts
    get-related-trips.use-case.ts
    get-trip-share-url.use-case.ts
    index.ts
  utils/
    map-trip.util.ts                        # mapTripSummary + mapTripDetail (pure)
    index.ts
```

### PlacesModule (Group 3)

```
src/modules/places/
  places.module.ts
  places.controller.ts
  dto/
    list-places.dto.ts
    nearby-query.dto.ts
    index.ts
  interfaces/
    place-summary.interface.ts
    place-detail.interface.ts
    index.ts
  use-cases/
    list-places.use-case.ts
    get-place-detail.use-case.ts
    get-related-places.use-case.ts
    get-nearby-trips.use-case.ts
    get-nearby-places.use-case.ts
    index.ts
  utils/
    map-place.util.ts
    haversine.util.ts                       # (lat1, lon1, lat2, lon2) => km (pure)
    index.ts
```

### HotelsModule (Group 4)

```
src/modules/hotels/
  hotels.module.ts
  hotels.controller.ts
  dto/
    list-hotels.dto.ts
    room-availability-query.dto.ts          # checkIn, checkOut
    index.ts
  interfaces/
    hotel-summary.interface.ts
    hotel-detail.interface.ts
    room-availability.interface.ts
    index.ts
  use-cases/
    list-hotels.use-case.ts
    get-hotel-detail.use-case.ts
    get-hotel-rooms.use-case.ts
    index.ts
  utils/
    map-hotel.util.ts
    check-room-overlap.util.ts              # filter Booking rows overlapping a date range (pure)
    index.ts
```

### GuidesModule (Group 5)

```
src/modules/guides/
  guides.module.ts
  guides.controller.ts
  dto/
    list-guides.dto.ts                      # filters: language, speciality
    availability-query.dto.ts               # from, to
    index.ts
  interfaces/
    guide-summary.interface.ts
    guide-detail.interface.ts
    availability.interface.ts
    index.ts
  use-cases/
    list-guides.use-case.ts
    get-guide-detail.use-case.ts
    get-guide-availability.use-case.ts
    index.ts
  utils/
    map-guide.util.ts
    availability.util.ts                    # date-range overlap helper (pure)
    index.ts
```

### TransportationModule (Group 6)

```
src/modules/transportation/
  transportation.module.ts
  transportation.controller.ts
  dto/
    list-vehicles.dto.ts                    # filter: type ∈ VAN | BUS | TUKTUK
    availability-query.dto.ts               # from, to
    index.ts
  interfaces/
    vehicle-summary.interface.ts
    vehicle-detail.interface.ts
    availability.interface.ts
    index.ts
  use-cases/
    list-vehicles.use-case.ts
    get-vehicle-detail.use-case.ts
    get-vehicle-availability.use-case.ts
    index.ts
  utils/
    map-vehicle.util.ts
    availability.util.ts                    # same shape as guides; intentional per-module copy
    index.ts                                # (refactor to shared kernel only if a 3rd consumer appears)
```

### SearchModule (Group 7)

```
src/modules/search/
  search.module.ts
  search.controller.ts
  dto/
    search-query.dto.ts                     # q (>=2), type, page, limit, lang
    index.ts
  interfaces/
    search-hit.interface.ts                 # discriminated union { kind: 'trip'|'place'|'hotel'|'guide', ... }
    index.ts
  use-cases/
    global-search.use-case.ts
    index.ts
  utils/
    merge-search-results.util.ts            # flatten per-table results into unified shape (pure)
    index.ts
```

### Files modified outside any feature module (Group 8)

```
src/app.module.ts                           (modified — import TripsModule, PlacesModule, HotelsModule,
                                                            GuidesModule, TransportationModule, SearchModule)
src/config/env.validation.ts                (modified — validate FRONTEND_URL)
backend/.env.example                        (modified — add FRONTEND_URL if missing)
backend/context/plans/PROGRESS-TRACKER.md   (modified — Phase 4 status)
```

### File-count summary

| Bucket | Files |
|--------|-------|
| Use-case classes (one per endpoint) | **19** |
| Module files (`<feature>.module.ts`) | 6 |
| Controller files (`<feature>.controller.ts`) | 6 |
| DTO files (excluding barrels) | 11 |
| Interface files (excluding barrels) | 14 |
| Util files (excluding barrels) | 9 |
| Barrel `index.ts` files | 24 (4 per module × 6) |
| Shared kernel new files | 5 (`cache/` ×3, `i18n/` ×2) |
| Modified files | 6 |
| **Total new files (incl. barrels)** | **~94** |

### Conventions reflected in this tree

- Every subfolder has an `index.ts` barrel — required by the use-case pattern (§ 3.3 of `CODE-STANDARD.md`).
- One use-case file per endpoint, named `<verb>-<resource>.use-case.ts` (e.g. `get-trip-detail.use-case.ts`, `list-vehicles.use-case.ts`). The class inside is `<VerbResource>UseCase` (e.g. `GetTripDetailUseCase`).
- One DTO file per "shape" (list query, body, etc.). DTO classes are `<Verb><Resource>Dto` (e.g. `ListTripsDto`).
- Pure helpers go in `utils/`, never in use cases. Two modules duplicating the same helper (e.g. `availability.util.ts` in `guides/` and `transportation/`) is acceptable; promote to `src/common/` only when a third consumer appears.
- **No `<feature>.service.ts`, `<feature>.repository.ts`, or `<feature>.spec.ts` files** in this branch (tests deferred; repositories not justified by query complexity).

---

## Group 1 — Shared catalog primitives (foundation)

> **Goal:** Build once, reuse across every catalog module. Use cases consume these directly via constructor injection.

| # | File | Action | Notes |
|---|------|--------|-------|
| 1.1 | `src/common/i18n/accept-language.helper.ts` | **Create** | Export `parseAcceptLanguage(req): Lang` and `type Lang = 'en' \| 'zh' \| 'km'`. Defaults to `'en'`. Reads `req.headers['accept-language']`, picks the first supported tag. |
| 1.2 | `src/common/i18n/index.ts` | **Create** | Barrel: `export * from './accept-language.helper';` |
| 1.3 | `src/common/cache/cached.service.ts` | **Create** | `@Injectable()` class. Constructor injects `RedisService`. Single public method `async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>`. JSON-serialises values; debug-logs cache MISS / HIT via Pino. |
| 1.4 | `src/common/cache/cache-keys.ts` | **Create** | Pure helpers: `tripListKey(query, lang)`, `tripDetailKey(id, lang)`, `placeListKey(...)`, `hotelRoomsKey(hotelId, checkIn, checkOut)`, `searchKey(q, type, page, limit, lang)`, etc. All keys prefixed `cat:`. |
| 1.5 | `src/common/cache/index.ts` | **Create** | Barrel: `export { CachedService } from './cached.service'; export * from './cache-keys';` |
| 1.6 | `src/common/common.module.ts` | **Modify** | Provide + export `CachedService`. Re-export the i18n helper file via `export *` from the barrel so feature modules import from one place. |
| 1.7 | `src/common/dto/list-query.dto.ts` | **Modify** (or create) | Extend the existing `PageQueryDto` with optional shared filters: `q?: string`, `lang?: Lang`, `sort?: string`. Catalog DTOs subclass this. |

**Verification:** `npm run build` clean; `CachedService.getOrSet` returns cached value on second call (manual smoke).

---

## Group 2 — TripsModule (canonical Phase 4 module)

> **Goal:** First Phase 4 module end-to-end in the use-case pattern. Every later module mirrors this layout exactly.

### 2.A Use cases — one file per endpoint

| # | File | Class | `execute(...)` signature |
|---|------|-------|--------------------------|
| 2.1 | `src/modules/trips/use-cases/list-trips.use-case.ts` | `ListTripsUseCase` | `(query: ListTripsDto, lang: Lang): Promise<PaginatedResponse<TripSummary>>` |
| 2.2 | `src/modules/trips/use-cases/get-trip-detail.use-case.ts` | `GetTripDetailUseCase` | `(id: string, lang: Lang): Promise<TripDetail>` — throws `NotFound` with `ErrorCode.TRP_NOT_FOUND` |
| 2.3 | `src/modules/trips/use-cases/get-related-trips.use-case.ts` | `GetRelatedTripsUseCase` | `(id: string, lang: Lang): Promise<TripSummary[]>` (≤ 6, exclude self, same category) |
| 2.4 | `src/modules/trips/use-cases/get-trip-share-url.use-case.ts` | `GetTripShareUrlUseCase` | `(id: string): Promise<{ url: string }>` |
| 2.5 | `src/modules/trips/use-cases/index.ts` | barrel | re-export all four |

### 2.B Supporting files

| # | File | Action |
|---|------|--------|
| 2.6 | `src/modules/trips/dto/list-trips.dto.ts` | Extends shared `ListQueryDto`. Adds `category?`, `priceMin?`, `priceMax?`, `durationDays?` with class-validator decorators. |
| 2.7 | `src/modules/trips/dto/index.ts` | Barrel. |
| 2.8 | `src/modules/trips/interfaces/trip-summary.interface.ts` | API contract type for list rows. |
| 2.9 | `src/modules/trips/interfaces/trip-detail.interface.ts` | API contract type for detail. |
| 2.10 | `src/modules/trips/interfaces/index.ts` | Barrel using `export type`. |
| 2.11 | `src/modules/trips/utils/map-trip.util.ts` | `mapTripSummary(row, lang)` and `mapTripDetail(row, lang)` pure functions. Falls back to English row when translation missing. |
| 2.12 | `src/modules/trips/utils/index.ts` | Barrel. |
| 2.13 | `src/modules/trips/trips.controller.ts` | `@Controller('trips')`. Routes `GET /` `GET /:id` `GET /:id/related` `GET /:id/share`. All `@Public()`. Each handler is one line: `return this.<useCase>.execute(...)`. |
| 2.14 | `src/modules/trips/trips.module.ts` | `imports: [PrismaModule, RedisModule, CommonModule]`, `controllers: [TripsController]`, `providers: [ListTripsUseCase, GetTripDetailUseCase, GetRelatedTripsUseCase, GetTripShareUrlUseCase]`. |
| 2.15 | `src/app.module.ts` | Import `TripsModule`. |

**Cache TTLs (Trips):** list = 300 s, detail = 600 s, related = 600 s, share = 86 400 s.

### 2.C Per-module gate (do not skip)

1. `npm run lint` — zero errors / warnings
2. `npm run build` — clean
3. `npx tsc --noEmit` — clean
4. Run the **Trips** smoke commands from `validation.md` (`GET /v1/trips`, `GET /v1/trips/:id`, `GET /v1/trips/:id/related`, `GET /v1/trips/:id/share`)
5. `redis-cli KEYS 'cat:trip:*'` shows keys; `TTL` matches the table above
6. **Stop here.** Do not start Group 3 (Places) until the gate passes.

**Verification (envelope):** `curl http://localhost:3001/v1/trips` returns `{ success:true, data:{ items:[…], page:1, limit:20, total:N } }` (envelope from Phase 1's `TransformInterceptor`).

---

## Group 3 — PlacesModule (5 use cases)

> **Goal:** Replicate the Trips pattern for places, plus two "nearby" use cases. **Do not start until Group 2 has passed its per-module gate.**

### 3.A Use cases — one file per endpoint

| File | Class |
|------|-------|
| `use-cases/list-places.use-case.ts` | `ListPlacesUseCase` |
| `use-cases/get-place-detail.use-case.ts` | `GetPlaceDetailUseCase` (404 → `ErrorCode.PLC_NOT_FOUND`) |
| `use-cases/get-related-places.use-case.ts` | `GetRelatedPlacesUseCase` |
| `use-cases/get-nearby-trips.use-case.ts` | `GetNearbyTripsUseCase` |
| `use-cases/get-nearby-places.use-case.ts` | `GetNearbyPlacesUseCase` |
| `use-cases/index.ts` | barrel |

### 3.B Supporting files

| File | Action |
|------|--------|
| `src/modules/places/dto/list-places.dto.ts` + `nearby-query.dto.ts` + `index.ts` | Class-validator decorators. |
| `src/modules/places/interfaces/place-summary.interface.ts` + `place-detail.interface.ts` + `index.ts` | API contract types. |
| `src/modules/places/utils/map-place.util.ts` + `haversine.util.ts` + `index.ts` | `mapPlaceSummary` / `mapPlaceDetail` mappers; pure `haversine(lat1, lon1, lat2, lon2): number` (km). |
| `src/modules/places/places.controller.ts` | `@Controller('places')`. Routes `GET /` · `GET /:id` · `GET /:id/related` · `GET /:id/nearby-trips?radiusKm=20` · `GET /:id/nearby-places`. All `@Public()`. |
| `src/modules/places/places.module.ts` | `imports: [PrismaModule, RedisModule, CommonModule]`, `providers: [ListPlacesUseCase, GetPlaceDetailUseCase, GetRelatedPlacesUseCase, GetNearbyTripsUseCase, GetNearbyPlacesUseCase]`. |
| `src/app.module.ts` | Import `PlacesModule` (only this module — do not pre-register the others). |

**Cache TTLs:** list = 300 s, detail = 600 s, related = 600 s, nearby-* = 300 s.

### 3.C Per-module gate (do not skip)

1. `npm run lint` clean
2. `npm run build` clean
3. `npx tsc --noEmit` clean
4. Run the **Places** smoke commands from `validation.md` (`GET /v1/places`, `GET /v1/places/:id`, `GET /v1/places/:id/nearby-trips?radiusKm=20`)
5. `redis-cli KEYS 'cat:place:*'` shows keys with expected TTLs
6. **Stop here.** Do not start Group 4 (Hotels) until the gate passes.

---

## Group 4 — HotelsModule (3 use cases)

> **Goal:** Hotels list/detail plus room availability. **Do not start until Group 3 has passed its per-module gate.**

### 4.A Use cases — one file per endpoint

| File | Class |
|------|-------|
| `use-cases/list-hotels.use-case.ts` | `ListHotelsUseCase` |
| `use-cases/get-hotel-detail.use-case.ts` | `GetHotelDetailUseCase` (404 → `ErrorCode.HTL_NOT_FOUND`) |
| `use-cases/get-hotel-rooms.use-case.ts` | `GetHotelRoomsUseCase` |
| `use-cases/index.ts` | barrel |

### 4.B Supporting files

| File | Action |
|------|--------|
| `src/modules/hotels/dto/list-hotels.dto.ts` + `room-availability-query.dto.ts` + `index.ts` | `room-availability-query.dto.ts` validates `checkIn` / `checkOut` (ISO date, `checkOut > checkIn`). |
| `src/modules/hotels/interfaces/hotel-summary.interface.ts` + `hotel-detail.interface.ts` + `room-availability.interface.ts` + `index.ts` | API contract types. |
| `src/modules/hotels/utils/map-hotel.util.ts` + `check-room-overlap.util.ts` + `index.ts` | `checkRoomOverlap(rooms, bookings, checkIn, checkOut)` pure function returns rooms with `available: boolean`. |
| `src/modules/hotels/hotels.controller.ts` | `@Controller('hotels')`. Routes `GET /` · `GET /:id` · `GET /:id/rooms?checkIn=&checkOut=`. |
| `src/modules/hotels/hotels.module.ts` | Providers list the 3 use cases. |
| `src/app.module.ts` | Import `HotelsModule`. |

**Cache TTLs:** list = 300 s, detail = 600 s, **rooms = 3600 s** (per `docs/modules/hotel-booking/api.yaml` `x-nfr-cache-ttl: 3600`). Rooms cache key includes the date range.

### 4.C Per-module gate (do not skip)

1. `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
2. Run the **Hotels** smoke commands from `validation.md` (`GET /v1/hotels`, `GET /v1/hotels/:id/rooms?checkIn=…&checkOut=…`)
3. `redis-cli TTL <hotel-rooms-key>` returns ~3600
4. **Stop here.** Do not start Group 5 (Guides) until the gate passes.

---

## Group 5 — GuidesModule (3 use cases)

> **Goal:** Guides list/detail plus availability. **Do not start until Group 4 has passed its per-module gate.**

### 5.A Use cases — one file per endpoint

| File | Class |
|------|-------|
| `use-cases/list-guides.use-case.ts` | `ListGuidesUseCase` (filters: `language?`, `speciality?`) |
| `use-cases/get-guide-detail.use-case.ts` | `GetGuideDetailUseCase` (404 → `ErrorCode.GUI_NOT_FOUND`) |
| `use-cases/get-guide-availability.use-case.ts` | `GetGuideAvailabilityUseCase` |
| `use-cases/index.ts` | barrel |

### 5.B Supporting files

| File | Action |
|------|--------|
| `src/modules/guides/dto/list-guides.dto.ts` + `availability-query.dto.ts` + `index.ts` | `availability-query.dto.ts` validates `from` / `to` (ISO date, `to > from`, range ≤ 90 days). |
| `src/modules/guides/interfaces/guide-summary.interface.ts` + `guide-detail.interface.ts` + `availability.interface.ts` + `index.ts` | API contract types. |
| `src/modules/guides/utils/map-guide.util.ts` + `availability.util.ts` + `index.ts` | `availability.util.ts` returns busy date ranges from a list of confirmed bookings. |
| `src/modules/guides/guides.controller.ts` | `@Controller('guides')`. Routes `GET /` · `GET /:id` · `GET /:id/availability?from=&to=`. |
| `src/modules/guides/guides.module.ts` | Providers list the 3 use cases. |
| `src/app.module.ts` | Import `GuidesModule`. |

**Cache TTLs:** list = **300 s** and availability = **300 s** (per `docs/modules/tour-guide/api.yaml`); detail = 600 s.

### 5.C Per-module gate (do not skip)

1. `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
2. Run the **Guides** smoke commands from `validation.md` (`GET /v1/guides?language=zh`, `GET /v1/guides/:id/availability?from=…&to=…`)
3. `redis-cli KEYS 'cat:guide:*'` populated
4. **Stop here.** Do not start Group 6 (Transportation) until the gate passes.

---

## Group 6 — TransportationModule (3 use cases)

> **Goal:** Vehicle list/detail plus availability. **Do not start until Group 5 has passed its per-module gate.**

### 6.A Use cases — one file per endpoint

| File | Class |
|------|-------|
| `use-cases/list-vehicles.use-case.ts` | `ListVehiclesUseCase` (filter: `type` ∈ VAN \| BUS \| TUKTUK) |
| `use-cases/get-vehicle-detail.use-case.ts` | `GetVehicleDetailUseCase` (404 → `ErrorCode.TRN_NOT_FOUND`) |
| `use-cases/get-vehicle-availability.use-case.ts` | `GetVehicleAvailabilityUseCase` |
| `use-cases/index.ts` | barrel |

### 6.B Supporting files

| File | Action |
|------|--------|
| `src/modules/transportation/dto/list-vehicles.dto.ts` + `availability-query.dto.ts` + `index.ts` | Class-validator decorators; `type` is an enum. |
| `src/modules/transportation/interfaces/vehicle-summary.interface.ts` + `vehicle-detail.interface.ts` + `availability.interface.ts` + `index.ts` | API contract types. |
| `src/modules/transportation/utils/map-vehicle.util.ts` + `availability.util.ts` + `index.ts` | `availability.util.ts` shape mirrors the guides version. **Intentional per-module copy** — promote to shared kernel only when a third consumer appears. |
| `src/modules/transportation/transportation.controller.ts` | `@Controller('transportation/vehicles')`. Routes `GET /` · `GET /:id` · `GET /:id/availability?from=&to=`. |
| `src/modules/transportation/transportation.module.ts` | Providers list the 3 use cases. |
| `src/app.module.ts` | Import `TransportationModule`. |

**Cache TTLs:** list = 300 s, detail = 600 s, availability = 120 s.

### 6.C Per-module gate (do not skip)

1. `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
2. Run the **Transportation** smoke commands from `validation.md` (`GET /v1/transportation/vehicles?type=VAN`, availability check)
3. `redis-cli KEYS 'cat:vehicle:*'` populated
4. **Stop here.** Do not start Group 7 (Search) until the gate passes.

---

## Group 7 — SearchModule (DB stub) — 1 use case

> **Goal:** Single endpoint the AI agent and frontend share. Meilisearch deferred. **Do not start until Group 6 has passed its per-module gate.**

| # | File | Class / purpose |
|---|------|-----------------|
| 7.1 | `src/modules/search/use-cases/global-search.use-case.ts` | `GlobalSearchUseCase`. `execute(query: SearchQueryDto, lang: Lang): Promise<PaginatedResponse<SearchHit>>`. When `type=all`, runs 4 parallel `prisma.findMany` calls (`OR: [{ title: { contains: q, mode: 'insensitive' } }, { tags: { has: q } }]` per table) then merges with a `kind` discriminator (`'trip' \| 'place' \| 'hotel' \| 'guide'`). When `type` is specified, only that table. Caps each sub-query at `limit / typesQueried`. |
| 7.2 | `src/modules/search/use-cases/index.ts` | Barrel. |
| 7.3 | `src/modules/search/dto/search-query.dto.ts` | `q: string @IsNotEmpty @MinLength(2)`, `type?: 'trip'\|'place'\|'hotel'\|'guide'\|'all'`, plus shared pagination. |
| 7.4 | `src/modules/search/dto/index.ts` | Barrel. |
| 7.5 | `src/modules/search/interfaces/search-hit.interface.ts` + `index.ts` | Discriminated-union type. |
| 7.6 | `src/modules/search/utils/merge-search-results.util.ts` + `index.ts` | Pure helper that flattens the per-table results into the unified shape. |
| 7.7 | `src/modules/search/search.controller.ts` | `@Controller('search')`. `GET /` (`@Public()`). One-line handler. |
| 7.8 | `src/modules/search/search.module.ts` | Imports `PrismaModule`, `RedisModule`, `CommonModule`; provides `GlobalSearchUseCase`. |
| 7.9 | `src/app.module.ts` | Import `SearchModule`. |

**Cache TTL:** 60 s.

**Edge cases handled inside the use case:**
- `q.length < 2` → throw `BadRequestException({ code: ErrorCode.SRC_QUERY_TOO_SHORT, message: 'Query must be at least 2 characters' })`. (Validation also catches this in DTO; the use-case check is defence in depth.)
- Empty results → return `{ items: [], page, limit, total: 0 }` (200 OK, never 404).

### 7.10 Per-module gate (do not skip)

1. `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
2. Run the **Search** smoke commands from `validation.md` (`GET /v1/search?q=angkor`, `GET /v1/search?q=a` → 400, `GET /v1/search?q=zzznoresult` → 200 with `items: []`)
3. `redis-cli KEYS 'cat:search:*'` populated; TTL ~60 s
4. **Stop here.** Do not start Group 8 (cleanup) until the gate passes.

---

## Group 8 — Cross-cutting cleanup & DoD checks

| # | Item | Action |
|---|------|--------|
| 8.1 | `src/common/errors/error-codes.ts` | Add any missing codes referenced above (`SRC_QUERY_TOO_SHORT`, `TRP_NOT_FOUND`, `PLC_NOT_FOUND`, `HTL_NOT_FOUND`, `GUI_NOT_FOUND`, `TRN_NOT_FOUND`). Use the existing `ErrorCode` registry — match the `AUTH_*` style. |
| 8.2 | `backend/.env.example` | Add `FRONTEND_URL` if not present (used by `GetTripShareUrlUseCase`). |
| 8.3 | `src/config/env.validation.ts` | Validate `FRONTEND_URL` (default `http://localhost:3000`). |
| 8.4 | `npm run lint` | Zero errors / warnings. |
| 8.5 | `npm run build` | Compiles clean. |
| 8.6 | `npx tsc --noEmit` | No type errors. |
| 8.7 | Manual smoke (per `validation.md`) | All curl commands succeed against a freshly-seeded local DB. |
| 8.8 | `backend/context/plans/PROGRESS-TRACKER.md` | Mark Phase 4 deliverables 🟢 Complete. Add note: "Tests deferred — see follow-up branch." |

---

## Files to Create / Modify

### Use-case files (19 across 6 modules)

| Module | Use cases |
|--------|-----------|
| trips | `list-trips`, `get-trip-detail`, `get-related-trips`, `get-trip-share-url` |
| places | `list-places`, `get-place-detail`, `get-related-places`, `get-nearby-trips`, `get-nearby-places` |
| hotels | `list-hotels`, `get-hotel-detail`, `get-hotel-rooms` |
| guides | `list-guides`, `get-guide-detail`, `get-guide-availability` |
| transportation | `list-vehicles`, `get-vehicle-detail`, `get-vehicle-availability` |
| search | `global-search` |

### Per-module supporting files (×6 modules)

```
src/modules/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  dto/
    <action>.dto.ts (one per write/list/filter)
    index.ts
  interfaces/
    <thing>.interface.ts
    index.ts
  use-cases/
    <action>.use-case.ts (per table above)
    index.ts
  utils/
    <helper>.util.ts (mappers; haversine for places; overlap for hotels/guides/transport)
    index.ts
```

### Shared kernel additions

```
src/common/i18n/
  accept-language.helper.ts
  index.ts
src/common/cache/
  cached.service.ts
  cache-keys.ts
  index.ts
```

### Modified files

```
src/common/common.module.ts        — provide CachedService + i18n re-export
src/common/dto/list-query.dto.ts   — extend with shared catalog filters
src/common/errors/error-codes.ts   — add missing TRP_/PLC_/HTL_/GUI_/TRN_/SRC_ codes
src/config/env.validation.ts       — validate FRONTEND_URL
src/app.module.ts                  — import 6 new modules
backend/.env.example               — add FRONTEND_URL if missing
backend/context/plans/PROGRESS-TRACKER.md — mark Phase 4 progress
```

---

## Cache TTL Summary

| Endpoint | TTL | Source |
|----------|-----|--------|
| `GET /v1/trips` (list) | 300 s | default |
| `GET /v1/trips/:id` (detail) | 600 s | default |
| `GET /v1/trips/:id/related` | 600 s | default |
| `GET /v1/trips/:id/share` | 86 400 s | default |
| `GET /v1/places` (list) | 300 s | default |
| `GET /v1/places/:id` (detail) | 600 s | default |
| `GET /v1/places/:id/related` | 600 s | default |
| `GET /v1/places/:id/nearby-*` | 300 s | default |
| `GET /v1/hotels` (list) | 300 s | default |
| `GET /v1/hotels/:id` (detail) | 600 s | default |
| `GET /v1/hotels/:id/rooms` | **3600 s** | `docs/modules/hotel-booking/api.yaml` |
| `GET /v1/guides` (list) | **300 s** | `docs/modules/tour-guide/api.yaml` |
| `GET /v1/guides/:id` (detail) | 600 s | default |
| `GET /v1/guides/:id/availability` | **300 s** | `docs/modules/tour-guide/api.yaml` |
| `GET /v1/transportation/vehicles` (list) | 300 s | default |
| `GET /v1/transportation/vehicles/:id` (detail) | 600 s | default |
| `GET /v1/transportation/vehicles/:id/availability` | 120 s | default |
| `GET /v1/search` | 60 s | default |

---

## Risk & Decisions

| Decision | Rationale |
|----------|-----------|
| **Use-case pattern** mirroring `src/modules/auth/` | User direction. One class per endpoint, single `execute()`, no `<feature>.service.ts`. Makes future test isolation trivial and matches the rest of the codebase. |
| `src/modules/<feature>/` path | Match Phase 3; do not retroactively reorganise. |
| `CachedService` is a shared-kernel service, not a use case | Cross-cutting infrastructure, identical to `PrismaService` / `RedisService`. Use cases consume it via constructor injection. |
| `parseAcceptLanguage` is a pure helper | Stateless; fits `src/common/i18n/` next to the existing common utilities. |
| DB-stub search | Roadmap §4.6 explicit. Meilisearch is a separate project. |
| No tests in this branch | User direction. Follow-up branch must restore coverage gates before merge to main. |
| Naive overlap check for availability | Phase 5 owns hold-aware availability. This branch answers "are there confirmed bookings overlapping these dates?" only — implemented as a pure function in `utils/`. |
| `Accept-Language` header (not query param) | Matches `MISSION.md` § Target State and `CONSTITUTION.md` standard HTTP idiom. |
| `ErrorCode` (singular) registry, not `ErrorCodes` | Match the existing `src/modules/auth/` imports — `import { ErrorCode } from '../../../common/errors/error-codes'`. |

---

## Definition of Done

- [ ] **Code matches `src/modules/auth/` layout** — every catalog module has `module / controller / dto/ / interfaces/ / use-cases/ / utils/` with barrels, **no `<feature>.service.ts`**.
- [ ] One `*UseCase` class per endpoint, single public `execute()` method.
- [ ] Use cases inject only `PrismaService`, `RedisService`, `CachedService`, or sibling use cases.
- [ ] Controllers are thin: DTO in → `useCase.execute()` → return.
- [ ] Errors thrown via Nest exceptions with `{ code: ErrorCode.XXX, message }`.
- [ ] All endpoints listed above respond `200` with the `{ success, data }` envelope.
- [ ] Pagination works (`page`, `limit` clamp at 100).
- [ ] `Accept-Language: zh` returns Chinese translations when present, English fallback otherwise.
- [ ] `404` is returned for missing IDs with the documented error code.
- [ ] Redis caching active: second identical request hits cache (verifiable via `redis-cli KEYS 'cat:*'`).
- [ ] Per-endpoint TTLs match the table above; documented values from `api.yaml` are honoured.
- [ ] `npm run lint` and `npm run build` clean; `npx tsc --noEmit` clean.
- [ ] List endpoints return < 300 ms p95 (informal `time curl` smoke; not gated).
- [ ] Detail endpoints return < 200 ms p95 (same).
- [ ] `PROGRESS-TRACKER.md` updated with Phase 4 status and the "tests deferred" note.
- [ ] No tests added in this branch — explicitly tracked as a follow-up.
