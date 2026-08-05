# BACKEND — Phase 1 Contract (P1, P2, P3, P6)

> Owner: backend collaborator. Everything here is implemented, migrated, seeded, tested (backend `npm test` 135/135, `pytest` 167 passed) and smoke-verified on the live services (backend :4007, vibe-booking :4009).

## Stack (verbatim)

typescript; backend=NestJS 11 + Prisma + PostgreSQL on localhost:54322 (pre-existing DB); ai=Python 3.12 FastAPI hand-rolled tool loop (`agent/tools/_defs.py` + `TOOL_DISPATCH`); pm:npm; envelope `{success,data,message,error}`; `/v1` JWT, `/v1/ai-tools` X-Service-Key; dev ports 4007 (backend) / 4008 (web) / 4009 (vibe-booking).

## Migrations (4, applied to the live DB)

| Migration | Contents |
|---|---|
| `add_hotel_type` | `hotel_type` enum (resort boutique hotel guesthouse hostel villa) + `hotels.type` + index |
| `guide_languages_specialties_packages` | `supported_language` += ja ko fr de es th vi; `specialty` enum (culture_history food_tours nature_trekking photography family_friendly business luxury adventure); `guide_specialities` DROPPED → `guide_specialties` (enum); implicit m2m `_GuideToTrip` (Guide.trips ↔ Trip.guides) |
| `vehicle_tier_subtype` | `vehicle_tier` (normal vip) + `vehicle_subtype` (starex hiace alphard small_bus big_bus) + `transportation_vehicles.tier/subtype` + indexes |
| `custom_trips` | `trip_category` += custom; `trips.extras` JSONB |

Note: the live DB predates the migration history (was `db push`-ed) — I marked the 3 legacy migrations applied via `migrate resolve` and added a `baseline_sync` migration so the folder is coherent for fresh DBs; `migrate dev` still can't run on this DB (pre-existing drift on the polluted `users` table — left untouched). Schema mirror updated in `backend/context/specs/SCHEMA.md`.

## Catalog API deltas (public, /v1)

### GET /v1/hotels — new filter + field
- Query: `type` (`resort|boutique|hotel|guesthouse|hostel|villa`, optional, enum-validated — `forbidNonWhitelisted` enforced)
- `HotelSummary` += `type: string | null` (camelCase, additive)

### GET /v1/guides — new filters + fields (BREAKING rename inside)
- Query: `specialty` (enum, replaces free-text `speciality`); `tripId` (UUID string, filters guides running that package)
- `GuideSummary`/`GuideDetail`:
  - `specialities: string[]` → **RENAMED to `specialties: string[]`** (enum values). Frontend zod already has both keys (`specialties` + legacy `specialities` nullish) — data now arrives under `specialties`.
  - `languages` now can contain ja/ko/fr/de/es/th/vi
  - += `packages: GuidePackage[]` = `[{ id, name, coverImageUrl, durationDays, priceUsd, category, location }]` (location is always `null`; Trip has no location column)

### GET /v1/transportation/vehicles — new filters + fields
- Query: `tier` (`normal|vip`), `subtype` (`starex|hiace|alphard|small_bus|big_bus`), both optional enum-validated
- `VehicleSummary`/`VehicleDetail` += `tier: string | null`, `subtype: string | null`

## NEW endpoint — POST /v1/ai-tools/trips (X-Service-Key)

Composes + persists an AI custom trip. Pricing is server-side: hotel room/guide/vehicle per-day rates × `duration_days`; extras capped at $500/unit (DTO). Creates a real `Trip` row (`category=custom`, `isPublished=true`, EN translation, `extras` JSON, guide linked via m2m when `guide_id` given). 201 on success.

Request (snake_case):
```json
{
  "title": "3-day Siem Reap custom",
  "description": "optional",
  "duration_days": 3,
  "start_date": "2026-08-10",          // optional
  "hotel_room_id": "uuid",             // optional (at least one component or extras required)
  "guide_id": "uuid",                  // optional
  "vehicle_id": "uuid",                // optional
  "extras": [{ "name": "Sunrise photo session", "description": "opt", "unit_price_usd": 40, "quantity": 1 }]
}
```

Response `data` (snake_case):
```json
{
  "id": "trip-uuid",
  "title": "...",
  "description": "... | null",
  "duration_days": 3,
  "total_usd": 850,
  "items": [{ "type": "hotel|guide|transport", "name": "...", "unit_price_usd": 120, "quantity": 3, "subtotal_usd": 360 }],
  "extras": [{ "name": "...", "description": "...|null", "unit_price_usd": 40, "quantity": 1, "subtotal_usd": 40 }],
  "start_date": "..."                  // echoed only if provided
}
```

Errors (registered in ERROR-REGISTRY.md + error-codes.ts): `AI_TRIP_EMPTY` (400, no components/extras), `AI_TRIP_COMPONENT_NOT_FOUND` (404).

## AI agent (vibe-booking) — P6

- `.env`: `MODEL_LLM=openai/gpt-oss-120b`, `MODEL_TIMEOUT_S=90` (DEVIATION from planned 25: gpt-oss-120b is a reasoning model with measured 60–90 s latency on NVIDIA's free tier; 25 s made every call fail. Retries 4→2 so a dead model still surfaces fast.)
- `nvidia.py`: `_MAX_ATTEMPTS=2`, timeout from settings, hardened against empty `choices` stream frames (was crashing with IndexError mid-stream).
- `websocket.py`: error path now emits `{type:"error", code:"AGENT_INTERNAL_ERROR", message, retryable:true}` (was the hardcoded string).
- `core.py`: fallback text includes a user-safe cause; `_norm_custom_trip` snake→camel normalizer; `build_content_payloads` emits `custom_trip_card`; post-answer enrichment (suggestions/blurbs) bounded by a 25 s timeout so `final` is never delayed minutes by the slow model.
- `_defs.py`: new tool `create_trip` (params mirror the DTO) + `TOOL_DISPATCH["create_trip"]=("POST","ai-tools/trips")`.
- `templates.py`: system prompt gains a CUSTOM TRIPS section (search components first, then create_trip, never fabricate ids/prices).
- `main.py`: startup log `model_configured` (model/backend/timeout_s).
- Relaunched on :4009 with `NVIDIA_API_KEY` UNSET (the .env key is used; shell-exported key would 403).

## Agent → web payload contract (custom_trip_card)

`content_payloads[]` may now contain `{type:"custom_trip_card", data: {...}}` (camelCase, from `_norm_custom_trip`):
```ts
{ id, title, description?, durationDays, totalUsd,
  items?: [{ type, name, unitPriceUsd, quantity }],
  extras?: [{ name, description?, unitPriceUsd, quantity }],
  startDate? }
```
Empty `extras`/`items` keys are OMITTED (not null) — zod fields must be optional. "Book this trip" links to `/trips/[id]` (custom trips are published, so the public detail renders).

## Seed (re-run `npm run prisma:seed`)

- 05-hotels: 5 hotels with types (Sokha=resort, Park Hyatt=hotel, Raffles=hotel, Belmond=boutique, Shinta Mani=boutique).
- 06-transportation: van+normal→Starex(9); van+vip→Hiace(10)/Alphard(7); bus→small_bus(25)/big_bus(45); tuk_tuk unchanged.
- 07-guides: 4 guides, enum specialties, widened languages (Dara: en/zh/ja/ko/km; Sopheap: en/zh/fr/km), idempotent (deletes prior seed guides+users).
- 08-trips: links guides→trips by province (Angkor Classic→Siem Reap guides; Cambodia Highlights→SR+PP; Culinary→PP; Beach Escape→Kampot; Adventure→none).

## Ops notes

- Backend on :4007 (nest watch, auto-reloaded; new Prisma client generated).
- vibe-booking on :4009, started WITHOUT `--reload` (the reloader got stuck waiting on slow in-flight LLM calls; restart with `env -u NVIDIA_API_KEY ... .venv/bin/uvicorn main:app --port 4009` if it dies).
- Do not run `prisma migrate dev` on this DB (will demand a destructive reset); use `prisma db execute` + `migrate resolve` for future schema changes.
- Known pre-existing issue (out of scope): live `users` table has Supabase-auth leftovers; schema columns were added to match schema.prisma (password_hash/status added as columns — safe).
