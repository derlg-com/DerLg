Plan written to `/home/rayu/.rayu/plans/generic-hatching-nova-agent-a91b13c4c2e6d9ff5.md`. Note: plan mode blocked writing `/home/rayu/DerLg/web/.rayu/swarm/shared.json` — its exact contents are below, ready to write at execution start.

---

## Objective
Two-phase build on the existing DerLg stack: Phase 1 = catalog schema upgrade (P1 hotel type, P2 guide languages/specialties/trip-packages, P3 transport tiers) + AI reliability and AI-composed custom trips (P6). Phase 2 = booking history/detail (P7), multi-item booking composer (P8), loyalty + reviews (P9), unified Explore (P4), palette refine (P5). Touch only `backend/`, `vibe-booking/`, `web/`.

## Stack Decision (documented, not re-litigated)
- Backend: NestJS 11 + Prisma + existing PostgreSQL on localhost:54322 (no new DB); API envelope `{success,data,message,error}`; JWT for `/v1/*`, `X-Service-Key` for `/v1/ai-tools/*`.
- Web: Next.js 16 App Router + Tailwind v4 (CSS tokens in `web/app/globals.css`) + next-intl + zod + react-query; data via `web/lib/api/client.ts` `request<T>`; blocks via `block-renderer.tsx` registry.
- AI: FastAPI + hand-rolled tool loop (`agent/tools/_defs.py` + `TOOL_DISPATCH` → `ai-tools.controller.ts`), NOT LangGraph; normalizers in `agent/core.py`.
- Ports 4007/4008/4009 via shell env overrides; `pm:npm`.

## Findings (verified by reading code)
- `schema.prisma` confirmed: `BookingType` (:68, 4 values), `SupportedLanguage` (:173, en|zh|km), `VehicleType` (:202, tuk_tuk|van|bus), Hotel (:479, no type), GuideSpeciality free-text (:620), `User.loyaltyPoints` (:259), `LoyaltyTransaction` (:858), `Review` (:993, no bookingId). No Restaurant model exists.
- Backend module pattern: `src/modules/<x>/{dto,interfaces,use-cases,utils}`; `forbidNonWhitelisted` means every new query param must be in the DTO or requests 400.
- AI tool contract: `_defs.py` ALL_TOOLS + `TOOL_DISPATCH` map (snake_case names, e.g. `search_hotels` → `GET ai-tools/hotels`); `api/websocket.py:149-152` hardcodes the "Something went wrong" catch-all; `searchGuides` casts language `as 'en'|'zh'|'km'` (ai-tools.service.ts:116) — blocks new languages.
- Web already has `web/lib/api/bookings.ts`, `web/hooks/use-bookings.ts` (useBookings/useBooking/useCreateBooking, unused), `web/schemas/booking.ts`, stub pages `bookings/page.tsx`, `bookings/[id]/page.tsx`, `booking/new/page.tsx`, `loyalty/page.tsx`. `resources.ts` has NO bookings/loyalty/reviews API. Palette: accent `oklch(62% 0.203 25)`.

## Approach
One decisive choice per problem, all additive/low-risk: nullable enum columns for P1/P3 (no data rewrite), enum-extension + implicit m2m for P2 (drop `guide_specialities` — seed-only data), AI tool + `POST /v1/ai-tools/trips` creating a real `Trip` row with new `extras Json` column (authoritative server-side pricing) for P6b, `Restaurant` model + enum extension for P8, `Review.bookingId` + `LoyaltyAward` for P9. Alternative considered: free-form "package" strings or a separate custom-trip table — rejected (breaks existing browse/detail pages and the trips module stays read-only). All new zod fields optional so additive backend changes never break parsing.

## Implementation Plan (full detail in plan file)

**Phase 1**
- **P1**: `enum HotelType {budget,standard,luxury,resort}` + `Hotel.type?` (+index); filter in `list-hotels.dto.ts`, use-case, mappers; ai-tools `searchHotels` + `SearchHotelsDto.type`; seed 05-hotels; web: `domain.ts` `type: z.string().optional()`, `HotelFilters.type`, browse filter chips, `PayloadHotelSchema.type`. Migration `add_hotel_type`.
- **P2**: `SupportedLanguage` += `ja,ko,fr,de,es,th,vi`; `enum Specialty {culture_history,food_tours,nature_trekking,photography,family_friendly,business,luxury,adventure}`; replace `GuideSpeciality` model with `GuideSpecialty`; implicit m2m `Guide.trips ↔ Trip.guides`; `list-guides.dto.ts` widen language + `specialty?`/`tripId?` filters; mapper + summary add `specialties`, `tripCount`; detail adds `packages`; ai-tools drop cast (:116) + add `packages`; guide seed rewrite; web guide detail "Packages" section. Migration `guide_languages_specialties_packages`.
- **P3**: `enum VehicleTier {standard,vip}` + `enum VehicleSubtype {starex,hiace,alphard,small_bus,big_bus}` + `tier?`/`subtype?` on `TransportationVehicle`; hierarchy van+standard→Starex, van+vip→Hiace/Alphard, bus→small(25)/big(45); DTO `tier?`/`subtype?` filters; ai-tools `searchTransport` + `tier?`; seed; web filters/badges. Migration `vehicle_tier_subtype`.
- **P6a**: `.env` MODEL_LLM→`nvidia/gpt-oss-120b`; `MODEL_TIMEOUT_S≈25`, retries 4→2; `websocket.py:149-152` structured error frames (+`retryable`, `code`); `core.py` fallbacks include cause; startup log. **Gotcha: relaunch uvicorn with shell-exported `NVIDIA_API_KEY` unset.**
- **P6b**: `TripCategory` += `custom`, `Trip.extras Json?` (migration `custom_trips`); `POST /v1/ai-tools/trips` (X-Service-Key) — DTO `{title, description?, duration_days, start_date?, hotel_room_id?, guide_id?, vehicle_id?, extras:[{name, description?, unit_price_usd, quantity}]}`, server-side pricing, extras capped at 500/unit, returns `{id, title, duration_days, total_usd, items, extras}`; `_defs.py` tool `create_trip` + `TOOL_DISPATCH["create_trip"]=("POST","ai-tools/trips")` + handler + `_norm_custom_trip`; web `CustomTripCardPayloadSchema` + `custom_trip_card` renderer (`components/chat/payloads/rich/custom-trip-card.tsx`) linking to `/trips/[id]`.

**Phase 2** (order: P8 schema → P7 → P9 → P4/P5)
- **P8**: `BookingType` += `restaurant, extra`; new `Restaurant` model + `BookingItem.restaurantId`; new `restaurants` module (`GET /v1/restaurants` + detail); `create-template-booking.dto.ts` — `resourceId` optional for `extra`, add `name`/`description`; use-case creates restaurant/extra items (extra = snapshot, no FK). Migration `booking_types_restaurant`.
- **P7**: `list-bookings.use-case.ts` include items via shared `map-booking.util.ts` mapping; web `/bookings` list via `useBookings` + new `components/bookings
…[truncated]
