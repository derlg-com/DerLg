# Frontend Design Docs

> **Forward-looking, pre-build.** Each doc here describes how the frontend for a feature **will** look — pages, data shown, user actions, components, states — before any code exists.
>
> Once a feature ships, its source-of-truth moves to [`../reference/features/<feature>.md`](../reference/features/) and the design doc here is archived.

| Field | Value |
|---|---|
| **Decision** | [ADR-0008 — Frontend feature design docs location and lifecycle](../adr/0008-frontend-feature-design-docs-location-and-lifecycle.md) |
| **Template** | [`../_template-feature-design.md`](../_template-feature-design.md) |
| **Sibling layer** | [`../reference/features/`](../reference/features/) (post-build snapshots) |
| **Last reviewed** | 2026-05-22 |

---

## Why this layer exists

| Question | Where it's answered |
|---|---|
| Does this feature exist as a product? | [`docs/product/feature-decisions.md`](../../../product/feature-decisions.md) |
| What does it do, for whom, why? | [`docs/product/prd.md`](../../../product/prd.md) |
| What API and DB does the backend expose? | [`docs/modules/<feature>/`](../../../modules/) |
| **How will it look on the frontend — pages, data, components, flows?** | **`design/features/<feature>.md` ← here** |
| What was actually built? | [`reference/features/<feature>.md`](../reference/features/) |
| Which architectural rules apply? | [`../adr/`](../adr/) |

Without this layer, the product registry says *"Vibe Booking exists"*, the backend module says *"here are the WebSocket events"*, but nobody answers *"how many pages, what does the user see on each, what state and components compose them"* until somebody starts implementing — at which point it's already too late to debate.

---

## Status lifecycle

```
Drafting → Approved → Implementing → Shipped
                                        ↓
                            (reference doc takes over)
```

| Status | Meaning | Allowed to import? |
|---|---|---|
| **Drafting** | Author is still writing. Open questions unresolved. | No code yet. |
| **Approved** | All open questions resolved (or escalated to ADRs). Implementation can start. | Implementation may begin. |
| **Implementing** | Code is being written against this doc. | Reviewers cross-check PRs against this doc. |
| **Shipped** | Feature is live. Reference doc at `reference/features/<feature>.md` is now source of truth. | This doc is archived (banner + link). |

Status changes happen in the same PR as the trigger event:
- `Drafting` → `Approved` when open questions are zero and reviewers approve.
- `Approved` → `Implementing` in the first implementation PR.
- `Implementing` → `Shipped` when the matching `reference/features/<feature>.md` lands.

---

## File layout

```
design/
├── README.md                     # this file
├── features/
│   ├── <feature-1>.md            # one file per feature (kebab-case slug)
│   ├── <feature-2>.md
│   └── …
└── archive/                      # (optional) shipped feature designs preserved for history
    └── <feature>.md
```

- One file per feature. Multi-page features fit in one doc — don't fragment by page.
- Slug matches `docs/modules/<feature>/` and the eventual `reference/features/<feature>.md`.
- Use [`../_template-feature-design.md`](../_template-feature-design.md) verbatim. Don't invent fields.

---

## Authoring rules

1. **All future tense.** This is a forward-looking doc. *"The page will show…"*, *"The user will tap…"*. The opposite of `reference/`'s no-future-tense rule.
2. **No code samples.** Pseudo-code and shape examples only. Real code goes in the reference doc later.
3. **Cite, don't restate.** When the design touches state, auth, i18n, design system — link to the ADR or cross-cutting reference doc and move on.
4. **Open questions are first-class.** §10 of the template tracks them. A doc can sit in `Drafting` for as long as it takes; it cannot reach `Approved` while questions are open.
5. **One feature per doc.** Even if the feature has 5 pages.
6. **Keep it review-sized.** If a design doc exceeds ~500 lines, the feature is probably two features.

---

## Adding a new design

1. Confirm the feature exists in [`docs/product/feature-decisions.md`](../../../product/feature-decisions.md). If not, get it added there first.
2. Copy [`../_template-feature-design.md`](../_template-feature-design.md) to `features/<slug>.md`.
3. Set `Status: Drafting`. Fill in §1, §2, §3 first — those define scope.
4. Walk page by page through §4. For each page, write Data shown / Actions / Components / States.
5. List every backend endpoint the feature calls in §5.
6. List every React Query / Zustand / form in §6.
7. Resolve every Open Question in §10 — either in-doc, by escalating to an ADR, or by deferring to the roadmap.
8. Open a PR. Reviewers approve content. Status transitions to `Approved`.
9. Implementation PRs reference this doc and update `Status` accordingly.

---

## Index

*One row per feature design as it lands.*

| Slug | Title | Status | Phase | Doc |
|---|---|---|---|---|
| *(none yet)* | — | — | — | — |

---

## Related

- [ADR-0006 — Per-feature reference docs location](../adr/0006-per-feature-frontend-reference-docs-location.md) — the post-build sibling layer.
- [ADR-0007 — Feature-sliced architecture](../adr/0007-feature-sliced-architecture-with-strict-boundaries.md) — what the implementation must conform to.
- [ADR-0008 — This decision](../adr/0008-frontend-feature-design-docs-location-and-lifecycle.md).
- [Reference template](../_template-feature.md) and [reference/README](../reference/README.md).
- [Roadmap](../../roadmaps/frontend-roadmap.md) — phases consume design docs to plan work.
- [Governance](../governance.md) — DoD requires Approved design before implementation.
