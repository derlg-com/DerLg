# Frontend Architecture — Context Pointer

> This file is a **pointer**, not a source of truth.
> The canonical frontend architecture lives under [`docs/platform/frontend/`](../../docs/platform/frontend/).
> If anything here drifts from the platform docs, the platform docs win — fix this file.

## Read these in order

1. [`docs/platform/frontend/foundation.md`](../../docs/platform/frontend/foundation.md) — runtime contract: Node version, Next.js + React versions, package manager, hard rules.
2. [`docs/platform/frontend/architecture.md`](../../docs/platform/frontend/architecture.md) — folder layout, server-vs-client component split, where to put a new file, anti-patterns, acceptance criteria.
3. [`docs/platform/frontend/governance.md`](../../docs/platform/frontend/governance.md) — Definition of Done. A change isn't done until every gate here passes.
4. [`docs/platform/frontend/_template-feature-design.md`](../../docs/platform/frontend/_template-feature-design.md) — forward-looking design template. Every new feature gets a design doc in [`design/features/`](../../docs/platform/frontend/design/) before implementation starts (per ADR-0008).
5. [`docs/platform/frontend/_template-feature.md`](../../docs/platform/frontend/_template-feature.md) — reference template (post-build) every per-feature reference doc copies from.

## Decisions (ADRs)

Read the ADR before changing anything it touches:

- [ADR-0001 — App Router as the only routing model](../../docs/platform/frontend/adr/0001-app-router-as-only-routing-model.md)
- [ADR-0002 — State management split (Zustand + React Query)](../../docs/platform/frontend/adr/0002-state-management-split.md)
- [ADR-0003 — Auth & session model](../../docs/platform/frontend/adr/0003-auth-and-session-model.md)
- [ADR-0004 — i18n routing strategy](../../docs/platform/frontend/adr/0004-i18n-routing-strategy.md)
- [ADR-0005 — Testing stack](../../docs/platform/frontend/adr/0005-testing-stack.md)
- [ADR-0006 — Per-feature reference docs location](../../docs/platform/frontend/adr/0006-per-feature-frontend-reference-docs-location.md)
- [ADR-0007 — Feature-sliced layout with strict boundaries](../../docs/platform/frontend/adr/0007-feature-sliced-architecture-with-strict-boundaries.md)
- [ADR-0008 — Frontend feature design docs location and lifecycle](../../docs/platform/frontend/adr/0008-frontend-feature-design-docs-location-and-lifecycle.md)

ADR index: [`docs/platform/frontend/adr/README.md`](../../docs/platform/frontend/adr/README.md).

## Roadmap & current status

[`docs/platform/roadmaps/frontend-roadmap.md`](../../docs/platform/roadmaps/frontend-roadmap.md) tracks what is **decided**, what is **decided-but-not-implemented**, and what is still **open**. Check it before assuming a piece of infrastructure exists.

## Code conventions

- [`.kiro/steering/tech.md`](../../.kiro/steering/tech.md) — stack and code-style rules (no semicolons, single quotes, 2-space indent for frontend).
- [`.kiro/steering/conventions.md`](../../.kiro/steering/conventions.md) — naming, imports, error handling, validation, testing.
- [`frontend/AGENTS.md`](../AGENTS.md) — frontend-specific agent guide (component patterns, request flow).

## Rule of thumb

If you are about to write architectural prose in this folder, stop and put it in `docs/platform/frontend/` instead. This `context/` folder is for cross-references and short orientation notes only.
