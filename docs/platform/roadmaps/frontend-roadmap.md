# Frontend System Design Roadmap

> **Purpose:** Track architectural decisions, design phases, and completion status for the DerLg Next.js frontend. This is a living document — update it as decisions are made or revised.

---

## How to Use This File

1. **Work top-down.** Each phase builds on the previous. Do not skip ahead.
2. **Check boxes only after the design is documented.** "Documented" means a decision is written down (in this repo, in a spec, or in code) — not just discussed.
3. **Use the Decision Log at the bottom** to record "why" for irreversible choices.

---

## Phase 0: Foundation & Constraints

*Lock these before any page or component design begins.*

- [x] **Runtime Contract**
  - [x] Next.js version confirmed (currently v16.2.6)
  - [x] React version confirmed (currently v19.2.4)
  - [x] TypeScript strict mode enforcement confirmed
  - [x] Node.js version target for development and CI

- [ ] **Rendering Strategy**
  - [x] App Router structure finalized: `(public)`, `(auth)`, `(app)` route groups
  - [x] Server Components by default policy (when are Client Components allowed?)
  - [x] Data fetching pattern: Server Actions vs. Route Handlers vs. direct API calls
  - [ ] Caching strategy per route (ISR, SSR, static, dynamic)

- [ ] **Build & Deploy**
  - [ ] Output mode: `standalone` (Docker) vs. Vercel vs. static export
  - [x] Environment variable handling (client-side vs. server-side)
  - [ ] Image optimization: Next.js built-in or external CDN?

- [ ] **Mobile-First PWA Constraints**
  - [ ] Target viewport breakpoints (mobile primary, tablet, desktop)
  - [ ] PWA manifest strategy (`next-pwa` or manual)
  - [ ] Service Worker scope and caching strategy
  - [ ] Offline fallback page design

---

## Phase 1: Core Infrastructure (No UI Yet)

*Build the wiring every feature will depend on.*

- [x] **State Management**
  - [x] Zustand store structure defined (auth, booking, chat, language, UI)
  - [x] Persist middleware rules (what gets persisted to `localStorage`?)
  - [x] Hydration mismatch handling (Zustand persist + Next.js SSR)

- [x] **Data Fetching Layer**
  - [x] API client setup (fetch wrapper or axios?)
  - [x] React Query (TanStack Query) configuration:
    - [x] Default stale time / cache time
    - [x] Error retry policy
    - [x] Refetch on window focus policy
  - [x] Server Actions vs. API client — boundary defined

- [x] **Internationalization (i18n)**
  - [x] `next-intl` setup with three locales: `en`, `zh`, `km`
  - [x] Default locale and locale detection strategy
  - [x] Route prefixing: `/en/...`, `/zh/...` or domain-based?
  - [x] RTL / script handling (Khmer text direction)
  - [x] Number, date, and currency formatting per locale

- [ ] **Routing & Navigation**
  - [ ] Route table documented (all planned routes and their purposes)
  - [ ] Navigation state management (deep linking, back-button behavior)
  - [x] Route guards (client-side redirect for unauthenticated users)

- [ ] **Error Boundaries**
  - [ ] Global error boundary (`error.tsx` at root)
  - [ ] Not-found boundary (`not-found.tsx`)
  - [ ] API error handling pattern (toast? inline? modal?)

---

## Phase 2: Design System & Component Foundation

*Establish the visual and interaction language before building pages.*

- [ ] **Styling Architecture**
  - [ ] Tailwind CSS v4 configuration confirmed
  - [ ] Custom theme tokens (colors, spacing, typography, shadows)
  - [ ] Dark mode strategy (not planned? system? toggle?)
  - [ ] CSS variable convention for theming

- [ ] **shadcn/ui Setup**
  - [ ] Component installation policy (which base components?)
  - [ ] Customization strategy (override styles, wrap components, or fork?)
  - [ ] Accessibility baseline (Radix primitives already handle this — confirm testing)

- [ ] **Typography & Icons**
  - [ ] Geist font loading strategy (`next/font/google`)
  - [ ] Fallback font stack for Khmer and Chinese characters
  - [ ] Icon system: Lucide React, custom SVGs, or mixed?

- [ ] **Shared Components**
  - [ ] `Layout` shells (public marketing, auth minimal, app with bottom nav)
  - [ ] `Button` variants and loading states
  - [ ] `Input`, `Select`, `DatePicker` forms with validation feedback
  - [ ] `Card` patterns for listings (hotel, trip, guide)
  - [ ] `Skeleton` loading states
  - [ ] `EmptyState` and `ErrorState` patterns
  - [ ] `BottomSheet` / `Modal` behavior (mobile-native feel)
  - [ ] `Toast` / `Snackbar` notification system

- [ ] **Animation & Interaction**
  - [ ] Page transition strategy
  - [ ] Micro-interaction policy (hover, tap, loading)
  - [ ] Reduced motion support (`prefers-reduced-motion`)

---

## Phase 3: Authentication Flows

*Login, register, and session handling. Must feel native on mobile.*

- [ ] **Auth Pages**
  - [ ] `/login` — email/password + Google OAuth
  - [ ] `/register` — account creation with validation
  - [ ] `/forgot-password` — password reset request
  - [ ] `/reset-password` — token-based password reset

- [x] **Session Management**
  - [x] JWT access token storage (memory only? `localStorage`?)
  - [x] Refresh token handling (httpOnly cookie via API?)
  - [x] Token refresh strategy (proactive or on 401?)
  - [x] Logout behavior (clear state, redirect, revoke token?)

- [ ] **Auth UX**
  - [ ] Auto-redirect authenticated users away from auth pages
  - [x] Protected route wrapper / middleware
  - [x] Session expiry handling (silent refresh vs. login prompt)

---

## Phase 4: App Shell & Navigation

*The frame that holds every authenticated screen.*

- [ ] **App Layout**
  - [ ] Bottom tab navigation structure (Home, Explore, Bookings, Chat, Profile)
  - [ ] Top header behavior (scroll-away, sticky, contextual actions)
  - [ ] Safe area handling (notch, home indicator)

- [ ] **Navigation Patterns**
  - [ ] Stack navigation within tabs (e.g. Home → Hotel Detail → Booking Form)
  - [ ] Deep linking structure for each major flow
  - [ ] Back button behavior per platform (iOS swipe-back gesture feel)

- [ ] **Global UI State**
  - [ ] Pull-to-refresh behavior
  - [ ] Infinite scroll vs. pagination pattern
  - [ ] Search bar placement and behavior (global? contextual?)

---

## Phase 5: Feature Modules (Inventory & Booking)

*The core product experience. Build one vertical slice at a time.*

- [ ] **Home / Feed**
  - [ ] Personalized vs. generic landing for new users
  - [ ] Featured trips, hotels, guides carousel
  - [ ] Quick action buttons (book trip, find guide, emergency)

- [ ] **Explore / Search**
  - [ ] Search filters (category, price range, date, location)
  - [ ] Map integration (Leaflet.js) — list/map toggle
  - [ ] Category browsing (trips, hotels, guides, transport)

- [ ] **Detail Pages**
  - [ ] Trip detail (itinerary, inclusions, reviews, availability)
  - [ ] Hotel detail (rooms, amenities, gallery, location)
  - [ ] Guide detail (languages, reviews, calendar)
  - [ ] Transport detail (route, vehicle, pricing)

- [ ] **Booking Flow**
  - [ ] Booking form (date, guests, options)
  - [ ] Price breakdown display
  - [ ] 15-minute hold timer UI
  - [ ] Payment method selection (Stripe card, QR code)
  - [ ] Booking confirmation and receipt

- [ ] **My Trips / Bookings**
  - [ ] Booking list (upcoming, past, cancelled)
  - [ ] Booking detail (status, itinerary, cancellation)
  - [ ] Cancellation flow with refund preview

---

## Phase 6: AI Chat (Vibe Booking)

*The conversational concierge. Highest complexity UX.*

- [ ] **Chat Interface**
  - [ ] Message bubble design (user vs. AI)
  - [ ] Typing indicator
  - [ ] Suggested prompts / quick replies
  - [ ] Message history persistence

- [ ] **Rich Content in Chat**
  - [ ] Card carousels (hotels, trips) inside chat
  - [ ] Booking confirmation embedded in chat
  - [ ] Map embeds for location sharing
  - [ ] Image sharing (user uploads, AI returns images)

- [ ] **Chat State Management**
  - [ ] WebSocket or SSE for real-time AI responses
  - [ ] Optimistic UI for sent messages
  - [ ] Error / retry for failed messages
  - [ ] Conversation list (new chat, history, delete)

- [ ] **AI Tool UI**
  - [ ] Loading states while AI calls backend tools
  - [ ] Inline confirmation ("Shall I book this for you?")
  - [ ] Human-in-the-loop for payments (never auto-execute payment)

---

## Phase 7: Profile & Account

*User-facing settings and information.*

- [ ] **Profile Page**
  - [ ] Display and edit user info
  - [ ] Avatar upload
  - [ ] Language preference switcher
  - [ ] Currency preference

- [ ] **Loyalty & Rewards**
  - [ ] Points balance display
  - [ ] Transaction history
  - [ ] Tier / level progress (if applicable)

- [ ] **Student Verification**
  - [ ] Verification flow UI
  - [ ] Discount badge display

- [ ] **Settings**
  - [ ] Notification preferences
  - [ ] Privacy settings
  - [ ] Delete account / data export (GDPR)

---

## Phase 8: Offline, PWA & Performance

*Make it feel like a native app, even with bad connectivity.*

- [ ] **Offline Support**
  - [ ] Static page caching (service worker)
  - [ ] Cached booking details viewable offline
  - [ ] Queue actions for retry (e.g. chat messages sent offline)
  - [ ] Offline indicator UI

- [ ] **PWA Features**
  - [ ] Install prompt UI
  - [ ] Splash screen and app icon set
  - [ ] Standalone mode behavior (hide browser chrome)

- [ ] **Performance**
  - [ ] Image optimization (WebP, responsive sizes, lazy loading)
  - [ ] Code splitting per route
  - [ ] Prefetching strategy (hover? viewport?)
  - [ ] Core Web Vitals targets (LCP, CLS, INP)

---

## Phase 9: Production Readiness

*Before launch. The details that separate demo from product.*

- [x] **Testing**
  - [x] Testing framework chosen and installed (Jest, Vitest, Playwright?)
  - [x] Component testing strategy (Storybook? React Testing Library?)
  - [x] E2E critical paths (booking flow, auth, chat)

- [ ] **Analytics**
  - [ ] Privacy-friendly analytics choice (Plausible, PostHog, none?)
  - [ ] Event tracking plan (search, booking started, booking completed)

- [ ] **SEO & Meta**
  - [ ] Metadata template for all routes
  - [ ] OpenGraph images for shareable listings
  - [ ] `robots.txt` and `sitemap.xml`

- [ ] **Security**
  - [ ] CSP headers configured
  - [ ] Sensitive inputs (passwords) autocomplete attributes
  - [ ] Client-side secret handling (none in bundle)

---

## Decision Log

*Record irreversible decisions here. Date each entry. Architectural decisions are recorded as ADRs in [`docs/platform/frontend/adr/`](../frontend/adr/) — the table below summarizes them.*

| Date       | Decision | ADR | Consequences if reversed |
|------------|----------|-----|--------------------------|
| 2026-05-22 | App Router with Server Components by default; `'use client'` is opt-in. | [ADR-0001](../frontend/adr/0001-app-router-server-components-default.md) | Refactor every page into Client Components; ship larger JS bundles to mobile. |
| 2026-05-22 | Zustand for client UI state, TanStack React Query for server state. No third state library. | [ADR-0002](../frontend/adr/0002-state-management-split.md) | Migrate every store and hook to a different library; rewrite cache invalidation. |
| 2026-05-22 | Access token in JS memory (Zustand), refresh token in `httpOnly Secure SameSite=Strict` cookie, lazy 401 refresh, middleware checks cookie presence. | [ADR-0003](../frontend/adr/0003-auth-and-session-model.md) | Re-design entire auth flow; rebuild api-client refresh handshake. |
| 2026-05-22 | next-intl with always-prefixed locale paths (`/en`, `/zh`, `/km`); `[locale]` dynamic segment is the only top-level user-facing route. | [ADR-0004](../frontend/adr/0004-i18n-routing-strategy.md) | Re-route every URL; rebuild SEO `hreflang` machinery; change PWA start URL contract. |
| 2026-05-22 | Vitest + React Testing Library + Playwright + MSW. One unit/component runner, one E2E runner, one mock layer. | [ADR-0005](../frontend/adr/0005-testing-stack.md) | Migrate every test file to a different runner; double-maintain mocking layers during transition. |
| 2026-05-22 | Per-feature frontend reference docs live at `docs/platform/frontend/reference/features/<feature>.md`. | [ADR-0006](../frontend/adr/0006-per-feature-frontend-reference-docs-location.md) | Relocate every per-feature doc and update every cross-link in the platform docs. |
| 2026-05-22 | Feature-sliced layout: `app/` for routes, `features/<x>/` self-contained per feature, `shared/` is the only cross-feature surface. ESLint enforces no feature-to-feature imports and `index.ts`-only entry to features. | [ADR-0007](../frontend/adr/0007-feature-sliced-architecture-with-strict-boundaries.md) | Reorganize the entire `frontend/` tree, rewrite ESLint config, and update every per-feature reference doc to point at scattered files. |

---

## Current Status

**Phase in Progress:** `Phase 0 — Foundation & Constraints` (decided), `Phase 1 — Core Infrastructure` (decided, not yet implemented).

**What's decided (documented):**
- Runtime contract — see [`foundation.md`](../frontend/foundation.md).
- App Router structure + RSC default — [`architecture.md`](../frontend/architecture.md), ADR-0001.
- State management split — ADR-0002.
- Auth & session model — ADR-0003.
- i18n routing strategy — ADR-0004.
- Testing stack — ADR-0005.
- Per-feature doc location and template — ADR-0006, [`_template-feature.md`](../frontend/_template-feature.md).
- Feature-sliced code layout with strict boundary (app/, features/<x>/, shared/) — ADR-0007.

**What's decided but not yet implemented (next):**
- `frontend/package.json` does **not** yet include zustand, @tanstack/react-query, next-intl, vitest, @testing-library/react, @playwright/test, msw, eslint-plugin-boundaries, eslint-config-prettier, prettier, or prettier-plugin-tailwindcss — adoption is the next concrete step.
- `frontend/features/` and `frontend/shared/` folders do not exist yet; current code lives under flat `frontend/components/`, `hooks/`, `stores/`, `schemas/`, `lib/`, `types/` — the migration to the layout in ADR-0007 is a separate PR.
- `frontend/middleware.ts` does not exist yet.
- `frontend/lib/api-client.ts` does not exist yet.
- `frontend/app/[locale]/` route segment does not exist; current `app/` is a flat scaffold.
- ESLint flat config has not yet been extended with `eslint-plugin-boundaries` rules; the boundary rule in ADR-0007 is documented but not yet enforced.
- Prettier is not yet configured; the conventions in `tech.md` (no semicolons, single quotes, 100 col) are not enforced.
- No cross-cutting reference docs (`state-and-data.md`, `auth-and-session.md`, etc.) authored yet — they need the underlying code to land first per the "no future tense" rule in [`reference/README.md`](../frontend/reference/README.md).

**What's still open (Phase 0 / Phase 1 unchecked items):**
- Caching strategy per route (ISR/SSR/static/dynamic) — pending.
- Output mode (`standalone` vs Vercel vs static export) — pending.
- Image optimization choice — pending.
- Mobile-first breakpoints, PWA manifest, Service Worker scope, offline fallback — entire PWA section pending.
- Route table (exhaustive enumeration) — pending.
- Error boundary policy (global, not-found, API error UX) — pending.

**Blockers:**
- None. Adoption work can begin in any order.

**Next Review Date:**
- 2026-06-22

---

## Quick Links

- [Project Architecture](../architecture/system-overview.md)
- [Feature Decisions](../../product/feature-decisions.md)
- [Frontend Implementation Spec](../../.kiro/specs/frontend-nextjs-implementation/)
- [Frontend Source](../../frontend/)
- [Backend Roadmap](roadmap-backend.md)
