# ADR-0005: Testing stack — Vitest + React Testing Library + Playwright + MSW

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `testing`, `quality`, `ci` |

---

## Context

The frontend ships a booking + payment + AI-chat product. Tests are the only mechanism that survives team rotation, framework upgrades, and the constant pressure to "just ship it". A fragile or slow test suite gets bypassed; a thorough but legible one gets used.

The frontend has three test shapes:

- **Unit tests** — pure functions, schemas, state transitions in stores, React Query select/transform helpers, validation logic. Fast (<1s per file), no browser.
- **Component tests** — a single component plus its hooks rendered into a JSDOM-like environment, asserted against the DOM. The vast majority of meaningful frontend tests live here. They include forms, cards, the AI content renderer, and bottom sheets.
- **End-to-end tests** — a real browser driving real flows: sign in, search a trip, book it, pay it, see it in My Trips. Slow (10s–60s per spec), high signal.

Cross-cutting needs:

- **HTTP mocking** that works in unit, component, *and* E2E tiers. We do not want one mocking strategy for Vitest and another for Playwright; the cognitive cost is too high.
- **Server Components support** ([ADR-0001](./0001-app-router-server-components-default.md)) — the test runner must handle async server components, RSC payloads, and React 19 features.
- **Async-rich UI** — React Query, WebSocket (Vibe Booking), Suspense, hydration. The test runner must understand modern async React.
- **Speed** — running the unit + component tier on every commit must take well under a minute on a developer laptop.

When this decision was taken:

- `frontend/package.json` lists no test runner.
- `package.json`'s `scripts` block does not include a `test` entry.
- No `vitest.config.ts` or `playwright.config.ts` exists.
- The codebase has Zod schemas (`schemas/vibe-booking.ts`), Zustand stores, and a WebSocket client that all need test coverage from day one of feature work.

Constraints:

- **One unit/component runner.** Mixing Jest and Vitest in one repo creates config drift and breaks IDE features.
- **One E2E runner.** Same reason.
- **No real backend in tests.** All HTTP must be mocked deterministically. We do not want flaky tests caused by a dev server being up or down.
- **Shared mocks across tiers.** A single source of truth for "what the backend looks like in tests".

---

## Decision

We will use a four-tool stack with one runner per concern:

- **Vitest** — unit and component test runner. Native ESM, native TypeScript, native Vite/Turbopack alignment, fast watch mode, Jest-compatible API (`describe` / `it` / `expect`).
- **React Testing Library** + **`@testing-library/jest-dom`** + **`@testing-library/user-event`** — the DOM assertion + interaction layer for component tests. Encourages role-/label-based queries that double as accessibility checks.
- **Playwright** — end-to-end runner. Multi-browser (Chromium, WebKit, Firefox), mobile viewport projects (iPhone, Pixel), trace viewer, and reliable parallel execution.
- **MSW (Mock Service Worker) v2** — a single set of handlers that mock backend HTTP for unit, component, *and* E2E tests. The same `handlers.ts` is consumed by Vitest's setup file and by Playwright via the `node` integration.

> The boundary is: **Vitest owns the unit + component tier. Playwright owns the E2E tier. MSW provides the backend mock for both. No other test runners exist in this repo.**

---

## Options considered

### Option A — Jest + React Testing Library + Cypress + Nock

- **Pros:** Mature, well-known.
- **Cons:** Jest's ESM/TypeScript story still requires Babel + ts-jest plumbing that's slower and more brittle than native ESM. Jest does not understand Vite-style module resolution; aligning paths/aliases with Next.js is error-prone. Cypress's component testing has improved but remains weaker for parallelism and mobile viewport ergonomics. Two HTTP mocking layers (one for unit, one for E2E) doubles maintenance.

### Option B — Vitest + RTL + Playwright + MSW *(chosen)*

- **Pros:**
  - Vitest is **fast** — native ESM + Turbopack-like dev loop. Watch mode reruns affected files in milliseconds.
  - Jest-compatible API means the team knows it without learning a new DSL.
  - Playwright handles multi-browser + mobile viewports cleanly; great for our mobile-first target. Trace viewer is the best E2E debugging UX available.
  - MSW gives one set of handlers that covers all tiers; behavior is deterministic and inspectable.
  - All four tools have first-class support for React 19 / Server Components in their current versions.
- **Cons:**
  - Some Jest-only ecosystem libraries don't ship Vitest plugins. We accept this; the gaps are small and shrinking.
  - Playwright's binary cache is large (~300 MB across browsers); we cache it in CI.

### Option C — Storybook + Storybook Test Runner + Playwright

- **Pros:** Visual regression + component dev environment + tests in one tool.
- **Cons:** Storybook is a great component dev environment but a heavy, slow-to-boot test runner. We can adopt Storybook later for design-system docs without tying our test strategy to it.

### Option D — `next test` (Next.js's built-in playground)

- **Pros:** Zero config; aligned with framework.
- **Cons:** Still maturing. Not yet a credible replacement for Vitest's feature surface as of Next.js 16.

**Chosen:** Option B. Speed + mobile viewport coverage + a single mock layer is the combination that maximizes signal-to-effort.

---

## Consequences

### Positive

- Developers get sub-second feedback on unit + component tests in watch mode.
- Mobile-first behavior is verified in CI on real WebKit-iOS and Chromium-Android viewports.
- One MSW handler set means: a contract change to a backend endpoint requires updating exactly one file, and every test tier picks it up.
- Coverage reports are unified (Vitest's V8 coverage; Playwright reports separately by design).
- React Server Component tests are first-class in Vitest 1.6+ via the `vitest-environment-happy-dom` + the official RSC integration.

### Negative

- We need to maintain a small `test/setup.ts` that wires MSW into Vitest, a `playwright.config.ts` that wires MSW node integration into Playwright fixtures, and a shared `mocks/handlers.ts`. Three small files.
- Some libraries (Recharts, Leaflet) need explicit mocking in JSDOM/happy-dom because they hit unsupported browser APIs. We accept the per-library shims.
- Engineers used to Jest will occasionally hit `vi.mock` vs `jest.mock` naming differences. Documented in the testing reference doc.

### Neutral / things we accept

- We do not adopt visual regression testing in v1. If we do later, it will be Playwright's screenshot diffing — not a separate tool.
- We do not adopt Storybook as a *test* runner. We may adopt it later for design-system documentation; that's an additive decision.
- We do not write tests against a real backend in CI. All backend HTTP goes through MSW handlers. Manual exploratory testing against a real backend is fine and unrelated.

---

## Implementation

### Packages to add

```json
{
  "devDependencies": {
    "vitest": "2.1.9",
    "@vitest/coverage-v8": "2.1.9",
    "@vitest/ui": "2.1.9",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/user-event": "14.5.2",
    "happy-dom": "15.11.7",
    "@playwright/test": "1.49.1",
    "msw": "2.7.0"
  }
}
```

Pinned per [`.kiro/steering/conventions.md`](../../../../.kiro/steering/conventions.md). Lockfile committed in the same PR.

### Scripts (`frontend/package.json`)

```json
{
  "scripts": {
    "test": "vitest",
    "test:ci": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

`npm run test` is the watch loop developers leave running. `npm run test:ci` is what CI calls. `npm run test:e2e` is the slower, separate job.

### File layout

```
frontend/
├── vitest.config.ts          # Test runner config; aligns with Next.js path aliases
├── playwright.config.ts      # E2E config: mobile + desktop projects, MSW fixture
├── test/
│   ├── setup.ts              # Wires @testing-library/jest-dom matchers + MSW server
│   └── utils.tsx             # Custom render() that injects QueryClient + IntlProvider + auth store
├── mocks/
│   ├── handlers.ts           # The single source of truth: MSW request handlers
│   ├── data.ts               # Reusable fixture data (trips, users, bookings)
│   └── server.ts             # Node integration for Vitest
└── e2e/
    ├── fixtures.ts           # Playwright fixtures, including MSW node setup
    └── *.spec.ts             # E2E flows
```

### Naming and locations

- Component test files: **co-located** with the component, named `Foo.test.tsx`.
- Hook tests: `use-foo.test.ts` next to the hook.
- Pure utility tests: `bar.test.ts` next to the file.
- E2E tests: `frontend/e2e/<flow>.spec.ts`. Named after the user-facing flow (`booking.spec.ts`, `auth.spec.ts`, `vibe-booking.spec.ts`).

### Coverage targets

| Layer | Target |
|-------|--------|
| Pure utilities (`lib/`, `schemas/`) | 90% lines |
| Stores (`stores/`) | 90% lines |
| Hooks (`hooks/`) | 80% lines |
| Components (`components/`) | 70% lines, 80% for shared/ui primitives |
| Routes (`app/`) | Smoke tests via E2E; unit coverage not enforced |

CI fails on:
- Total project coverage drop > 1% vs main.
- Any uncovered `if`/`switch` branch in `schemas/` (AI content validation; uncovered = silent acceptance of malformed data).

### What gets E2E tested

The minimum E2E set is the **revenue path** and the **safety path**:

1. Sign up → email/password login → log out.
2. Browse home → trip detail → book → pay (Stripe test card) → see booking in My Trips.
3. Open Vibe Booking → send a message → receive AI response → tap "Book this" → end up at confirmation.
4. (When implemented) Cancel a booking → see refund preview.

Everything else lives in component tests.

### CI integration

- **Unit + component:** `npm run test:ci` runs as a required check on every PR. Wall-clock target: < 90 s.
- **E2E:** runs on PRs that touch `app/`, `components/`, `middleware.ts`, or `lib/api-client.ts`. Wall-clock target: < 6 min on a single Chromium project; full matrix runs on `main`.
- **Browser binary cache:** Playwright browsers are cached by their version key in CI to avoid the ~3-min reinstall.

### Documentation that flows from this ADR

- [`reference/testing.md`](../reference/testing.md) — full contract: file naming, `render()` helper, MSW conventions, coverage policy, debugging Playwright traces. Authored once Vitest + Playwright are installed.
- [`guides/write-a-component-test.md`](../guides/write-a-component-test.md) — recipe.
- [`guides/add-an-msw-handler.md`](../guides/add-an-msw-handler.md) — recipe.

### Anti-patterns this decision rules out

- ❌ Snapshot tests for layout-sensitive components. They invert the test pyramid: every Tailwind class change becomes a "test failure". Use role/text assertions.
- ❌ Reaching into component internals via querySelector or test IDs when a role/label query exists. Test IDs are a last resort.
- ❌ Calling the real backend from tests "just for now". MSW handlers exist precisely to remove this temptation.
- ❌ Writing a new mocking layer ("just a fetch stub for this test") instead of adding to MSW handlers.
- ❌ Testing implementation details (e.g., which React Query key was used). Test the behavior the user sees.
- ❌ Skipping a test (`it.skip`) without an issue link in the comment explaining why.

---

## Links

- Related ADRs: [ADR-0001](./0001-app-router-server-components-default.md) (RSC support is a test-runner requirement), [ADR-0002](./0002-state-management-split.md) (the test render helper sets up `QueryClientProvider` + auth store), [ADR-0004](./0004-i18n-routing-strategy.md) (the test render helper sets up `IntlProvider`).
- Related docs: planned [`../reference/testing.md`](../reference/testing.md), [`../governance.md`](../governance.md) (Definition of Done references the test commands).
- External:
  - [Vitest — Getting Started](https://vitest.dev/guide/)
  - [Playwright — Best Practices](https://playwright.dev/docs/best-practices)
  - [MSW v2 — Integrations](https://mswjs.io/docs/integrations)
  - [Testing Library — Guiding Principles](https://testing-library.com/docs/guiding-principles)

---

## History

| Date | Change |
|------|--------|
| 2026-05-22 | Created and Accepted. Establishes the test stack before any test files exist; subsequent feature work is expected to write tests against this stack from day one. |
