Both slices are complete and verified. Final report:

## Phase 1 web work — DONE (both slices)

### Slice A — catalog-browse (P1/P2/P3)

**Files changed:**
- `web/schemas/domain.ts` — zod fields added (all `.nullish()`, additive, parsing-safe pre-migration):
  - `HotelSummary.type` — resort/boutique/hotel/guesthouse/hostel/villa
  - `GuideSummary.specialties` (new enum-backed; legacy `specialities` kept as fallback) + `GuideSummary.packages` (`GuidePackage`: id/name/coverImageUrl/durationDays/priceUsd/category/location, **all nullish** since the backend mapper shape is unverified)
  - `VehicleSummary.tier` (normal/vip) + `VehicleSummary.subtype` (starex/hiace/alphard/small_bus/big_bus)
- `web/lib/api/resources.ts` — `HotelFilters.type`, `GuideFilters.specialty` (**replaces the old `speciality` param**), `VehicleFilters.tier`/`subtype`
- `web/components/hotels/hotels-browser.tsx` — type filter chips + type badge on cards
- `web/components/guides/guides-browser.tsx` — languages + specialties now the **primary card identity** (full language names, specialty badges; province demoted to a meta line); language filter widened to en/zh/km/ja/ko/fr/de/es/th/vi; free-text specialty input replaced with an enum Select
- `web/app/[locale]/guides/[id]/page.tsx` — Packages section linking to `/trips/[id]`; specialties now prefers the new field
- `web/components/transport/transport-browser.tsx` — tier chips (Normal/VIP/Bus) + subtype Select filters; results grouped by tier with headings (plain grid when one group); subtype + tier badges + seat counts (reuses `readableType`)
- `web/components/shared/filter-chips.tsx` — NEW reusable chip group (`aria-pressed` toggles)

### Slice B — custom-trip-card (P6b)

- `web/schemas/vibe-payloads.ts` — `CustomTripCardPayloadSchema`, type `custom_trip_card`, added to union + `CONTENT_PAYLOAD_TYPES` (19 types)
- `web/components/chat/payloads/rich/custom-trip-card.tsx` — NEW block: title, total + days, per-item lines (subtotal = unitPriceUsd × quantity), optional extras section, "Book this trip" link to `/trips/[id]` (reuses TripDetailBlock panel styling)
- `web/components/chat/payloads/block-renderer.tsx` — registered in RENDERERS
- `web/lib/vibe/protocol.ts` — no change needed (ContentBlockSchema is already loose)
- Tests updated: `tests/vibe-payloads.test.ts` (19 types + extras-optional parse test), `tests/chat-rich-payloads.test.tsx` (render tests + registry coverage)

### i18n
All keys added to `web/messages/{en,zh,km}.json` (parity verified): `catalog.filters.{hotelType,specialty,anySpecialty,tier,subtype,anySubtype,languageNames.*}`, `catalog.tiers.{normal,vip,bus}`, `catalog.detail.{packages,package,packageDays}`, `content.{customTrip,customTripDays,customTripTotal,customTripItems,customTripExtras,customTripBook,customTripQuantity}`.

### Contract notes for backend (also in `/home/rayu/DerLg/.rayu/swarm/FRONTEND.md`)
- The WS `custom_trip_card` payload expects **exactly these camelCase fields**: `data: { id, title, durationDays, totalUsd, items: [{type, name, unitPriceUsd, quantity}], extras?: [{name, unitPriceUsd, quantity}] }` — the agent `_norm_custom_trip` must emit this shape.
- REST: web sends `?type=` (hotels), `?language=&specialty=` (guides), `?type=&tier=&subtype=` (vehicles) — DTOs must declare these (`forbidNonWhitelisted`).
- Assumption flagged: guide `packages` items assumed trip-list-like (`name`, `durationDays`, `priceUsd`); all-nullish zod means any shape parses, but please confirm the mapper's exact field names.
- Expected during migration: applying a new filter before the backend DTO ships 400s; zod parsing itself never breaks.

### Verification
`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (393 tests / 21 files) · `npm run build` ✓ (exit 0; shelf fetch warnings during build are the pre-existing graceful-degradation path with the backend down).

Phase 2 (P4/P5/P7/P8/P9) intentionally untouched.
