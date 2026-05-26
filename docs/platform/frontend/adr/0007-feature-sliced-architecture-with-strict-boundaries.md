# ADR-0007: Feature-sliced architecture with strict boundaries (`app/` routes, `features/<x>/` self-contained, `shared/` cross-feature)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `architecture`, `modularity`, `boundaries`, `lint`, `scaling` |

---

## Context

When [ADR-0001](./0001-app-router-server-components-default.md) and the original [`architecture.md`](../architecture.md) were written, the folder layout was *"co-locate by feature, not by file type"* — but in practice that produced a flat top-level layout where each "kind of thing" had its own folder:

```
frontend/
├── components/<feature>/    # UI per feature, but pooled in one tree
├── hooks/                   # All hooks for all features
├── stores/                  # All Zustand stores
├── schemas/                 # All Zod schemas
├── lib/                     # All utilities
└── types/                   # All domain types
```

That layout has three problems at scale:

- **Imports are unconstrained.** Anyone can import from anywhere. `bookings` ends up reaching into `vibe-booking/components/ChatBubble` because it's "right there", and the dependency graph quietly becomes a hairball.
- **Cohesion is split across six folders.** Looking at `vibe-booking` requires opening `components/vibe-booking/`, `stores/vibe-booking.store.ts`, `schemas/vibe-booking.ts`, `hooks/useWebSocket.ts`, `lib/websocket.ts`, and `types/vibe-booking.ts`. Reasoning about a feature requires a wide visual scan.
- **Cross-feature reuse is invisible.** It's impossible to tell from a directory listing which components are "internal to this feature" vs "intentionally shared across features". Promotion to shared happens by accident.

The product surface (auth, bookings, vibe-booking, hotel-booking, my-trip, payments, profile, loyalty, …) will produce **15+ feature modules** before MVP. The flat layout does not scale to that count.

When this decision was taken:

- The frontend has exactly one feature with non-trivial code: `vibe-booking` (components, store, schema, websocket hook, and types).
- All four cross-cutting plugins required by `eslint-config-next` are already present (`eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`).
- No Prettier config exists; semicolon and quote conventions live only in [`.kiro/steering/tech.md`](../../../../.kiro/steering/tech.md).
- ADR-0006 has already established that **per-feature documentation** lives at `docs/platform/frontend/reference/features/<feature>.md`. This ADR is the **code-side mirror** of that decision.

Constraints (per the user's intent and the existing steering files):

- **Strict boundary.** A component or helper local to a feature must not be importable by another feature. Cross-feature reuse only via `shared/`.
- **`app/` is routes.** Page files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`) and route handlers (`route.ts`). Nothing else.
- **One feature, one folder.** Components, hooks, stores, schemas, lib, types, server actions — everything related to a feature lives inside that feature's folder.
- **Public API per feature.** Other parts of the app may only import what the feature explicitly exports from its `index.ts`.
- **Enforced by lint, not docs.** A rule that isn't enforced by lint or CI does not exist (per [`governance.md`](../governance.md)).

---

## Decision

We will adopt a **feature-sliced layout** with three top-level code containers and a single, lint-enforced rule about who may import from whom:

```
frontend/
├── app/                     # ROUTES ONLY — page.tsx, layout.tsx, error.tsx, loading.tsx, route.ts
├── features/<feature>/      # Self-contained: components, hooks, stores, schemas, lib, server, actions, types, index.ts
├── shared/                  # Cross-feature: components/ui, components/layout, hooks, lib, stores, schemas, types
├── messages/                # i18n bundles (en/zh/km.json) — by ADR-0004
├── i18n/                    # next-intl config — by ADR-0004
├── middleware.ts            # By ADR-0003 + ADR-0004
└── eslint.config.mjs, tsconfig.json, next.config.ts, …
```

The boundary rule, enforced by **`eslint-plugin-boundaries`**:

> - **`app/`** may import from `features/<x>` (via the feature's `index.ts` only) and from `shared/`.
> - **`features/<x>/`** may import from itself (relative paths) and from `shared/`. **It must not import from any other feature**, period.
> - **`shared/`** may import from `shared/` only.
> - All non-self imports of a feature must hit its **public API** (`features/<x>/index.ts`). Importing `features/<x>/components/Foo` from outside the feature is forbidden.

Cross-feature reuse has exactly one mechanism: **promote to `shared/`**. There is no "feature-to-feature public API". When two features need the same UI primitive, the primitive moves into `shared/`. This forces a deliberate decision (and a small refactor) every time something becomes cross-feature.

> The boundary is: **`shared/` is the only cross-feature surface. Inside a feature, anything goes. Across features, nothing crosses without going through `shared/`.**

---

## Options considered

### Option A — Keep the flat layout (`components/`, `hooks/`, `stores/`, …)

- **Pros:** Zero migration cost. Familiar to anyone who's done a small Next.js project.
- **Cons:** Already showing the cohesion problem with one feature; will compound across 15+ features. No mechanical way to enforce boundaries. Promotion to shared is invisible.

### Option B — Feature folders with public API but no cross-feature rule (features can import each other through index.ts)

- **Pros:** Pragmatic — when feature A genuinely needs feature B's `<HotelCard>`, it imports from `@/features/hotels`.
- **Cons:** Soft boundary. The first cross-feature import opens the door for the rest. The dependency graph becomes a directed graph between features instead of a clean tree under `shared/`. Hard to refactor a feature without breaking unknown consumers.

### Option C — Feature-sliced with strict boundary, `shared/` is the only cross-feature surface *(chosen)*

- **Pros:**
  - A feature has exactly two consumers it must care about: itself and `app/`. Refactors stay local.
  - Cohesion is high: `vibe-booking` is one folder, end to end.
  - `shared/` is the deliberate cross-feature contract — touching it requires intent and review.
  - The boundary is **mechanically enforceable** with `eslint-plugin-boundaries` (`element-types`, `entry-point`, `no-private`). PRs that violate the rule fail CI.
  - Aligns with the per-feature documentation home in [ADR-0006](./0006-per-feature-frontend-reference-docs-location.md): one folder of code, one reference doc.
- **Cons:**
  - When two features need the same primitive, you must move it to `shared/`. We accept the friction; it's the correct refactor.
  - Migration cost: existing vibe-booking code must move. We do this as part of accepting the ADR.
  - Finer-grained re-exports (per-folder index.ts inside a feature) are tempting but not required.

### Option D — A monorepo with one package per feature (Nx, Turborepo)

- **Pros:** The strongest possible boundary — each feature is its own package.
- **Cons:** Heavy tooling overhead for a single Next.js app maintained by a small team. The boundary is enforceable far more cheaply with ESLint. Revisit only if the app outgrows the boundaries plugin.

**Chosen:** Option C. It gives the strongest boundary that lint can express in a single Next.js app, and it forces deliberate thinking about cross-feature reuse without a packaging tax.

---

## Consequences

### Positive

- **Locality.** A feature is one folder; deleting it is one `rm -rf`.
- **Cohesion.** Components, state, schemas, and hooks for a feature sit next to each other. Onboarding to a feature is fast.
- **Mechanical boundary.** `eslint-plugin-boundaries` rejects cross-feature imports at lint time. CI catches violations on every PR.
- **Public API discipline.** `features/<x>/index.ts` is the explicit contract — readable by humans, enforced by lint.
- **Aligns with per-feature docs.** [ADR-0006](./0006-per-feature-frontend-reference-docs-location.md)'s `reference/features/<feature>.md` now describes a single folder of code, not scattered files.
- **Scales.** Adding feature 15 doesn't add a single line to a top-level folder; it adds one new feature folder.

### Negative

- **Migration cost (one-time).** Existing vibe-booking files move; their imports update. Done as part of accepting this ADR.
- **Cross-feature reuse requires a refactor.** A primitive that "should" be shared across two features must be moved. We accept this as the right cost.
- **One feature, many subfolders.** `features/<x>/` itself has subfolders (components, hooks, stores, …). The depth is real but discoverable: each feature is a mini-app.
- **Boundary plugin is a new dep.** `eslint-plugin-boundaries` adds ~150 KB to `node_modules`. Acceptable.

### Neutral / things we accept

- **Files at the very top level** (`middleware.ts`, `next.config.ts`, `eslint.config.mjs`, etc.) are not part of any element. Lint rules don't apply to them; they are configuration, not feature or shared code.
- **`app/` files import features via `@/features/<x>`** (the package-style entry) — never deep paths.
- **Inside a feature, relative imports are preferred** (`./components/Foo` rather than `@/features/<x>/components/Foo`). Both work; relative imports survive feature renames cleanly.
- **No nested feature folders** (e.g., `features/payments/loyalty/`). Loyalty is its own top-level feature. Use composition via `shared/`, not nesting.
- **Tests are co-located with their subject** (`components/Foo.test.tsx` next to `Foo.tsx`). Tests inherit the boundary rules of their location.

---

## Implementation

### Folder layout (after migration)

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── error.tsx                       # When added
│   ├── not-found.tsx                   # When added
│   └── vibe-booking/
│       └── page.tsx                    # Imports from @/features/vibe-booking only
│
├── features/
│   ├── vibe-booking/
│   │   ├── components/
│   │   │   ├── SplitScreenLayout.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ContentStage.tsx
│   │   │   └── renderers/              # 14 renderer components
│   │   ├── hooks/
│   │   │   └── use-websocket.ts        # Renamed from useWebSocket.ts (kebab-case per conventions)
│   │   ├── stores/
│   │   │   ├── vibe-booking.store.ts
│   │   │   ├── chat.store.ts           # Currently unused; flagged in feature README for cleanup
│   │   │   └── content.store.ts        # Currently unused; flagged in feature README for cleanup
│   │   ├── schemas/
│   │   │   └── content-payload.ts      # Renamed from vibe-booking.ts (descriptive within feature scope)
│   │   ├── lib/
│   │   │   └── websocket-manager.ts    # Renamed from websocket.ts
│   │   ├── types.ts                    # Renamed from types/vibe-booking.ts (descriptive within feature scope)
│   │   ├── index.ts                    # PUBLIC API — only this is importable from app/ or other code
│   │   └── README.md                   # Per-feature notes; doc lives in docs/platform/frontend/reference/features/
│   │
│   └── <other features land here>/     # auth, bookings, hotel-booking, my-trip, payments, profile, loyalty, …
│       └── (same shape)
│
├── shared/                             # Cross-feature only; importable from anywhere
│   ├── components/
│   │   ├── ui/                         # shadcn/ui primitives (Button, Input, Dialog, BottomSheet, Toast)
│   │   └── layout/                     # BottomNav, TopBar, Skeleton, EmptyState
│   ├── hooks/                          # Cross-feature hooks (e.g., use-has-hydrated)
│   ├── lib/                            # api-client, env, currency, formatters
│   ├── stores/                         # Truly cross-feature stores (auth.store, locale.store)
│   ├── schemas/                        # Shared Zod schemas (envelope, error)
│   ├── types/                          # Domain types used by 2+ features (User, Locale, Currency)
│   └── README.md
│
├── messages/                           # i18n bundles per ADR-0004
├── i18n/                               # next-intl config per ADR-0004
├── middleware.ts                       # Per ADR-0003 + ADR-0004 (created when implemented)
├── eslint.config.mjs                   # Boundary rules, no-restricted-imports for legacy paths, Prettier-compat
├── .prettierrc.json
├── .prettierignore
├── tsconfig.json                       # Path aliases: @/features/*, @/shared/*, @/* fallback
├── next.config.ts
└── package.json
```

### Path aliases (`tsconfig.json`)

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],                    // Existing — kept as a fallback
      "@/features/*": ["./features/*"],
      "@/shared/*": ["./shared/*"]
    }
  }
}
```

### ESLint boundaries — element types and rules

```js
// eslint.config.mjs (excerpt)
import boundaries from 'eslint-plugin-boundaries'

export default [
  // …existing config…
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app',     pattern: 'app/**/*' },
        { type: 'feature', pattern: 'features/*', mode: 'folder', capture: ['featureName'] },
        { type: 'shared',  pattern: 'shared/**/*' },
        { type: 'i18n',    pattern: 'i18n/**/*' },
        { type: 'messages', pattern: 'messages/**/*' },
      ],
      'boundaries/ignore': ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'app',     allow: ['app', 'feature', 'shared', 'i18n', 'messages'] },
          { from: 'feature', allow: [
            ['feature', { featureName: '${from.featureName}' }],   // self only
            'shared',
            'i18n',
            'messages',
          ] },
          { from: 'shared',  allow: ['shared'] },
          { from: 'i18n',    allow: ['i18n', 'shared', 'messages'] },
          { from: 'messages', allow: ['messages'] },
        ],
      }],
      'boundaries/entry-point': ['error', {
        default: 'disallow',
        rules: [
          { target: 'app',      allow: '**' },
          { target: 'feature',  allow: 'index.{ts,tsx}' },         // public API only from outside
          { target: 'shared',   allow: '**' },
          { target: 'i18n',     allow: '**' },
          { target: 'messages', allow: '**' },
        ],
      }],
      'boundaries/external': ['error', { default: 'allow' }],
    },
  },
]
```

### Public API (`features/<x>/index.ts`)

A feature's `index.ts` re-exports exactly what the rest of the app may consume. For `vibe-booking` after migration:

```ts
// features/vibe-booking/index.ts
export { default as SplitScreenLayout } from './components/SplitScreenLayout'
export { useVibeBookingStore } from './stores/vibe-booking.store'
export { ContentPayloadSchema, type ContentPayload } from './schemas/content-payload'
```

Anything not re-exported is **internal**: the boundary plugin's `entry-point` rule rejects deep imports.

### Legacy path forbidding (`no-restricted-imports`)

ESLint also forbids imports from the **old** top-level paths to catch any code that gets recreated under those paths:

```js
'no-restricted-imports': ['error', {
  patterns: [
    { group: ['@/components/*'], message: 'Moved. Use @/shared/components/* or @/features/<feature>/' },
    { group: ['@/hooks/*'],      message: 'Moved. Use @/shared/hooks/* or @/features/<feature>/' },
    { group: ['@/stores/*'],     message: 'Moved. Use @/shared/stores/* or @/features/<feature>/' },
    { group: ['@/schemas/*'],    message: 'Moved. Use @/shared/schemas/* or @/features/<feature>/' },
    { group: ['@/lib/*'],        message: 'Moved. Use @/shared/lib/* or @/features/<feature>/' },
    { group: ['@/types/*'],      message: 'Moved. Use @/shared/types/* or @/features/<feature>/' },
  ],
}],
```

### Prettier setup (cross-cutting; not strictly part of the boundary rule, but bundled with this ADR)

- Add `prettier`, `prettier-plugin-tailwindcss`, `eslint-config-prettier` to `devDependencies`.
- Per [`.kiro/steering/tech.md`](../../../../.kiro/steering/tech.md) (frontend): no semicolons, single quotes, 2-space indent, trailing commas. Print width 100. Tailwind class sorting via `prettier-plugin-tailwindcss`.
- ESLint extends `eslint-config-prettier` last so style rules don't fight Prettier.

### Migration plan (one PR)

1. Add `eslint-plugin-boundaries`, `eslint-config-prettier`, `prettier`, `prettier-plugin-tailwindcss` to `package.json`. Keep versions pinned per [`.kiro/steering/conventions.md`](../../../../.kiro/steering/conventions.md).
2. Add path aliases `@/features/*` and `@/shared/*` to `tsconfig.json`.
3. Rewrite `eslint.config.mjs` with the rules above.
4. Create `frontend/.prettierrc.json` and `.prettierignore`.
5. Create empty `features/` and `shared/` folders, each with a `README.md` describing the boundary rule.
6. Move existing `vibe-booking` files into `features/vibe-booking/<subfolder>/`. Update internal imports from `@/...` to relative paths within the feature.
7. Create `features/vibe-booking/index.ts` exporting only the public surface.
8. Update `app/vibe-booking/page.tsx` to import from `@/features/vibe-booking` (public API).
9. Delete the now-empty `frontend/components/`, `frontend/hooks/`, `frontend/stores/`, `frontend/schemas/`, `frontend/lib/`, `frontend/types/` folders.
10. Update [`architecture.md`](../architecture.md) and [`_template-feature.md`](../_template-feature.md) to describe the new layout.
11. Update [`governance.md`](../governance.md) Definition of Done with the boundary lint rule.

### Anti-patterns this decision rules out

- ❌ Importing from another feature: `import { Foo } from '@/features/bookings/components/Foo'` is a lint error. Move `Foo` to `shared/` if both features need it.
- ❌ Importing internals of your own feature via `@/features/<x>/...` from outside (e.g., from `app/`). Use the public `@/features/<x>` index.
- ❌ Adding files under `frontend/components/`, `frontend/hooks/`, `frontend/stores/`, `frontend/schemas/`, `frontend/lib/`, `frontend/types/` at the top level. Those folders are gone; lint forbids `@/components/*` etc.
- ❌ Putting non-route code in `app/`. `app/` is page files, layouts, loading/error boundaries, and route handlers. UI components, hooks, stores, schemas, etc. live in `features/` or `shared/`.
- ❌ Creating a feature folder for something that's actually a primitive (Button, Input, Dialog). Primitives live in `shared/components/ui/`.
- ❌ Mass re-exporting everything from `features/<x>/index.ts` to "make boundaries less annoying". The index is a curated public API; if it grows large, the feature is doing too much.

---

## Links

- Related ADRs:
  - [ADR-0001](./0001-app-router-server-components-default.md) — App Router + RSC default; `app/` shape pre-dates this ADR but is fully consistent with it.
  - [ADR-0002](./0002-state-management-split.md) — Stores live inside their feature (Zustand) or in `shared/stores/` (cross-feature). React Query hooks live in `features/<x>/hooks/`.
  - [ADR-0003](./0003-auth-and-session-model.md) — `auth.store` lives in `shared/stores/` (every feature reads it); `auth` feature owns the auth UI/forms.
  - [ADR-0004](./0004-i18n-routing-strategy.md) — `i18n/` and `messages/` are top-level config, not features.
  - [ADR-0005](./0005-testing-stack.md) — Tests are co-located with the code they test; the boundary rules ignore test files.
  - [ADR-0006](./0006-per-feature-frontend-reference-docs-location.md) — Per-feature **docs** live at `docs/platform/frontend/reference/features/<x>.md`. This ADR is the **code-side** mirror.
- Related docs: [`../architecture.md`](../architecture.md), [`../_template-feature.md`](../_template-feature.md), [`../governance.md`](../governance.md).
- External:
  - [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
  - [Feature-Sliced Design](https://feature-sliced.design/) — independent inspiration; we adopt the *spirit* (slice by feature, strict boundary) without the FSD-specific layer naming.

---

## History

| Date | Change |
|------|--------|
| 2026-05-22 | Created and Accepted. Migrates the existing flat layout to feature-sliced; vibe-booking is the proof-point migration. |
