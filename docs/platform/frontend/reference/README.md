# Reference

> **Information-oriented documentation.** Factual descriptions of how the frontend is built — the libraries, contracts, configuration, and conventions in use *right now*. A reader comes here to look something up, not to learn or to be persuaded.
>
> If you find yourself writing prose that explains *why* a choice was made, or step-by-step instructions for *doing* something, the doc belongs in [`../explanation/`](../explanation/) or [`../guides/`](../guides/) instead.

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active |
| **Last reviewed** | 2026-05-22 |
| **Related** | [`../index.md`](../index.md), [`../governance.md`](../governance.md), [Diátaxis — Reference](https://diataxis.fr/reference/) |

---

## What "Reference" means here

Reference docs describe **the system as it is**. They are accurate, terse, and exhaustive within their scope. They are the docs an experienced engineer scans during implementation to confirm a contract — never to discover one.

Characteristics:

- **Factual.** No "you might want to consider…" or "in the future we'll…".
- **Stable.** Updated in the same PR as the code that changes the contract.
- **Lookup-shaped.** Tables, lists, code snippets, type signatures — not narratives.
- **Self-contained per topic.** A reader looking up i18n shouldn't have to read security first.

---

## Put a doc here when…

- It describes a **contract**: env vars, store shapes, message schemas, error codes.
- It enumerates **rules** the codebase enforces: lint rules, design tokens, performance budgets.
- It documents **APIs the frontend exposes or consumes**: WebSocket message types, REST envelopes, hook signatures.
- It describes **operational facts**: deploy targets, CI pipeline, monitoring dashboards.

## Don't put a doc here when…

- The reader needs **guided steps** to accomplish a task → [`../guides/`](../guides/).
- The reader is **learning the system end-to-end** → [`../tutorials/`](../tutorials/).
- The doc explains **why** the system is shaped this way, with trade-offs → [`../explanation/`](../explanation/).
- It's a **historical decision** → [`../adr/`](../adr/).

---

## Index

### Cross-cutting reference

| Doc | Purpose |
|-----|---------|
| [`state-and-data.md`](./state-and-data.md) | Zustand client stores, React Query server state, hydration rules, persistence |
| [`auth-and-session.md`](./auth-and-session.md) | JWT access token storage, refresh-token cookie flow, middleware-based route guards |
| [`realtime-and-vibe-booking.md`](./realtime-and-vibe-booking.md) | WebSocket lifecycle, AI message contracts, auto-render system, Zod validation |
| [`design-system.md`](./design-system.md) | Tailwind v4 tokens, shadcn/ui usage, motion policy, accessibility baseline |
| [`i18n-and-locale.md`](./i18n-and-locale.md) | next-intl setup, EN/ZH/KM resources, font stacks, currency/date/number formatting |
| [`pwa-and-offline.md`](./pwa-and-offline.md) | Service worker scope, cache strategies, offline indicators, install prompt |
| [`performance.md`](./performance.md) | Core Web Vitals targets, code splitting policy, image rules, prefetch strategy |
| [`security.md`](./security.md) | CSP, XSS prevention, input validation, secrets policy, sandboxing AI content |
| [`testing.md`](./testing.md) | Vitest + React Testing Library, Playwright E2E, MSW mocking, coverage targets |
| [`observability.md`](./observability.md) | Sentry integration, analytics events, structured client logs, error budgets |
| [`deployment.md`](./deployment.md) | Docker image, CI/CD pipeline, environments, rollback procedure |

> Files listed above are the planned scope. Each row links to a doc that may not exist yet — create it from [`../_template.md`](../_template.md) when the topic is implemented in code, then flip the link from a stub to the real doc in the same PR.

### Per-feature reference — [`./features/`](./features/)

Each major frontend feature has a reference doc under [`./features/`](./features/) — the single source of truth for *how this feature is implemented on the frontend*. Per [ADR-0006](../adr/0006-per-feature-frontend-reference-docs-location.md), these are reference docs (factual lookup), not narratives.

| Feature doc | Product spec |
|-------------|--------------|
| _(none yet — add as features land)_ | — |

When you create the first per-feature doc:

1. Copy [`../_template-feature.md`](../_template-feature.md) to `features/<feature>.md` (kebab-case, matching the slug under [`docs/modules/`](../../../modules/)).
2. Fill in the header, TL;DR, and the required sections enumerated in the template.
3. Add a row to the table above linking the new doc and its product spec under `docs/modules/<feature>/`.
4. Cite cross-cutting reference docs (above) liberally — never restate them.

---

## Conventions for reference docs

1. **Start with a metadata header** copied from [`../_template.md`](../_template.md) (Owner, Status, Last reviewed, Related ADRs, Related code).
2. **Lead with a TL;DR.** 3–5 bullets that capture the contract at a glance.
3. **Use tables for enumerations.** Error codes, message types, env vars, design tokens — all tables.
4. **Cite code paths.** Every claim that maps to code should link to the file (e.g. `frontend/lib/api-client.ts`).
5. **No future tense.** If it's not in the code yet, it doesn't go in a reference doc — write a roadmap entry or an ADR proposal instead.
6. **Bump `Last reviewed`** whenever the contract changes or you re-validate the doc against the code.

---

## See also

- [`../index.md`](../index.md) — frontend platform docs entry point
- [`../guides/README.md`](../guides/README.md) — task-oriented how-to guides
- [`../explanation/README.md`](../explanation/README.md) — conceptual / "why" docs
- [`../adr/README.md`](../adr/README.md) — architecture decision records
