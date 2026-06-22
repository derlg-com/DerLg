# DerLg Frontend — Architecture

Mobile-first PWA for Cambodia travel (trips, hotels, transport, guides) with an AI concierge.
Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Zustand · Zod · framer-motion · @vis.gl/react-google-maps · Vitest**.

The goals of this structure are **clarity** (each thing has one home) and **scalability**
(adding a screen or a whole booking vertical follows a fixed, copy-pasteable convention).

---

## 1. Layers (dependency direction flows downward)

```
app/            Routing only. Thin route files that set metadata and render ONE feature View.
components/
  ui/           Design-system primitives (the ONLY place visual styling is defined).
  shared/       Cross-feature building blocks (Logo, Reveal, shells, EntityCard, maps…).
  <feature>/    Feature UI (trips, hotels, transportation, guides, bookings, checkout,
                profile, auth, search, explore, vibe-booking).
lib/            Framework-agnostic logic: api-client, i18n, nav, format, payments, utils.
hooks/          Reusable React hooks (use-api-query, use-currency, use-auth, use-mounted…).
stores/         Zustand client state (auth, preferences, favorites, vibe-booking…).
schemas/        Zod schemas (validation + inferred types).
types/          Shared TS types (catalog.ts, api.ts).
messages/       i18n bundles: en.json / zh.json / km.json (keys must stay in parity).
```

Rules:
- **`app/*` never contains business logic or styling** — a page imports a feature View and renders it.
- **Color/spacing/typography live only in the design-system layer** (`components/ui` + `globals.css` tokens). Feature components compose primitives; no ad-hoc hex.
- **Feature components never import another feature** — share via `components/shared` or `lib`.

---

## 2. Routing & information architecture

Everything lives under one **app shell** except auth and the full-screen concierge.

| Route | Purpose |
|------|---------|
| `/` | **Explore** — the live browse home (`components/explore/ExploreLanding`) |
| `/search` | Universal search |
| `/trips` `/trips/[id]` `/trips/[id]/book` | Trips vertical |
| `/hotels/*` `/transportation/*` `/guides/*` | Other verticals (same shape) |
| `/bookings` `/bookings/[id]` | My Trips |
| `/checkout/[bookingId]` `/payment-method` `/confirmation` | Checkout flow |
| `/profile` `/edit` `/preferences` `/wishlist` | Account |
| `/vibe-booking` | Full-screen AI concierge |
| `(auth)/login|register|forgot-password|reset-password` | Auth (branded split layout) |

- **App shell** = `app/(app)/layout.tsx`: `TopBar` + `OfflineBanner` + `main` + `BottomNav` + `ChatLauncher` (floating concierge bubble on every app page).
- **Bottom nav + active-tab logic are config-driven** in `lib/nav.ts` (`TABS`, `getActiveTab`, `TAB_ROOTS`). `getActiveTab('/')` → `home`; trips/hotels/transport/guides also map to `home`.
- There is **no marketing splash** — `/` is the usable product.

---

## 3. Design system

- **Typography**: `--font-display` = **Sora** (headings — use the `font-display` class), `--font-sans` = **Plus Jakarta Sans** (body), `--font-mono` = Geist Mono. Khmer/SC fallbacks built in.
- **Color tokens** (`globals.css`, space-separated RGB triplets consumed via `rgb(var(--color-x))`, **every token has a dark-mode value**): primary (Forest Emerald), secondary (Vibrant Gold), background/foreground/card/muted/accent/border/ring/destructive/success/warning, rating.
- **Utility classes**: `.glass`, `.bg-gradient-brand` / `.bg-gradient-hero` / `.bg-gradient-gold`, `.text-gradient-brand` / `.text-gradient-gold`, `.shadow-elevated`, `.shadow-glow`, `.font-display`.
- **Primitives** (`components/ui/`): `Button` (variants `gradient`/`gold`/default/outline/secondary/ghost/destructive/link; sizes sm/default/lg/xl/icon), `Card` (variants `default`/`glass`/`elevated`/`interactive`), `Badge` (incl. `live`), `Input`/`Textarea`/`Select` (rounded-lg), `Tabs`/`Dialog`/`Sheet`/`Avatar`/`Skeleton`/`Spinner`/`EmptyState`/`Pagination`/`Toast`…
- **Shared blocks** (`components/shared/`): `Logo`, `GradientText`, `SectionHeading`, `Reveal` (in-view animation, respects `prefers-reduced-motion`), `FavoriteButton`, `GoogleMapView`, `MarkdownText`, and the **shells** below.
- See `app/ui-kit` for a live showcase, and `context/ui-context.md` for the design rationale.

---

## 4. Feature-module convention (the scalability core)

Each booking vertical (`trips`, `hotels`, `transportation`, `guides`) follows the **same shape**:

```
components/<feature>/
  <X>Catalog.tsx     URL-synced filters + grid + pagination (built on CatalogShell)
  <X>Card.tsx        one result card (built on the shared EntityCard look)
  <X>DetailView.tsx  hero + sections + sticky CTA (built on DetailShell)
  <X>BookingForm.tsx booking form (built on FormShell)
types/catalog.ts     <X>Summary / <X>Detail types + category/sort constants
lib/api-client.ts    typed fetch helpers (envelope-aware)
messages/*.json      <feature> i18n namespace (en/zh/km)
```

Shared **shells** keep layout in one place so verticals only supply data/config:
- **`EntityCard`** — the single premium card (image + gradient overlay + favorite + rating chip + `font-display` title + price + meta).
- **`CatalogShell`** — filters slot + responsive grid + pagination + loading/error/empty states.
- **`DetailShell`** — hero/gallery slot + sections slot + sticky gradient CTA bar.
- **`FormShell`** — booking-form wrapper (title + summary slot + fields + gradient submit).

The **Explore home** (`components/explore/`) demonstrates a complementary, config-driven
pattern: `SearchHero` (segmented tabs + "Ask AI" → `/vibe-booking`), `CategoryTiles`
(maps `TRIP_CATEGORIES` → `/trips?category=…`), and `Shelf` carousels that render the
existing cards. Adding a shelf = add one `<CatalogShelf>` with a query + `renderCard`.

---

## 5. Config-driven lists

Add an item by editing data, not UI:
- `lib/nav.ts` → `TABS` (bottom nav).
- `types/catalog.ts` → `TRIP_CATEGORIES`, `TRIP_SORTS`, `SEARCH_TYPES`.
- `lib/payments.ts` → `PAYMENT_METHODS`.

---

## 6. Data, state, i18n

- **Data fetching**: `lib/api-client.ts` (knows the `{ success, data, message, error }` envelope + pagination `meta`) + `hooks/use-api-query.ts` (`useApiQuery<T>(path)` → `{ data, isLoading, error, refetch }`, with abort/dedupe). No raw `fetch` in components.
- **Client state**: Zustand stores in `stores/` (`auth`, `preferences`, `favorites`, `vibe-booking`). Persisted stores use `zustand/middleware`.
- **i18n**: `lib/i18n.ts` `useTranslations(namespace)` → `t(key, vars?, fallbackKey?)`; locale in `useLanguageStore`. **Every key must exist in all three** `messages/{en,zh,km}.json` — enforced by `tests/i18n-parity.test.ts`. Namespaces: `brand, shell, search, trips, hotels, transportation, guides, bookings, checkout, profile, account, auth, explore, chat, content, tools, common, weather, budget, compare, paymentStatus, share`.

---

## 7. Accessibility & motion
- WCAG AA contrast on tokens; visible `focus-visible` rings; ≥44px touch targets on primary controls; `aria-*`/roles on interactive UI.
- Animations are 150–400ms and **must honor `prefers-reduced-motion`** (use `Reveal` or `framer-motion`'s `useReducedMotion`).
- Lint rule `react-hooks/set-state-in-effect`: never `setState` synchronously in an effect body — use event/promise/interval callbacks or `hooks/use-mounted.ts`.

---

## 8. Testing & verification
From `frontend/`:
```
npm run lint        # 0 errors
npm run build       # exit 0
npx vitest run      # all green (incl. i18n parity)
```
Tests live in `tests/` (Vitest + Testing Library). Co-locate behavior assertions with the feature; prefer querying by role/label so restyles don't break tests.

---

## 9. Adding a new vertical (worked example: "activities")
1. `types/catalog.ts`: add `ActivitySummary` / `ActivityDetail` (+ any category/sort consts).
2. `lib/api-client.ts`: add typed fetchers (or reuse `useApiQuery` with the path).
3. `components/activities/`: `ActivitiesCatalog` (CatalogShell), `ActivityCard` (EntityCard), `ActivityDetailView` (DetailShell), `ActivityBookingForm` (FormShell).
4. `app/(app)/activities/{page,[id]/page,[id]/book/page}.tsx`: thin pages rendering the views.
5. `messages/{en,zh,km}.json`: add an `activities` namespace (all three).
6. Optionally add a shelf to `ExploreLanding` and a tile to `CategoryTiles`.
7. `npm run lint && npm run build && npx vitest run`.

No layout, styling, or data-plumbing is reinvented — only the vertical's data + labels.
