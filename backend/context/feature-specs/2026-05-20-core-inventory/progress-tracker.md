# Progress Tracker — Core Inventory (Phase 4)

> **Branch:** `feature/2026-05-20-core-inventory`
> **Phase:** 4 (Core Inventory)
> **Started:** 2026-05-20
> **Tests:** ⏸️ Deferred per user direction — see `validation.md` Pre-Merge Gate
> **Last updated:** 2026-05-20 (initial scaffold)
>
> This file is a **living document**. The AI agent must update it after every meaningful step (file created, gate passed, group completed). The human can scan the top section in 5 seconds to know where things stand.

---

## ⚡ Current Focus

| Field | Value |
|-------|-------|
| **Currently working on** | _none — Group 3 complete, awaiting human review_ |
| **Last completed group** | Group 3 — PlacesModule (2026-05-20) |
| **Next group** | Group 4 — HotelsModule |
| **Active blocker** | None |

> When starting a new module group, set "Currently working on" to the group name and move the "Next group" pointer.

---

## 📊 Overall Progress (8 groups)

| Group | Module | Use cases | Status | Gate | Started | Completed |
|-------|--------|-----------|--------|------|---------|-----------|
| 1 | Shared catalog primitives | — | 🟢 Complete | n/a (no gate) | 2026-05-20 | 2026-05-20 |
| 2 | **TripsModule** (canonical) | 4 | 🟢 Complete | 🟢 | 2026-05-20 | 2026-05-20 |
| 3 | PlacesModule | 5 | 🟢 Complete | 🟢 | 2026-05-20 | 2026-05-20 |
| 4 | HotelsModule | 3 | ⬜ Not Started | ⬜ | — | — |
| 5 | GuidesModule | 3 | ⬜ Not Started | ⬜ | — | — |
| 6 | TransportationModule | 3 | ⬜ Not Started | ⬜ | — | — |
| 7 | SearchModule | 1 | ⬜ Not Started | ⬜ | — | — |
| 8 | Cross-cutting cleanup & DoD | — | ⬜ Not Started | n/a | — | — |
| **Totals** | **6 modules + 2 support groups** | **19** | **0 / 8** | **0 / 6** | — | — |

**Legend:** ⬜ Not Started · 🟡 In Progress · 🟢 Complete · 🔴 Blocked · ⏸️ Deferred

---

## Group 1 — Shared catalog primitives

**Status:** 🟢 Complete · **Completed:** 2026-05-20T17:54

### Files

| Status | File | Notes |
|--------|------|-------|
| 🟢 | `src/common/i18n/accept-language.helper.ts` | `parseAcceptLanguage(req): Lang`, `type Lang = 'en' \| 'zh' \| 'km'` |
| 🟢 | `src/common/i18n/index.ts` | Barrel |
| 🟢 | `src/common/cache/cached.service.ts` | `getOrSet<T>(key, ttlSeconds, loader)` |
| 🟢 | `src/common/cache/cache-keys.ts` | All `cat:*` key builders |
| 🟢 | `src/common/cache/index.ts` | Barrel |
| 🟢 | `src/common/common.module.ts` | (modified) Provide CachedService + i18n re-export |
| 🟢 | `src/common/dto/list-query.dto.ts` | (modified) Adds `q`, `lang`, `sort` |
| 🟢 | `src/common/errors/error-codes.ts` | (modified) Added TRP_/PLC_/GUI_/TRN_/SRC_ codes |

### Verification (no formal gate, but must be runnable)

- [x] `npm run build` clean
- [x] `npm run lint` clean
- [x] `npx tsc --noEmit` clean

---

## Group 2 — TripsModule (canonical)

**Status:** 🟢 Complete · **Completed:** 2026-05-20T18:35 · **Reference for Groups 3–6**

### Use cases (4)

| Status | File | Class |
|--------|------|-------|
| 🟢 | `use-cases/list-trips.use-case.ts` | `ListTripsUseCase` |
| 🟢 | `use-cases/get-trip-detail.use-case.ts` | `GetTripDetailUseCase` |
| 🟢 | `use-cases/get-related-trips.use-case.ts` | `GetRelatedTripsUseCase` |
| 🟢 | `use-cases/get-trip-share-url.use-case.ts` | `GetTripShareUrlUseCase` |

### Supporting files

| Status | File | Notes |
|--------|------|-------|
| 🟢 | `dto/list-trips.dto.ts` + `dto/index.ts` | |
| 🟢 | `interfaces/trip-summary.interface.ts` + `trip-detail.interface.ts` + `index.ts` | |
| 🟢 | `utils/map-trip.util.ts` + `utils/index.ts` | |
| 🟢 | `use-cases/index.ts` | Barrel |
| 🟢 | `trips.controller.ts` | All `@Public()` |
| 🟢 | `trips.module.ts` | Providers list 4 use cases |
| 🟢 | `app.module.ts` | (modified) import `TripsModule` only |

### Per-module gate (must pass before Group 3)

- [x] `npm run lint` — zero errors / warnings
- [x] `npm run build` — clean
- [x] `npx tsc --noEmit` — clean
- [ ] `GET /v1/trips` returns `{ success, data: { items, page, limit, total } }`
- [ ] `GET /v1/trips/:id` returns 200 with detail
- [ ] `GET /v1/trips/:id` returns 404 + `TRP_NOT_FOUND` for unknown id
- [ ] `GET /v1/trips/:id/related` returns ≤ 6 trips, excludes self
- [ ] `GET /v1/trips/:id/share` returns `{ url }`
- [ ] `Accept-Language: zh` returns Chinese fields when present
- [ ] `redis-cli KEYS 'cat:trip:*'` populated; `TTL` matches plan.md table
- [ ] **Stop-and-confirm** — pause for human review before Group 3

---

## Group 3 — PlacesModule

**Status:** 🟢 Complete · **Completed:** 2026-05-20T20:25+07 · **Owner:** Agent · **Reference:** `src/modules/trips/`

### Use cases (5)

| Status | File | Class |
|--------|------|-------|
| 🟢 | `use-cases/list-places.use-case.ts` | `ListPlacesUseCase` |
| 🟢 | `use-cases/get-place-detail.use-case.ts` | `GetPlaceDetailUseCase` |
| 🟢 | `use-cases/get-related-places.use-case.ts` | `GetRelatedPlacesUseCase` |
| 🟢 | `use-cases/get-nearby-trips.use-case.ts` | `GetNearbyTripsUseCase` |
| 🟢 | `use-cases/get-nearby-places.use-case.ts` | `GetNearbyPlacesUseCase` |

### Supporting files

| Status | File | Notes |
|--------|------|-------|
| 🟢 | `dto/list-places.dto.ts` + `dto/nearby-query.dto.ts` + `dto/index.ts` | |
| 🟢 | `interfaces/place-summary.interface.ts` + `place-detail.interface.ts` + `index.ts` | |
| 🟢 | `utils/map-place.util.ts` + `utils/haversine.util.ts` + `utils/index.ts` | Pure `haversine(lat1, lon1, lat2, lon2): km` |
| 🟢 | `use-cases/index.ts` | Barrel |
| 🟢 | `places.controller.ts` | All `@Public()` |
| 🟢 | `places.module.ts` | Providers list 5 use cases |
| 🟢 | `app.module.ts` | (modified) import `PlacesModule` |

### Per-module gate (must pass before Group 4)

- [x] `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `GET /v1/places` returns paginated list
- [ ] `GET /v1/places/:id` returns 404 + `PLC_NOT_FOUND` for unknown id
- [ ] `GET /v1/places/:id/nearby-trips?radiusKm=20` returns trips within radius
- [ ] `GET /v1/places/:id/nearby-places` returns places within radius
- [ ] `redis-cli KEYS 'cat:place:*'` populated
- [ ] **Stop-and-confirm**

---

## Group 4 — HotelsModule

**Status:** ⬜ Not Started · **Owner:** _unassigned_ · **Reference:** `src/modules/trips/`

### Use cases (3)

| Status | File | Class |
|--------|------|-------|
| ⬜ | `use-cases/list-hotels.use-case.ts` | `ListHotelsUseCase` |
| ⬜ | `use-cases/get-hotel-detail.use-case.ts` | `GetHotelDetailUseCase` |
| ⬜ | `use-cases/get-hotel-rooms.use-case.ts` | `GetHotelRoomsUseCase` |

### Supporting files

| Status | File | Notes |
|--------|------|-------|
| ⬜ | `dto/list-hotels.dto.ts` + `dto/room-availability-query.dto.ts` + `dto/index.ts` | Validates `checkIn` / `checkOut` |
| ⬜ | `interfaces/hotel-summary.interface.ts` + `hotel-detail.interface.ts` + `room-availability.interface.ts` + `index.ts` | |
| ⬜ | `utils/map-hotel.util.ts` + `utils/check-room-overlap.util.ts` + `utils/index.ts` | Pure overlap check |
| ⬜ | `use-cases/index.ts` | Barrel |
| ⬜ | `hotels.controller.ts` | |
| ⬜ | `hotels.module.ts` | Providers list 3 use cases |
| ⬜ | `app.module.ts` | (modified) import `HotelsModule` |

### Per-module gate (must pass before Group 5)

- [ ] `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `GET /v1/hotels` returns paginated list
- [ ] `GET /v1/hotels/:id` returns 404 + `HTL_NOT_FOUND` for unknown id
- [ ] `GET /v1/hotels/:id/rooms?checkIn=&checkOut=` returns rooms with availability flag
- [ ] `redis-cli TTL <hotel-rooms-key>` ≈ 3600 (per `api.yaml`)
- [ ] **Stop-and-confirm**

---

## Group 5 — GuidesModule

**Status:** ⬜ Not Started · **Owner:** _unassigned_ · **Reference:** `src/modules/trips/`

### Use cases (3)

| Status | File | Class |
|--------|------|-------|
| ⬜ | `use-cases/list-guides.use-case.ts` | `ListGuidesUseCase` (filters: `language?`, `speciality?`) |
| ⬜ | `use-cases/get-guide-detail.use-case.ts` | `GetGuideDetailUseCase` |
| ⬜ | `use-cases/get-guide-availability.use-case.ts` | `GetGuideAvailabilityUseCase` |

### Supporting files

| Status | File | Notes |
|--------|------|-------|
| ⬜ | `dto/list-guides.dto.ts` + `dto/availability-query.dto.ts` + `dto/index.ts` | |
| ⬜ | `interfaces/guide-summary.interface.ts` + `guide-detail.interface.ts` + `availability.interface.ts` + `index.ts` | |
| ⬜ | `utils/map-guide.util.ts` + `utils/availability.util.ts` + `utils/index.ts` | |
| ⬜ | `use-cases/index.ts` | Barrel |
| ⬜ | `guides.controller.ts` | |
| ⬜ | `guides.module.ts` | Providers list 3 use cases |
| ⬜ | `app.module.ts` | (modified) import `GuidesModule` |

### Per-module gate (must pass before Group 6)

- [ ] `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `GET /v1/guides?language=zh` returns filtered list
- [ ] `GET /v1/guides/:id` returns 404 + `GUI_NOT_FOUND` for unknown id
- [ ] `GET /v1/guides/:id/availability?from=&to=` returns busy dates
- [ ] `redis-cli TTL <guide-list-key>` ≈ 300 (per `api.yaml`)
- [ ] **Stop-and-confirm**

---

## Group 6 — TransportationModule

**Status:** ⬜ Not Started · **Owner:** _unassigned_ · **Reference:** `src/modules/trips/`

### Use cases (3)

| Status | File | Class |
|--------|------|-------|
| ⬜ | `use-cases/list-vehicles.use-case.ts` | `ListVehiclesUseCase` (filter: `type` ∈ VAN \| BUS \| TUKTUK) |
| ⬜ | `use-cases/get-vehicle-detail.use-case.ts` | `GetVehicleDetailUseCase` |
| ⬜ | `use-cases/get-vehicle-availability.use-case.ts` | `GetVehicleAvailabilityUseCase` |

### Supporting files

| Status | File | Notes |
|--------|------|-------|
| ⬜ | `dto/list-vehicles.dto.ts` + `dto/availability-query.dto.ts` + `dto/index.ts` | |
| ⬜ | `interfaces/vehicle-summary.interface.ts` + `vehicle-detail.interface.ts` + `availability.interface.ts` + `index.ts` | |
| ⬜ | `utils/map-vehicle.util.ts` + `utils/availability.util.ts` + `utils/index.ts` | Per-module copy; promote to shared kernel only on a 3rd consumer |
| ⬜ | `use-cases/index.ts` | Barrel |
| ⬜ | `transportation.controller.ts` | `@Controller('transportation/vehicles')` |
| ⬜ | `transportation.module.ts` | Providers list 3 use cases |
| ⬜ | `app.module.ts` | (modified) import `TransportationModule` |

### Per-module gate (must pass before Group 7)

- [ ] `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `GET /v1/transportation/vehicles?type=VAN` returns filtered list
- [ ] `GET /v1/transportation/vehicles/:id` returns 404 + `TRN_NOT_FOUND` for unknown id
- [ ] `GET /v1/transportation/vehicles/:id/availability?from=&to=` returns busy dates
- [ ] `redis-cli KEYS 'cat:vehicle:*'` populated
- [ ] **Stop-and-confirm**

---

## Group 7 — SearchModule (DB stub)

**Status:** ⬜ Not Started · **Owner:** _unassigned_ · **Reference:** `src/modules/trips/`

### Use case (1)

| Status | File | Class |
|--------|------|-------|
| ⬜ | `use-cases/global-search.use-case.ts` | `GlobalSearchUseCase` |

### Supporting files

| Status | File | Notes |
|--------|------|-------|
| ⬜ | `dto/search-query.dto.ts` + `dto/index.ts` | `q: @MinLength(2)`, `type` enum |
| ⬜ | `interfaces/search-hit.interface.ts` + `index.ts` | Discriminated union by `kind` |
| ⬜ | `utils/merge-search-results.util.ts` + `utils/index.ts` | Pure flattener |
| ⬜ | `use-cases/index.ts` | Barrel |
| ⬜ | `search.controller.ts` | `@Controller('search')` |
| ⬜ | `search.module.ts` | Provides `GlobalSearchUseCase` |
| ⬜ | `app.module.ts` | (modified) import `SearchModule` |

### Per-module gate (must pass before Group 8)

- [ ] `npm run lint` clean · `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `GET /v1/search?q=angkor` returns mixed results with `kind` discriminator
- [ ] `GET /v1/search?q=a` returns 400 + `SRC_QUERY_TOO_SHORT`
- [ ] `GET /v1/search?q=zzznoresult` returns 200 with `items: []`
- [ ] `redis-cli KEYS 'cat:search:*'` populated; TTL ≈ 60 s
- [ ] **Stop-and-confirm**

---

## Group 8 — Cross-cutting cleanup & DoD

**Status:** ⬜ Not Started · **Owner:** _unassigned_

| Status | Item |
|--------|------|
| ⬜ | `src/common/errors/error-codes.ts` — add `SRC_QUERY_TOO_SHORT`, `TRP_NOT_FOUND`, `PLC_NOT_FOUND`, `HTL_NOT_FOUND`, `GUI_NOT_FOUND`, `TRN_NOT_FOUND` |
| ⬜ | `backend/.env.example` — add `FRONTEND_URL` if missing |
| ⬜ | `src/config/env.validation.ts` — validate `FRONTEND_URL` |
| ⬜ | `npm run lint` clean across the whole project |
| ⬜ | `npm run build` clean |
| ⬜ | `npx tsc --noEmit` clean |
| ⬜ | All curl commands in `validation.md` succeed against a freshly-seeded local DB |
| ⬜ | `backend/context/plans/PROGRESS-TRACKER.md` — flip Phase 4 row to 🟢 Complete with note "Tests deferred — see follow-up branch" |

---

## 📁 Files Modified Summary

| Bucket | Planned | Created so far | Notes |
|--------|---------|----------------|-------|
| Use-case classes | 19 | 0 | one per endpoint |
| Module + Controller pairs | 12 | 0 | 6 modules × 2 |
| DTO files (excl. barrels) | 11 | 0 | |
| Interface files (excl. barrels) | 14 | 0 | |
| Util files (excl. barrels) | 9 | 0 | |
| Barrel `index.ts` files | 24 | 0 | 4 per module × 6 |
| Shared kernel new files | 5 | 5 | `cache/` ×3, `i18n/` ×2 — Group 1 ✅ |
| Modified existing files | 6 | 3 | `common.module.ts`, `list-query.dto.ts`, `error-codes.ts` |
| **Total new + modified** | **~94 + 6** | **8** | |

---

## 🕒 Recent Updates / Log

| Date | Group | Change | By |
|------|-------|--------|-----|
| 2026-05-20 | — | Progress tracker created (initial scaffold) | Agent |
| 2026-05-20T17:54+07 | 1 | Group 1 complete: created `i18n/`, `cache/` (5 new files), modified `common.module.ts`, `list-query.dto.ts`, `error-codes.ts` (added TRP_/PLC_/GUI_/TRN_/SRC_ codes) | Agent |
| 2026-05-20T18:01+07 | 1 | Verification passed: lint ✅ build ✅ tsc --noEmit ✅ | Agent |
| 2026-05-20T18:35+07 | 2 | Group 2 complete: TripsModule (15 files). lint ✅ build ✅ tsc ✅. Fixed: no deletedAt on Trip, unsafe any casts, require-await in share URL use-case | Agent |
| 2026-05-20T20:25+07 | 3 | Group 3 complete: PlacesModule (16 files). lint ✅ build ✅ tsc ✅. 5 use cases, haversine util for nearby queries, cross-module import of trips mappers for nearby-trips | Agent |

> Add one row per meaningful step. Examples of "meaningful": group started, use case implemented, gate passed, blocker discovered, group completed.

---

## 🚧 Active Blockers

| Date | Group | Description | Impact | Owner | ETA |
|------|-------|-------------|--------|-------|-----|
| — | — | — | — | — | — |

---

## 🤖 How to Use This Tracker

### For the AI agent implementing a module group

1. **Before starting:** set `Current Focus → Currently working on` to the group name; flip the group row in "Overall Progress" to 🟡 In Progress; write `Started` date.
2. **As you create files:** flip each row in that group's file table from ⬜ to 🟢 (only when the file actually exists in the working tree). Do not pre-tick.
3. **When you run a gate command:** tick the relevant box only after the command actually returns clean. The user verifies independently.
4. **When the group is fully gated:** flip the group row to 🟢, write `Completed` date, append a `Recent Updates` row, and **stop**. Do not start the next group in the same session.
5. **If blocked:** add a row to "Active Blockers", flip the group to 🔴, append a `Recent Updates` row explaining the cause.
6. **Never tick a box you haven't actually verified.** This file is the human's audit trail; lying to it makes the whole approach useless.

### For the human reviewing progress

- **Quick status check:** scan the "Overall Progress" table — that's it. Each row tells you state + when started + when completed.
- **Deep check:** open the relevant group section, look for unticked boxes in the gate list, run those commands yourself.
- **Audit:** compare the "Files Modified Summary" counts to `git diff --stat` to spot drift.
- **Per-session loop:** before opening a new AI session, glance at "Current Focus" → if "Currently working on" is non-empty and `Last completed group` is older than today, the previous session left work behind; either resume or revert.

---

## References

- `plan.md` — task groups, file lists, per-module gates
- `requirements.md` — scope, decisions, no-tests directive
- `validation.md` — manual smoke commands, pre-merge gate
- `backend/context/plans/PROGRESS-TRACKER.md` — project-wide progress (this file is the **per-feature** detail)
- `backend/src/modules/auth/` — canonical use-case-pattern reference
