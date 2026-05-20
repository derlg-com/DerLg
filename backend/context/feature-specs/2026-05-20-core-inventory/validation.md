# Validation: Core Inventory

> **Branch:** `feature/2026-05-20-core-inventory`
> **Phase:** 4 (Core Inventory)
> **Test posture:** **Tests deferred** to a follow-up branch per user direction. This document defines the minimum bar for "is the implementation working?" — manual smoke + build/lint gates only. Automated coverage gates from `TEST-PLAN.md` remain unfulfilled and must be restored before this code merges to `main`.

---

## Verification Criteria

### Build & static checks (gating)
- [ ] `npm run lint` — zero errors and zero warnings
- [ ] `npm run format` — repo formatted
- [ ] `npm run build` — TypeScript compiles cleanly
- [ ] `npx tsc --noEmit` — zero type errors

### Endpoint behaviour (manual smoke — gating)
- [ ] `GET /v1/trips` — returns paginated list, `{ success, data: { items, page, limit, total } }`
- [ ] `GET /v1/trips/:id` — returns detail with itinerary; `404` + `TRP_NOT_FOUND` for unknown id
- [ ] `GET /v1/trips/:id/related` — returns ≤ 6 trips, excludes self
- [ ] `GET /v1/trips/:id/share` — returns canonical share URL
- [ ] `GET /v1/places` — paginated list
- [ ] `GET /v1/places/:id` — detail; `404` + `PLC_NOT_FOUND` for unknown id
- [ ] `GET /v1/places/:id/nearby-trips` and `nearby-places` — return resources within radius
- [ ] `GET /v1/hotels` — paginated list
- [ ] `GET /v1/hotels/:id` — detail; `404` + `HTL_NOT_FOUND` for unknown id
- [ ] `GET /v1/hotels/:id/rooms?checkIn=&checkOut=` — returns rooms with availability flag
- [ ] `GET /v1/guides` — paginated list, supports `?language=` and `?speciality=` filters
- [ ] `GET /v1/guides/:id` — detail; `404` + `GUI_NOT_FOUND` for unknown id
- [ ] `GET /v1/guides/:id/availability?from=&to=` — returns busy dates
- [ ] `GET /v1/transportation/vehicles` — paginated list, `?type=VAN|BUS|TUKTUK`
- [ ] `GET /v1/transportation/vehicles/:id` — detail; `404` + `TRN_NOT_FOUND` for unknown id
- [ ] `GET /v1/transportation/vehicles/:id/availability?from=&to=` — returns busy dates
- [ ] `GET /v1/search?q=angkor` — returns mixed results with `kind` discriminator
- [ ] `GET /v1/search?q=a` — returns `400` + `SRC_QUERY_TOO_SHORT`
- [ ] `GET /v1/search?q=zzznoresult` — returns `200` with `items: []`

### Caching behaviour (manual smoke — gating)
- [ ] First request to any list/detail endpoint logs `cache MISS` (debug log)
- [ ] Identical second request within TTL logs `cache HIT`
- [ ] `redis-cli KEYS 'cat:*'` lists keys created by the requests above
- [ ] Hotel rooms TTL is 3600 s; tour guide list/availability TTL is 300 s (verified with `redis-cli TTL <key>`)

### i18n behaviour (manual smoke — gating)
- [ ] `Accept-Language: zh` returns `*Translation` rows where `lang = 'zh'`
- [ ] `Accept-Language: km` returns Khmer rows
- [ ] Missing translation falls back to English row
- [ ] No `Accept-Language` header defaults to English

### Performance (informational, not gating)
- [ ] List endpoints respond in < 300 ms (warm cache) on local Supabase + local Redis (`time curl …`)
- [ ] Detail endpoints respond in < 200 ms (warm cache)
- [ ] Cold-start (cache MISS) numbers recorded in PR description for tracking — no failure threshold

### Out-of-scope (explicit non-criteria)
- ❌ Automated unit tests
- ❌ Automated E2E tests
- ❌ Property-based tests
- ❌ Coverage thresholds
- ❌ Booking creation against any catalog resource (Phase 5)
- ❌ Reviews / favorites surfaces (Phase 7)
- ❌ Geospatial PostGIS — naive Haversine is fine

---

## Test Plan

**Deliberately empty.** Tests will be authored in a follow-up branch before this code is merged to `main`. The follow-up branch must restore the coverage gates from `backend/context/plans/TEST-PLAN.md`:

- ≥ 80 % unit coverage on each catalog module's service
- E2E coverage for list + detail per module (one happy path + one 404)
- Cache-hit assertion on at least one endpoint per module

---

## Manual Verification Script

> Assumes Postgres + Redis up and at least one `Trip`, `Place`, `Hotel`, `HotelRoom`, `Guide`, `TransportationVehicle` row in the local DB. If `Phase 2` seed has not landed, insert one row each via `npx prisma studio` or a one-off `prisma.*.create` script before running.

```bash
cd backend && npm run start:dev
# Server boots on :3001

# Trips
curl -s http://localhost:3001/v1/trips | jq .
curl -s "http://localhost:3001/v1/trips?page=1&limit=5&category=temple" | jq .
curl -s http://localhost:3001/v1/trips/<trip-id> -H "Accept-Language: zh" | jq .
curl -s http://localhost:3001/v1/trips/<trip-id>/related | jq .
curl -s http://localhost:3001/v1/trips/<trip-id>/share | jq .

# Places
curl -s http://localhost:3001/v1/places | jq .
curl -s http://localhost:3001/v1/places/<place-id>/nearby-trips?radiusKm=20 | jq .

# Hotels
curl -s http://localhost:3001/v1/hotels | jq .
curl -s "http://localhost:3001/v1/hotels/<hotel-id>/rooms?checkIn=2026-06-01&checkOut=2026-06-03" | jq .

# Guides
curl -s "http://localhost:3001/v1/guides?language=zh" | jq .
curl -s "http://localhost:3001/v1/guides/<guide-id>/availability?from=2026-06-01&to=2026-06-30" | jq .

# Transportation
curl -s "http://localhost:3001/v1/transportation/vehicles?type=VAN" | jq .
curl -s "http://localhost:3001/v1/transportation/vehicles/<vehicle-id>/availability?from=2026-06-01&to=2026-06-05" | jq .

# Search
curl -s "http://localhost:3001/v1/search?q=angkor" | jq .
curl -s "http://localhost:3001/v1/search?q=temple&type=trip" | jq .
curl -s "http://localhost:3001/v1/search?q=a" -i        # expect 400 SRC_QUERY_TOO_SHORT
curl -s "http://localhost:3001/v1/search?q=zzznoresult" | jq .   # expect 200 with items: []

# Cache verification
redis-cli KEYS 'cat:*'
redis-cli TTL 'cat:hotel:rooms:<hotel-id>:checkIn=2026-06-01:checkOut=2026-06-03'   # expect ~3600
redis-cli TTL 'cat:guide:list:lang=en:page=1:limit=20'                                # expect ~300

# Performance smoke
time curl -s http://localhost:3001/v1/trips > /dev/null      # warm-cache target: < 300 ms
time curl -s http://localhost:3001/v1/trips/<trip-id> > /dev/null  # warm-cache target: < 200 ms
```

---

## Definition of Done

- [ ] All "Build & static checks" boxes ticked
- [ ] All "Endpoint behaviour" boxes ticked
- [ ] All "Caching behaviour" boxes ticked
- [ ] All "i18n behaviour" boxes ticked
- [ ] Performance smoke numbers attached to PR description (informational)
- [ ] `PROGRESS-TRACKER.md` updated:
  - Phase 4 deliverables marked 🟢 Complete
  - "Tests deferred — follow-up branch required before merge to main" noted under Phase 4
- [ ] Follow-up issue / branch name recorded for the test work (so it is not forgotten)
- [ ] PR description explicitly flags **"⚠️ no tests in this branch"** so the reviewer cannot miss it

---

## Pre-Merge Gate (mandatory before this branch lands on `main`)

> Even though this branch ships without tests, it MUST NOT merge to `main` without them. The follow-up branch is a hard prerequisite.

| Gate | Required artifact |
|------|-------------------|
| `TEST-PLAN.md` § 2 coverage | ≥ 80 % unit coverage on each `*UseCase` class (`src/modules/<feature>/use-cases/*.use-case.spec.ts`) |
| `TEST-PLAN.md` § 3 critical E2E | List + detail per module, cache-hit assertion |
| Code review | Reviewer confirms cache key naming, TTL values, and i18n fallback |
| `PROGRESS-TRACKER.md` | Phase 4 row updated to 🟢 Complete with test-coverage figures |
