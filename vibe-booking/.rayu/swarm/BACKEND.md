Phase 1 complete. Final report:

## Backend Phase 1 — Done, verified, services live

### Slice 1: catalog-schema (P1/P2/P3)
**Schema** (`backend/prisma/schema.prisma`) — all Phase 1 changes in one pass: enums `HotelType` (resort boutique hotel guesthouse hostel villa), `Specialty` (8 values), `VehicleTier`, `VehicleSubtype`; `SupportedLanguage` += ja ko fr de es th vi; `TripCategory` += custom; `Hotel.type` + index; `Trip.extras Json` + implicit m2m `Guide.trips ↔ Trip.guides` (`_GuideToTrip`); `GuideSpeciality` (free-text) dropped → `GuideSpecialty` (enum); `TransportationVehicle.tier/subtype` + indexes.

**Migrations** — 4 applied to the live DB: `add_hotel_type`, `guide_languages_specialties_packages`, `vehicle_tier_subtype`, `custom_trips` (folders under `backend/prisma/migrations/`). Important: `prisma migrate dev` is **impossible on this DB** (pre-existing drift — it was `db push`-ed, `users` table has Supabase leftovers). I marked the 3 legacy migrations applied, added a `baseline_sync` migration, and applied everything with `prisma db execute` + `migrate resolve`. Zero data loss; DB now diffs empty against the schema.

**Seeds rewritten**: 05-hotels (types), 06-transportation (Starex 9 / Hiace 10 / Alphard 7 / small_bus 25 / big_bus 45, tuk_tuk unchanged), 07-guides (enum specialties, widened languages, idempotent), 08-trips (guide↔trip links by province), dummy-bulk fixed. Reseeded successfully.

**Module code**: hotels/guides/transportation DTOs + use-cases + mappers + interfaces (new filters `type`, `specialty`, `tripId`, `tier`, `subtype`; `packages` on guides; `specialities`→`specialties` rename incl. booking snapshot + specs); global-search switched to `provinces` search; ai-tools service P1-P3 fields, language cast dropped.

### Slice 2: ai-trips (P6b)
`POST /v1/ai-tools/trips` (X-Service-Key, 201) — DTO `{title, description?, duration_days, start_date?, hotel_room_id?, guide_id?, vehicle_id?, extras:[{name, description?, unit_price_usd, quantity}]}` (extras capped $500/unit); server-side pricing (per-day rates × duration + extras); creates a real published `Trip` (`category=custom`, EN translation, extras JSON, guide linked). Returns snake_case `{id, title, description, duration_days, total_usd, items[], extras[]}`. New codes `AI_TRIP_EMPTY` (400), `AI_TRIP_COMPONENT_NOT_FOUND` (404) in `error-codes.ts` + `ERROR-REGISTRY.md`. Smoke: created trip priced 850 = 120×3+40×3+110×3+40, readable via `/v1/trips/:id` (the web "Book this trip" link target).

### Slice 3: vibe-ai (P6a)
`.env` → `MODEL_LLM=openai/gpt-oss-120b`, `MODEL_TIMEOUT_S=90` (**deviation from planned 25, evidence-based**: gpt-oss-120b measured 60–90 s per call on NVIDIA's free tier; 25 s made every turn fail). nvidia.py: retries 4→2, timeout from settings, hardened against empty `choices` stream frames (IndexError bug). websocket.py: structured error frame `{type:"error", code:"AGENT_INTERNAL_ERROR", message, retryable:true}`. core.py: cause-aware fallbacks, `_norm_custom_trip` normalizer, `custom_trip_card` payload branch, enrichment bounded by 25 s so `final` isn't delayed by slow model. `_defs.py`: `create_trip` tool + `TOOL_DISPATCH["create_trip"]=("POST","ai-tools/trips")`; system prompt gains a CUSTOM TRIPS section. 167 pytest pass (new: error-frame + normalizer tests). Relaunched on :4009 with `NVIDIA_API_KEY` unset — **end-to-end WS chat verified with a real gpt-oss-120b answer**.

### Verification
Backend: build ✓, 135/135 jest ✓, lint ✓. Smoke: `?type=resort`, `?tier=vip&subtype=alphard`, `?specialty=food_tours`, guide detail `packages[]`, custom-trip POST ✓. Live services: backend :4007, vibe-booking :4009 (run without `--reload` — the reloader hangs on slow in-flight LLM calls).

### Contract deltas for frontend (also in `/home/rayu/DerLg/.rayu/swarm/BACKEND.md`)
- `HotelSummary.type`; `VehicleSummary.tier/subtype` (additive)
- `GuideSummary`: **`specialities` renamed → `specialties`** (enum values), `languages` may include ja/ko/fr/de/es/th/vi, += `packages[]` `{id,name,coverImageUrl,durationDays,priceUsd,category,location}`
- New chat payload type `custom_trip_card`: `{id,title,description?,durationDays,totalUsd,items?[{type,name,unitPriceUsd,quantity}],extras?[{name,description?,unitPriceUsd,quantity}],startDate?}` — empty items/extras keys are **omitted**, not null

Note: a parallel agent edited the same hotels/transportation files — I merged their work (their changes were correct) and aligned the guide package shape. Coordination state is in `/home/rayu/DerLg/.rayu/swarm/BACKEND.md`.
