# ADR-0004: i18n routing — next-intl with always-prefixed locale paths (`/en`, `/zh`, `/km`)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `i18n`, `routing`, `seo`, `accessibility` |

---

## Context

DerLg serves three locales, in priority order:

| Code | Language | Why it matters |
|------|----------|----------------|
| `en` | English | International travelers, default for SEO |
| `zh` | Simplified Chinese | Primary market — see `.kiro/steering/product.md` (WeChat Wendy persona) |
| `km` | Khmer | Domestic Cambodian travelers, regulatory + brand alignment |

Localization spans three layers per [`docs/modules/multilanguage/architecture.md`](../../../modules/multilanguage/architecture.md):

1. **Static UI strings** — labels, buttons, validation messages. Owned by the frontend, shipped as JSON resource bundles.
2. **Dynamic content** — trip names, descriptions, place names, hotel amenities. Owned by the backend; stored as JSONB `translations` columns and selected by the `Accept-Language` header.
3. **Formatting** — dates, numbers, currencies. Locale-aware and tied to the active locale.

The frontend must answer:

- **How is the active locale carried?** URL prefix vs cookie vs subdomain.
- **What's the URL shape?** `/trips` (no prefix for default) vs `/en/trips` (always prefixed).
- **How is locale detected on first visit?** Browser language vs cookie vs default.
- **How are static messages loaded?** Bundled vs lazy vs server-fetched.
- **What about Khmer-specific concerns?** Font, line-breaking, no-RTL.

When this decision was taken:

- `next-intl` is committed in [`docs/modules/multilanguage/architecture.md`](../../../modules/multilanguage/architecture.md) and [`.kiro/steering/tech.md`](../../../../.kiro/steering/tech.md).
- The package is **not yet installed** in `frontend/package.json`.
- The frontend currently has no `[locale]` segment, no `messages/` folder, and no `middleware.ts`.
- The backend's `I18nInterceptor` is a documented contract; it expects `Accept-Language` on every request.

Constraints:

- **Mobile-first PWA.** Locale state must survive PWA cold start; switching locale must not re-download the entire app shell.
- **SEO matters for `(public)` routes** — trip pages and the marketing landing must be indexable per locale. Each locale must have a stable, canonical URL.
- **Server Components by default** ([ADR-0001](./0001-app-router-server-components-default.md)). The locale must be available at the route segment level so Server Components can pick the right messages and currency formatter without runtime detection.
- **One source of truth for active locale.** Cookie-only storage breaks SEO. URL-only storage breaks PWA cold start (no path on first launch). We need URL as authoritative + cookie/localStorage as the "where to send a returning user" hint.

---

## Decision

We will use **next-intl** with **always-prefixed locale paths** as the only locale-routing mechanism. Every route under `app/` that the user can see lives under a `[locale]` dynamic segment; the URL **always** carries the locale (`/en`, `/zh`, `/km`). There is no "default locale without prefix".

Locale resolution priority (used by middleware on the **first** visit only, before any prefix exists):

1. Cookie `NEXT_LOCALE` (set by the language switcher; survives PWA cold start)
2. `Accept-Language` header (browser preference)
3. Default: `en`

After the first redirect, the URL is the source of truth. The cookie is a hint, not a state.

Static UI messages live in `frontend/messages/{en,zh,km}.json`, loaded **per locale, on the server**, via the next-intl request configuration. They are not bundled into the client.

The `Accept-Language` header sent to the backend is set automatically by `lib/api-client.ts` from the active locale read out of next-intl, so the backend's `I18nInterceptor` resolves dynamic content without further plumbing.

> The boundary is: **the URL prefix is the locale. Cookies and `localStorage` only hint at "what to redirect to next"; they do not authoritatively answer "what locale am I in".**

---

## Options considered

### Option A — Domain-based locales (`derlg.com`, `zh.derlg.com`, `km.derlg.com`)

- **Pros:** Cleanest SEO signal per locale; great for separate analytics per region.
- **Cons:** Multiple TLS certificates, multi-origin CORS, cookie scope complexity. Disproportionate ops for a single-team product.

### Option B — Path prefix as-needed (default locale unprefixed: `/trips`, `/zh/trips`, `/km/trips`)

- **Pros:** Shorter URLs for English (the largest international audience).
- **Cons:** Asymmetry. Two URL shapes for the same logical page. Canonical link tags become tricky. The default locale's paths can shadow other route segments. PWA cold start ambiguity (`/` could mean any locale before redirect).

### Option C — Path prefix always (`/en`, `/zh`, `/km`) *(chosen)*

- **Pros:**
  - Symmetry: every page has exactly one URL shape per locale.
  - The `[locale]` dynamic segment makes the locale available to every Server Component without runtime detection.
  - PWA cold start is unambiguous: the start URL is `/en` (or whichever was last used, via the cookie hint).
  - Search engines see clear, mirrored URL trees per locale.
  - Switching locale is a route navigation — clean for Next.js's App Router.
- **Cons:**
  - Bare `/` must redirect; first-visit users see a redirect hop.
  - Slightly longer URLs (rarely visible in mobile browsers anyway).

### Option D — Locale in cookie only, URL is locale-agnostic

- **Pros:** Cleanest URLs.
- **Cons:** Defeats SEO. Search engines see one URL with three different bodies depending on cookie state. Indexing breaks. Not viable for a public-facing product.

**Chosen:** Option C. SEO + PWA cold-start determinism + Server Component clarity outweigh the slight URL length cost.

---

## Consequences

### Positive

- Every user-facing route has exactly one canonical URL per locale, which is what `<link rel="alternate" hreflang="…">` machinery expects.
- The `[locale]` dynamic segment exposes the active locale to Server Components for free; no runtime detection inside components.
- A user landing on `/zh/trips/angkor` sees Chinese static UI **and** receives Chinese dynamic content from the backend (api-client forwards the locale). Consistent end-to-end.
- The cookie hint (`NEXT_LOCALE`) makes returning users land in their preferred locale on PWA cold start without breaking the URL-as-source-of-truth invariant.
- Khmer (`km`) gets a first-class URL prefix from day one — no second-class citizen status that would require migration later.

### Negative

- The bare path `/` is never a valid destination; it always redirects to a locale-prefixed URL. We accept the extra hop on first visit.
- Every internal link must be locale-aware (next-intl's `Link` component handles this; raw `<a href="/trips">` is forbidden).
- `(auth)` routes also live under `[locale]` — `/en/login` etc. — so OAuth callback URLs include the locale. We accept this; the backend doesn't need to care.
- The Khmer locale's character set (Khmer script) requires a font fallback stack. We address this in the design system, not here.

### Neutral / things we accept

- We do not ship a "no-locale" admin URL space; admin (when it lands) will also be locale-prefixed for consistency.
- Route handlers under `app/api/*` stay locale-agnostic (the middleware matcher excludes them).
- Locale switching does not preserve query parameters by default. We accept this; revisit if we get user complaints.

---

## Implementation

### Packages to add

```json
{
  "dependencies": {
    "next-intl": "3.26.5"
  }
}
```

Pinned per [`.kiro/steering/conventions.md`](../../../../.kiro/steering/conventions.md). Lockfile committed in the same PR.

### Folder layout

```
frontend/
├── app/
│   └── [locale]/                  # The only top-level route segment for user-facing pages
│       ├── layout.tsx             # NextIntlClientProvider, font, html lang attribute
│       ├── (public)/              # Re-grouped under [locale]
│       ├── (auth)/
│       └── (app)/
├── messages/
│   ├── en.json
│   ├── zh.json
│   └── km.json
├── i18n/
│   ├── routing.ts                 # locales array, defaultLocale, localePrefix: 'always'
│   └── request.ts                 # next-intl request config: which messages to load
├── middleware.ts                  # next-intl middleware + auth guard ([ADR-0003])
└── lib/
    └── api-client.ts              # Reads active locale and sets Accept-Language
```

### Configuration

```typescript
// frontend/i18n/routing.ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'zh', 'km'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true, // Browser detection on first visit only; cookie hints take precedence.
})
```

```typescript
// frontend/middleware.ts (sketch — see ADR-0003 for the auth half)
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

const intl = createIntlMiddleware(routing)

export default function middleware(req: NextRequest) {
  // Auth guard runs first when applicable, then defers to the intl middleware.
  // ...
  return intl(req)
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
```

### Message bundles

- One JSON per locale in `frontend/messages/`.
- Top-level keys group by feature: `auth`, `bookings`, `vibeBooking`, `home`, `errors`, `common`.
- All three locale files MUST contain the same key set; CI fails on key drift (lint script TBD).
- Plurals via ICU MessageFormat as supported by next-intl.
- No interpolation of unsanitized AI content into messages — those go through the AI content renderer, not next-intl.

### Type safety

next-intl's TypeScript plugin generates a global `Messages` type from `messages/en.json`. We adopt it: the `t()` function autocompletes keys and fails the build on typos.

### Formatting

next-intl's `useFormatter`, `useNow`, and `useTimeZone` cover dates/numbers per locale. Currency formatting goes through a thin wrapper in `lib/currency.ts` that:
- Defaults to USD across all locales (per [`.kiro/steering/product.md`](../../../../.kiro/steering/product.md)).
- Allows explicit KHR (Khmer locale default override) and CNY (Chinese locale default override).
- Applies locale-aware grouping (`zh-CN` uses 万 in some cases — we accept browser default behavior here).

### Khmer-specific notes

- `km` does not use word spacing the way English does. CSS `word-break: keep-all; overflow-wrap: anywhere;` is the safe default for body copy in Khmer; the design system will encode this in a Tailwind utility.
- Font fallback: `Noto Sans Khmer` (Google Fonts, swap with `next/font/google`), then `Khmer OS`, then `system-ui`. Tracked in the design system reference doc.
- No RTL handling needed (Khmer is LTR).

### Backend handshake

`lib/api-client.ts` MUST set `Accept-Language: <active locale>` on every backend request:

```typescript
const headers: HeadersInit = {
  'Accept-Language': getActiveLocale(), // reads from next-intl
  Authorization: `Bearer ${accessToken}`,
}
```

The backend's `I18nInterceptor` (see [`docs/modules/multilanguage/architecture.md`](../../../modules/multilanguage/architecture.md)) resolves dynamic translations from this header.

### Locale switcher behavior

- A user-initiated locale change navigates to the same path under the new prefix (`/en/trips/angkor` → `/zh/trips/angkor`) and writes the `NEXT_LOCALE` cookie.
- If the new locale's content does not exist (e.g., a trip whose Khmer translation is missing), the backend returns the English fallback. The frontend never silently shows half-translated content; the missing-translation fallback is a backend responsibility.

### Documentation that flows from this ADR

- [`reference/i18n-and-locale.md`](../reference/i18n-and-locale.md) — full contract: routing, message keys, formatting helpers, font stacks, the api-client header behavior. Authored once next-intl is installed.
- [`guides/add-an-i18n-string.md`](../guides/add-an-i18n-string.md) — recipe.
- [`explanation/i18n-philosophy.md`](../explanation/i18n-philosophy.md) — why every string is a key; cost of "small exceptions".

### Anti-patterns this decision rules out

- ❌ Hardcoded user-facing strings in JSX. All text goes through `t('key')`. Lint enforces.
- ❌ Reading `navigator.language` inside components. The middleware already chose; the URL is the source of truth.
- ❌ Routing to `/trips` from a `Link`. Use next-intl's `<Link href="/trips">` (locale-aware) — never raw `<a>` for internal navigation.
- ❌ Translating dynamic content in the frontend. Dynamic content (trip names, descriptions) is owned by the backend and selected via `Accept-Language`.
- ❌ Adding a fourth locale without updating *every* `messages/*.json` and re-running the key-drift check.
- ❌ Different URL shapes per locale (`/zh-cn`, `/zh_TW` etc.). We have one Chinese variant: `zh`. If we add Traditional later, it gets a new code per BCP 47.

---

## Links

- Related ADRs: [ADR-0001](./0001-app-router-server-components-default.md) (App Router structure), [ADR-0003](./0003-auth-and-session-model.md) (middleware sequencing).
- Related docs: [`docs/modules/multilanguage/architecture.md`](../../../modules/multilanguage/architecture.md), [`docs/modules/multilanguage/api.yaml`](../../../modules/multilanguage/api.yaml), planned [`../reference/i18n-and-locale.md`](../reference/i18n-and-locale.md).
- External:
  - [next-intl — App Router](https://next-intl-docs.vercel.app/docs/getting-started/app-router)
  - [BCP 47 language tags](https://www.rfc-editor.org/rfc/bcp/bcp47.txt)
  - [W3C — Choosing a Language Tag](https://www.w3.org/International/questions/qa-choosing-language-tags)

---

## History

| Date | Change |
|------|--------|
| 2026-05-22 | Created and Accepted. Codifies the next-intl + always-prefixed-paths choice already implied by `docs/modules/multilanguage/architecture.md`. |
