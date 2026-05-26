# Frontend Roadmap — Context Pointer

> Canonical roadmap: [`docs/platform/roadmaps/frontend-roadmap.md`](../../docs/platform/roadmaps/frontend-roadmap.md).
> This file is a quick-reference index. The canonical roadmap is the source of truth for phase contents, acceptance criteria, and decision log.

---

## Why this file exists

When picking up work — human or AI — start here to know:
- Which phase the project is in.
- Which work is **decided** (specced, ready to implement) vs. **open** (still being decided).
- Which ADRs and reference docs gate the next step.

If you're about to write code, the order is:
1. Read this file to find the right phase.
2. Open the canonical roadmap section for that phase.
3. Read the ADRs that phase cites.
4. Read [`code-standards.md`](./code-standards.md) and [`architecture.md`](./architecture.md).
5. Implement.

---

## Phases at a glance

| # | Phase | What lands |
|---|---|---|
| 0 | Foundation & Constraints | Runtime contract, target Node/Next/React versions, hard rules. **Decided.** |
| 1 | Core Infrastructure (no UI yet) | Path aliases, ESLint + Prettier, Tailwind v4, env loader, providers, API client, middleware, i18n routing. |
| 2 | Design System & Component Foundation | Design tokens, shadcn primitives in `shared/components/ui/`, layout chrome (`Header`, `BottomNav`). |
| 3 | Authentication Flows | Login/register/reset routes, auth store, route guards, refresh token cookie handshake. |
| 4 | App Shell & Navigation | `(auth)` and `(main)` route groups, locale-aware routing, error/loading/not-found UIs. |
| 5 | Feature Modules — Inventory & Booking | Trip discovery, booking flow, hotels, transport, guides as feature slices. |
| 6 | AI Chat — Vibe Booking | Split-screen page, WebSocket client, content renderer registry, action handlers. |
| 7 | Profile & Account | Profile page, bookings list, settings, language switcher. |
| 8 | Offline, PWA & Performance | Service worker, manifest, offline message queue, image strategy, route caching policy. |
| 9 | Production Readiness | Sentry, analytics, CSP, perf budgets, accessibility audit, deploy pipeline. |

Detailed acceptance criteria for every checkbox in each phase live in the canonical roadmap.

---

## Current status (snapshot)

**Phase in progress:** Phase 0 (decided), Phase 1 (decided, not yet implemented).

**Decided (documented):**
- Runtime contract — [`foundation.md`](../../docs/platform/frontend/foundation.md).
- App Router + RSC default — [ADR-0001](../../docs/platform/frontend/adr/0001-app-router-as-only-routing-model.md).
- State management split — [ADR-0002](../../docs/platform/frontend/adr/0002-state-management-split.md).
- Auth & session model — [ADR-0003](../../docs/platform/frontend/adr/0003-auth-and-session-model.md).
- i18n routing strategy — [ADR-0004](../../docs/platform/frontend/adr/0004-i18n-routing-strategy.md).
- Testing stack — [ADR-0005](../../docs/platform/frontend/adr/0005-testing-stack.md).
- Per-feature reference doc location — [ADR-0006](../../docs/platform/frontend/adr/0006-per-feature-frontend-reference-docs-location.md).
- Feature-sliced layout with strict boundaries — [ADR-0007](../../docs/platform/frontend/adr/0007-feature-sliced-architecture-with-strict-boundaries.md).
- Frontend feature design docs layer + lifecycle — [ADR-0008](../../docs/platform/frontend/adr/0008-frontend-feature-design-docs-location-and-lifecycle.md).

**Decided but NOT yet in the codebase** (Phase 1 work):
- `package.json` does not yet include zustand, @tanstack/react-query, next-intl, vitest, @testing-library/react, @playwright/test, msw, eslint-plugin-boundaries, eslint-config-prettier, prettier, prettier-plugin-tailwindcss.
- `frontend/features/` and `frontend/shared/` folders do not exist yet — current code lives under flat `components/`, `hooks/`, `stores/`, `schemas/`, `lib/`, `types/`. The migration to ADR-0007's layout is a separate PR.
- `frontend/middleware.ts` does not exist.
- `frontend/shared/lib/api/` HTTP client does not exist.
- `frontend/app/[locale]/` route segment does not exist; `app/` is currently flat.
- ESLint flat config is **not yet** extended with `eslint-plugin-boundaries`. The boundary rule is documented but not machine-enforced.
- Prettier is **not yet** configured. The frontend code-style rules are not enforced by tooling.
- No cross-cutting reference docs (`state-and-data.md`, `auth-and-session.md`, etc.) authored yet — they need the underlying code to land first.

**Open (still being decided):**
- Per-route caching strategy (ISR/SSR/static/dynamic).
- Build output mode (`standalone` vs. Vercel vs. static export).
- Mobile-first breakpoints, PWA manifest, Service Worker scope, offline fallback (entire Phase 8 section).

For the live status, defer to the canonical roadmap's "Current Status" section.

---

## How to use this for AI-driven work

When an agent picks up a task:

1. **Locate the phase.** Find which row of the table the task belongs to. If you can't, the task is probably out of scope or not yet decided — flag it.
2. **For a new feature, check for an Approved design doc** at `docs/platform/frontend/design/features/<feature>.md` (per [ADR-0008](../../docs/platform/frontend/adr/0008-frontend-feature-design-docs-location-and-lifecycle.md)). If `Status: Drafting` — finish the design first, do not implement. If missing — author it from [`_template-feature-design.md`](../../docs/platform/frontend/_template-feature-design.md) before any code.
3. **For "what should I design next?", read [`design/QUEUE.md`](../../docs/platform/frontend/design/QUEUE.md).** It is the live, sorted list with owner / status / dependencies. Pick the highest-priority `Not started` row whose dependencies are `Approved` or `Shipped`.
4. **Check status before assuming.** A piece of infrastructure (path alias, API client, middleware, locale routing) may be **decided** but **not yet in the code**. Don't import from something that doesn't exist; either build it as part of the task or stop and surface the dependency.
5. **Read the gating ADRs.** Each phase in the canonical roadmap cites its binding ADRs. Read them before writing code that touches that area.
6. **Stay in your phase.** Don't pull Phase 6 work into a Phase 2 PR. Each phase has acceptance criteria for a reason — drift makes review impossible.
7. **Update the Decision Log.** Any new architectural decision goes into the canonical roadmap's Decision Log table with a new ADR. Don't make decisions only in code.
8. **Update QUEUE.md when design status changes.** Same PR as the doc-status change.

---

## Cross-links

- Roadmap (canonical): [`docs/platform/roadmaps/frontend-roadmap.md`](../../docs/platform/roadmaps/frontend-roadmap.md)
- Architecture: [`docs/platform/frontend/architecture.md`](../../docs/platform/frontend/architecture.md)
- Foundation (runtime contract): [`docs/platform/frontend/foundation.md`](../../docs/platform/frontend/foundation.md)
- Governance (DoD): [`docs/platform/frontend/governance.md`](../../docs/platform/frontend/governance.md)
- ADR index: [`docs/platform/frontend/adr/README.md`](../../docs/platform/frontend/adr/README.md)
- Per-feature design template: [`docs/platform/frontend/_template-feature-design.md`](../../docs/platform/frontend/_template-feature-design.md)
- **Design queue (what to design next):** [`docs/platform/frontend/design/QUEUE.md`](../../docs/platform/frontend/design/QUEUE.md)
- Design layer rules: [`docs/platform/frontend/design/README.md`](../../docs/platform/frontend/design/README.md)
- Per-feature reference template: [`docs/platform/frontend/_template-feature.md`](../../docs/platform/frontend/_template-feature.md)
- Reference docs index: [`docs/platform/frontend/reference/README.md`](../../docs/platform/frontend/reference/README.md)
- Code standards (this folder): [`./code-standards.md`](./code-standards.md)
- Architecture pointer (this folder): [`./architecture.md`](./architecture.md)
