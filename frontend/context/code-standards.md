# Frontend Code Standards

> Canonical sources (these win on conflict): [`steering/tech.md`](../../.kiro/steering/tech.md), [`steering/conventions.md`](../../.kiro/steering/conventions.md), [`docs/platform/frontend/`](../../docs/platform/frontend/), [`docs/platform/frontend/adr/`](../../docs/platform/frontend/adr/).
> This is the day-to-day cheat-sheet. Read §1 (system shape) and §3 (feature boundary) before writing code.

---

## 1. System shape

| Layer | Tech | Port | Owns |
|---|---|---|---|
| **Frontend** | Next.js 16 + React 19 | 3000 | UI, routing, client state, BFF proxy |
| **Backend** | NestJS 11 + Prisma | 3001 | Business logic, DB writes, payments, auth issuance |
| **AI Agent** | Python + FastAPI + LangGraph | TBD | Vibe Booking chat over WebSocket |
| **Data** | PostgreSQL (Supabase), Redis | — | Owned by backend; frontend never touches directly |

**Hard rules:**
- Next.js is **frontend only.** No business logic, no DB access, no Prisma in this tree.
- All data mutations and reads go through the NestJS API at `/v1/*`. Frontend speaks HTTP/JSON.
- Vibe Booking chat connects directly to the AI agent over WebSocket. The AI agent talks to the backend via `/v1/ai-tools/*`, not to the DB.
- Response envelope from backend is `{ success, data, message, error? }`. The shared API client unwraps to `data`.

---

## 2. General principles

- One reason to change per file. Component renders, hook fetches, store holds state — don't merge.
- Fix root causes. No try/catch swallowing.
- No dead code, no `console.log` in PRs, no stale `TODO` without a tracking link.
- No premature abstraction. Inline twice; abstract on the third.
- Style: no semicolons, single quotes, 2-space indent, trailing commas, 100-col. Prettier enforces.

---

## 3. Feature-sliced architecture — the scalability rule

Reference: [ADR-0007](../../docs/platform/frontend/adr/0007-feature-sliced-architecture-with-strict-boundaries.md). Every other rule assumes this.

### 3.1 The shape

```
frontend/
├── app/                      # Routes ONLY: page.tsx, layout.tsx, error.tsx,
│                             # loading.tsx, not-found.tsx, route.ts
├── features/<feature>/
│   ├── components/           # Feature-only React components
│   ├── hooks/                # Feature-only hooks
│   ├── stores/               # Feature-only Zustand stores
│   ├── schemas/              # Zod schemas
│   ├── lib/                  # Feature-only utilities
│   ├── server/               # Server Actions, RSC-only fetchers
│   ├── types.ts
│   ├── index.ts              # PUBLIC API (only exit point)
│   └── README.md
└── shared/                   # ONLY cross-feature surface
    ├── components/{ui,layout}/
    ├── hooks/
    ├── lib/                  # api client, websocket base, currency, date
    ├── stores/               # auth, locale
    └── schemas/
```

### 3.2 The three boundary rules

1. **A feature never imports from another feature.** Not even via the public API. If two features need it, promote to `shared/`.
2. **Cross-feature reuse only via `shared/`.** Code used by ≥2 features lives in `shared/`. Code used by 1 feature lives inside that feature.
3. **Outside imports of a feature go through `index.ts`.** `app/` and `shared/` import via `@/features/<feature>` only. Deep imports forbidden.

Within the same feature: relative imports are encouraged.

### 3.3 Public API

Every feature exports its surface from `features/<feature>/index.ts`. Anything not exported is private. Be conservative — re-export the minimum.

```ts
// features/vibe-booking/index.ts
export { default as SplitScreenLayout } from './components/SplitScreenLayout'
export { useVibeBookingStore } from './stores/vibe-booking.store'
export { ContentPayloadSchema, type ContentPayload } from './schemas/content-payload'
```

### 3.4 Wrong vs. right

```ts
// ❌ Deep import into another feature
import { useVibeBookingStore } from '../../vibe-booking/stores/vibe-booking.store'

// ❌ Cross-feature import even via public API
import { useVibeBookingStore } from '@/features/vibe-booking'   // (from inside features/payments/)

// ❌ Legacy flat alias (banned post-migration)
import { useVibeBookingStore } from '@/stores/vibe-booking.store'

// ✅ Promoted to shared/ — both features import it from there
import { useSessionStore } from '@/shared/stores/session.store'

// ✅ Same-feature relative import
import { useVibeBookingStore } from '../stores/vibe-booking.store'

// ✅ app/ consuming a feature via its public API
import { SplitScreenLayout } from '@/features/vibe-booking'
```

### 3.5 What goes in `shared/`

✅ shadcn primitives, app chrome (Header/BottomNav), HTTP/WebSocket clients, currency/date utils, auth/locale stores, cross-feature schemas (user, money, pagination).
❌ Code used by exactly one feature, route-specific layout, feature business logic dressed up as a util.

### 3.6 Promotion path (when two features need the same code)

1. Code lives inside Feature A.
2. Feature B needs it. **Stop. Do not import from A.**
3. Move to `shared/<area>/`. Update A's imports.
4. Both features import from `shared/`.

### 3.7 Enforcement

| Mechanism | Status |
|---|---|
| `eslint-plugin-boundaries` (cross-feature + deep import errors) | Decided, not yet wired up |
| `no-restricted-imports` (legacy `@/components`, `@/hooks`, etc.) | Decided, not yet wired up |
| PR Definition of Done gate | Active — see [`governance.md`](../../docs/platform/frontend/governance.md) |

Until the lint plugin is wired up, this document and PR review are the enforcement.

### 3.8 New feature checklist

- [ ] Approved design doc exists at `docs/platform/frontend/design/features/<feature>.md` (per [ADR-0008](../../docs/platform/frontend/adr/0008-frontend-feature-design-docs-location-and-lifecycle.md)). Status moved from `Approved` → `Implementing` in the first PR.
- [ ] `features/<feature>/` created with at minimum `index.ts` + `README.md`.
- [ ] Subfolders created only as code lands (no empty placeholders).
- [ ] Reference doc authored at `docs/platform/frontend/reference/features/<feature>.md` from [`_template-feature.md`](../../docs/platform/frontend/_template-feature.md).
- [ ] Public API in `index.ts` is minimal.
- [ ] No imports from other features (verify before pushing).

---

## 4. TypeScript

### Strict
- `strict: true` is non-negotiable. Don't relax flags to silence errors — fix the type.
- `npm run typecheck` (`tsc --noEmit`) must pass before PR.

### Banned
- `any` → use `unknown` + Zod parse or type guard.
- `as` casts on values you didn't construct → write a guard.
- `Function`, `Object`, `{}` → use specific signatures.
- Non-null `!` on values you can't prove non-null.
- TypeScript `enum` → use `as const` objects or literal unions.

### Patterns

```ts
// Discriminated unions
type Result<T> = { status: 'ok'; data: T } | { status: 'error'; message: string }

// as const for literal narrowing
const STATUSES = ['pending', 'confirmed', 'cancelled'] as const
type Status = (typeof STATUSES)[number]

// satisfies — type-check without widening
const config = { retries: 3, timeoutMs: 5000 } satisfies RequestConfig

// Validate at every external boundary
const parsed = MessageSchema.parse(rawSocketEvent)
```

- Prefer `type` for unions/intersections, `interface` for extendable object shapes.
- Mark immutable data `readonly`.
- Exported functions get explicit return types.
- Type-only imports use `import type { … }`.

---

## 5. React 19 + Next.js 16 (App Router)

### Server vs. client
- **Default to Server Components.** `'use client'` only when the file uses hooks, browser APIs, event handlers, or client state.
- Server Components must not import `zustand`, `react-query`, `framer-motion`, or anything touching `window`/`document`.
- Push `'use client'` as deep as possible — wrap a small island, not a whole page.

### Per §1, this app uses Next.js for UI and BFF only

- **Route Handlers (`app/.../route.ts`) are restricted to:** BFF proxying (e.g., setting/clearing httpOnly cookies on auth refresh), Vercel-cron triggers, healthchecks, image/asset transforms.
- **Route Handlers are NOT for:** business logic, DB writes, payment processing, anything that belongs in NestJS. If you're tempted to write it here, write it in `backend/` instead and call it.
- **Server Actions** can be used for form submits, but they call the NestJS API. They never touch the DB directly.
- **No `prisma` import in this tree.** Ever.

### Navigation & metadata
- Internal links: `next/link`. Programmatic nav: `useRouter` from `next/navigation`.
- Server-side redirect: `redirect()`. Server-side 404: `notFound()`. Both from `next/navigation`.
- Pages export `metadata` or `generateMetadata`. No raw `<title>` in JSX.

### Images & fonts
- `next/image` with explicit `width`/`height` or `fill`. Raw `<img>` only for inline SVG icons.
- Fonts via `next/font` (Geist already wired). Never `<link>` for fonts.

### Caching
- Server Component `fetch` is cached by default. Use `{ cache: 'no-store' }` for per-request, `{ next: { revalidate: N } }` for ISR.
- After a Server Action mutation: `revalidatePath('/path')` or `revalidateTag('tag')`.

### Hooks
- Don't call hooks conditionally. exhaustive-deps must pass without disable comments.
- Cleanup every effect that subscribes (listeners, timers, sockets, observers).

---

## 6. State & data

Per [ADR-0002](../../docs/platform/frontend/adr/0002-state-management-split.md):

| State kind | Tool | Example |
|---|---|---|
| Server data | React Query | trips, profile, bookings |
| Client UI state | Zustand | nav-open, theme, locale |
| Form state | React Hook Form | login, booking form |
| URL state | `useSearchParams` | filters, pagination |
| Local component state | `useState`/`useReducer` | input value, hover |

- **Never store server data in Zustand** (it goes stale).
- **Never store form state in Zustand.**
- React Query keys are arrays: `['trips', { province, sort }]`.
- Invalidate on mutation: `queryClient.invalidateQueries({ queryKey: ['trips'] })`.
- Zustand stores: `features/<x>/stores/<x>.store.ts` (feature-local) or `shared/stores/` (cross-feature, see §3.5).

---

## 7. Backend integration

Per §1, the frontend talks only to the NestJS backend (`/v1/*`) and the AI agent (WebSocket). Per [ADR-0002](../../docs/platform/frontend/adr/0002-state-management-split.md) and [ADR-0003](../../docs/platform/frontend/adr/0003-auth-and-session-model.md):

- **One HTTP client.** Lives at `shared/lib/api/`. Axios with auth interceptor + 401 refresh handler. Configured from env: `NEXT_PUBLIC_API_BASE_URL` (browser) or server-side env (RSC/Route Handler).
- **All client calls go through React Query hooks** that use the shared client. No raw `fetch`/`axios.get` inline in components.
- **Server Components fetch via the shared server-side client** (or `fetch` with the same base URL). Never reach into `prisma`.
- **Envelope unwrap.** Backend returns `{ success, data, message, error? }`. The client unwraps to `data` and throws on `success === false`. Hooks see `data` only.
- **Auth tokens.** Access token in memory (Zustand `auth.store` in `shared/stores/`). Refresh token in `httpOnly Secure SameSite=Strict` cookie set by the backend (or via a Route Handler proxy if cross-origin requires it). Never read tokens from `localStorage`.
- **WebSocket (AI chat).** Connects directly to the AI agent service URL from env. Auth handshake sends the access token in the first message. Reconnect with exponential backoff.
- **Errors.** 401 triggers refresh-and-retry once; failure logs the user out. 5xx surfaces a toast. Network errors retry per React Query defaults.
- **CORS.** Backend whitelists the frontend origin. If you change origins, update the backend CORS allow-list.

---

## 8. Forms

- React Hook Form + Zod, every time:

```tsx
'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
type FormData = z.infer<typeof schema>

export function LoginForm() {
  const form = useForm<FormData>({ resolver: zodResolver(schema) })
  // ...
}
```

- Disable submit while `formState.isSubmitting`.
- Show field errors inline (`formState.errors.<field>?.message`).
- Schemas live next to the form, or in `features/<x>/schemas/` if shared across that feature's forms.
- Server Actions validate the same Zod schema before forwarding to the backend.

---

## 9. Styling

- Tailwind v4 utility classes. Design tokens via CSS variables in `app/globals.css`.
- shadcn primitives in `shared/components/ui/`. Compose, don't fork per feature.
- `prettier-plugin-tailwindcss` sorts class lists.
- No inline `style` for static styling. No CSS-in-JS runtime libs.
- Use semantic tokens (`text-muted-foreground`, `bg-primary`) over raw colors.

---

## 10. i18n

Per [ADR-0004](../../docs/platform/frontend/adr/0004-i18n-routing-strategy.md):

- All user-facing strings go through `useTranslations()` (client) or `getTranslations()` (server). **No hardcoded English in JSX.**
- Keys are dot-namespaced: `t('booking.confirm.cta')`.
- Locale-aware routing via `[locale]` segment + `next-intl` middleware. Locales: `en`, `zh`, `km`.
- Format dates/numbers via `Intl` or `next-intl`'s formatters. Never `toLocaleString()` without an explicit locale.

---

## 11. Accessibility

- Semantic HTML first: `<button>` for actions, `<a>` for nav, landmark elements for structure.
- Every input has a linked `<label>`. Icon-only buttons need `aria-label`.
- Color is never the only signal.
- Focus styles must remain visible.
- Fix `eslint-plugin-jsx-a11y` warnings; don't disable.

---

## 12. Performance

- `next/image` with explicit dimensions for content images.
- `dynamic(() => import('./Heavy'), { ssr: false })` for heavy client-only components below the fold.
- Memoize only when a profile shows it matters.
- Pagination on every list. Default 20, max 100. Never load unbounded lists.
- React Query: tune `staleTime` per query type.
- Bundle: `import { format } from 'date-fns/format'`, not `import * from 'date-fns'`.

---

## 13. Security

- Never hardcode secrets. Browser-exposed env vars must be `NEXT_PUBLIC_*`.
- `dangerouslySetInnerHTML` is banned without sanitizer (`DOMPurify`) + review.
- `target="_blank"` requires `rel="noopener noreferrer"`.
- Validate every external input with Zod (URL params, WebSocket messages, postMessage, localStorage reads).

---

## 14. Errors & logging

- Error Boundaries per route segment via `error.tsx`.
- React Query global error handler shows a toast. Components don't render raw error strings.
- `console.log` dev only. Production logs via Sentry. Never log full request bodies or PII.

---

## 15. Testing

Per [ADR-0005](../../docs/platform/frontend/adr/0005-testing-stack.md):

- Unit/component: Vitest + React Testing Library, co-located `*.test.tsx`.
- E2E: Playwright in `frontend/e2e/`.
- Mocks: MSW.
- Test behavior (query by role/text), not implementation (no class-name or test-id soup).
- Every feature ships with at least one happy-path test.

---

## 16. Naming

| What | Convention | Example |
|---|---|---|
| Component file | `PascalCase.tsx` | `BookingCard.tsx` |
| Hook file | `use-kebab-case.ts` | `use-booking.ts` |
| Utility file | `kebab-case.ts` | `format-currency.ts` |
| Store file | `feature.store.ts` | `auth.store.ts` |
| Schema file | `kebab-case.ts` | `content-payload.ts` |
| Component | `PascalCase` | `<BookingCard />` |
| Hook | `useFooBar` | `useBooking()` |
| Var/function | `camelCase` | `formatPrice` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Type/interface | `PascalCase` | `BookingDto` |
| Boolean | `is`/`has`/`can` prefix | `isLoading` |
| Event prop | `onX` | `onSubmit` |
| Event handler | `handleX` | `handleSubmit` |

---

## 17. Imports

Cross-feature and deep-import rules: see §3. Order — blank line between groups:

```ts
// 1. Built-ins / framework
import { useState } from 'react'
import Link from 'next/link'

// 2. Third-party
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

// 3. Internal aliases — shared first, then own feature's public API only
import { Button } from '@/shared/components/ui/button'
import { useVibeBookingStore } from '@/features/vibe-booking'

// 4. Relative (within the same feature)
import { ChatPanel } from './ChatPanel'

// 5. Type-only last
import type { ContentItem } from '../types'
```

---

## 18. Definition of Done

- [ ] §3 boundary rule passes — no cross-feature imports, no deep imports, no legacy `@/components|hooks|stores|schemas|lib|types` aliases.
- [ ] §1 backend rule passes — no `prisma`, no DB access, no business logic in Route Handlers or Server Actions.
- [ ] If a new feature: an Approved design doc exists at `docs/platform/frontend/design/features/<feature>.md` (per [ADR-0008](../../docs/platform/frontend/adr/0008-frontend-feature-design-docs-location-and-lifecycle.md)), and its `Status` is updated by this PR.
- [ ] New feature: own folder under `features/`, `index.ts` public API, `README.md` linking to its reference doc.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (no disable without `// eslint-disable-next-line` + reason).
- [ ] `npm run format:check` passes.
- [ ] At least one test for new behavior.
- [ ] No `console.log`, no commented-out code, no untracked `TODO`.
- [ ] All user-facing strings are i18n keys.
- [ ] No new `any`, no new `as` cast on untrusted input.
- [ ] Touching auth/payments/AI tools: read the corresponding `docs/modules/<area>/` first.

Full DoD: [`governance.md`](../../docs/platform/frontend/governance.md).
