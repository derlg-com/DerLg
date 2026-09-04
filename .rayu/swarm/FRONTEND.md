# FRONTEND — Phase 1 contract notes (2026-08-05)

Domain: `/home/rayu/DerLg/web/` (Next.js 16, Tailwind v4, next-intl, zod, react-query). Stack per shared.json.

## What shipped this round

### Slice A — catalog-browse (P1/P2/P3)

Files changed:
- `web/schemas/domain.ts`
- `web/lib/api/resources.ts`
- `web/components/hotels/hotels-browser.tsx`
- `web/components/guides/guides-browser.tsx`
- `web/components/transport/transport-browser.tsx`
- `web/components/shared/filter-chips.tsx` (NEW — chip group, single-select)
- `web/app/[locale]/guides/[id]/page.tsx`

**Zod fields added (all optional/nullish — parsing never breaks pre-migration):**
- `HotelSummary.type?: string | null` (values: resort | boutique | hotel | guesthouse | hostel | villa)
- `GuideSummary.specialties?: string[] | null` (enum Specialty: culture_history, food_tours, nature_trekking, photography, family_friendly, business, luxury, adventure) — legacy `specialities` kept for fallback
- `GuideSummary.packages?: GuidePackage[] | null` where `GuidePackage = { id?, name?, coverImageUrl?, durationDays?, priceUsd?, category?, location? }` (ALL nullish — backend mapper shape unverified; please confirm the exact field names the guide mapper emits for `packages`)
- `VehicleSummary.tier?: string | null` (normal | vip)
- `VehicleSummary.subtype?: string | null` (starex | hiace | alphard | small_bus | big_bus)

**Query params the web now sends (backend DTOs must declare them — forbidNonWhitelisted):**
- `GET /v1/hotels?type=` (P1)
- `GET /v1/guides?language=&specialty=` — NOTE: the browser now sends `specialty` (not the old free-text `speciality`)
- `GET /v1/transportation/vehicles?type=&tier=&subtype=` (P3)

UI: hotels type filter chips + card type badge; guide cards lead with languages (full names via `catalog.filters.languageNames`) + specialty badges, province demoted to meta; guide detail has a Packages list linking `/trips/[id]`; transport grouped by tier (Normal/VIP/Bus, derived: tier field, else vehicleType==='bus', else own type), tier/subtype filters, subtype + seat-count badges.

### Slice B — custom-trip-card (P6b)

Files changed:
- `web/schemas/vibe-payloads.ts`
- `web/components/chat/payloads/block-renderer.tsx`
- `web/components/chat/payloads/rich/custom-trip-card.tsx` (NEW)
- `web/tests/vibe-payloads.test.ts`, `web/tests/chat-rich-payloads.test.tsx` (19th block type)
- `web/lib/vibe/protocol.ts` — NO change needed (ContentBlockSchema is loose; `custom_trip_card` flows through)

**Block registered: `custom_trip_card`.** The web expects the agent's `_norm_custom_trip` normalizer to emit EXACTLY these camelCase fields (snake_case response → camelCase):

```
{
  type: 'custom_trip_card',
  data: {
    id: string,            // real Trip row id (category=custom) — /trips/[id] must resolve
    title: string,
    durationDays: number,
    totalUsd: number,      // backend-authoritative total
    items: [ { type: string, name: string, unitPriceUsd: number, quantity: number } ],
    extras: [ { name: string, unitPriceUsd: number, quantity: number } ]  // optional
  }
}
```

Renders a rich panel (title, total + days, per-item lines with subtotal = unitPriceUsd × quantity, extras section) and a "Book this trip" link to `/trips/[id]`.

## i18n
`web/messages/{en,zh,km}.json` — added (all 3 locales, key parity verified by tests):
- `catalog.filters.{hotelType,specialty,anySpecialty,tier,subtype,anySubtype,languageNames.*}`
- `catalog.tiers.{normal,vip,bus}`
- `catalog.detail.{packages,package,packageDays}`
- `content.{customTrip,customTripDays,customTripTotal,customTripItems,customTripExtras,customTripBook,customTripQuantity}`

## Assumptions / flags for backend
1. Guide `packages` item shape assumed trip-list-like; all fields nullish so any shape parses, but rendering shows name/duration/price only if the backend emits those names. Confirm the mapper output.
2. `specialty` filter param replaces `speciality` — backend `ListGuidesDto` must declare `specialty`.
3. `GET /v1/ai-tools/*` P1-P3 fields and `POST /v1/ai-tools/trips` are the backend's job; web consumes via `domain.ts` (REST, nullish) and `vibe-payloads.ts` (WS, camelCase).
4. If a filter is applied before the backend DTO ships, that request 400s (forbidNonWhitelisted) — expected during migration; zod parsing itself never breaks.

## Verification
`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (393 tests, 21 files) · `npm run build` ✓ (exit 0)
