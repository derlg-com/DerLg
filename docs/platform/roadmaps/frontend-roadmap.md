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

- [ ] **Runtime Contract**
  - [ ] Next.js version confirmed (currently v16.2.6)
  - [ ] React version confirmed (currently v19.2.4)
  - [ ] TypeScript strict mode enforcement confirmed
  - [ ] Node.js version target for development and CI

- [ ] **Rendering Strategy**
  - [ ] App Router structure finalized: `(public)`, `(auth)`, `(app)` route groups
  - [ ] Server Components by default policy (when are Client Components allowed?)
  - [ ] Data fetching pattern: Server Actions vs. Route Handlers vs. direct API calls
  - [ ] Caching strategy per route (ISR, SSR, static, dynamic)

- [ ] **Build & Deploy**
  - [ ] Output mode: `standalone` (Docker) vs. Vercel vs. static export
  - [ ] Environment variable handling (client-side vs. server-side)
  - [ ] Image optimization: Next.js built-in or external CDN?

- [ ] **Mobile-First PWA Constraints**
  - [ ] Target viewport breakpoints (mobile primary, tablet, desktop)
  - [ ] PWA manifest strategy (`next-pwa` or manual)
  - [ ] Service Worker scope and caching strategy
  - [ ] Offline fallback page design

---

## Phase 1: Core Infrastructure (No UI Yet)

*Build the wiring every feature will depend on.*

- [ ] **State Management**
  - [ ] Zustand store structure defined (auth, booking, chat, language, UI)
  - [ ] Persist middleware rules (what gets persisted to `localStorage`?)
  - [ ] Hydration mismatch handling (Zustand persist + Next.js SSR)

- [ ] **Data Fetching Layer**
  - [ ] API client setup (fetch wrapper or axios?)
  - [ ] React Query (TanStack Query) configuration:
    - [ ] Default stale time / cache time
    - [ ] Error retry policy
    - [ ] Refetch on window focus policy
  - [ ] Server Actions vs. API client — boundary defined

- [ ] **Internationalization (i18n)**
  - [ ] `next-intl` setup with three locales: `en`, `zh`, `km`
  - [ ] Default locale and locale detection strategy
  - [ ] Route prefixing: `/en/...`, `/zh/...` or domain-based?
  - [ ] RTL / script handling (Khmer text direction)
  - [ ] Number, date, and currency formatting per locale

- [ ] **Routing & Navigation**
  - [ ] Route table documented (all planned routes and their purposes)
  - [ ] Navigation state management (deep linking, back-button behavior)
  - [ ] Route guards (client-side redirect for unauthenticated users)

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

- [ ] **Session Management**
  - [ ] JWT access token storage (memory only? `localStorage`?)
  - [ ] Refresh token handling (httpOnly cookie via API?)
  - [ ] Token refresh strategy (proactive or on 401?)
  - [ ] Logout behavior (clear state, redirect, revoke token?)

- [ ] **Auth UX**
  - [ ] Auto-redirect authenticated users away from auth pages
  - [ ] Protected route wrapper / middleware
  - [ ] Session expiry handling (silent refresh vs. login prompt)

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

- [ ] **Testing**
  - [ ] Testing framework chosen and installed (Jest, Vitest, Playwright?)
  - [ ] Component testing strategy (Storybook? React Testing Library?)
  - [ ] E2E critical paths (booking flow, auth, chat)

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

*Record irreversible decisions here. Date each entry.*

| Date | Decision | Context | Consequences if Reversed |
|------|----------|---------|--------------------------|
| YYYY-MM-DD | Example: Use Zustand for all state, no Redux | Simplicity, small team | Requires refactoring all stores if app grows beyond Zustand |
| | | | |
| | | | |

---

## Current Status

**Phase in Progress:** `Phase 0 — Foundation & Constraints`

**Blockers:**
- None recorded yet.

**Next Review Date:**
- YYYY-MM-DD

---

## Quick Links

- [Project Architecture](../architecture/system-overview.md)
- [Feature Decisions](../../product/feature-decisions.md)
- [Frontend Implementation Spec](../../.kiro/specs/frontend-nextjs-implementation/)
- [Frontend Source](../../frontend/)
- [Backend Roadmap](roadmap-backend.md)
