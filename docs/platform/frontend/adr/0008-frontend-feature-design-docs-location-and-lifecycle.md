# ADR-0008: Frontend feature design docs location and lifecycle

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `documentation`, `taxonomy`, `process` |

---

## Context

Today the frontend docs answer four of the five questions a contributor has when picking up a feature:

| Question | Where it's answered |
|---|---|
| Does this feature exist as a product? | [`docs/product/feature-decisions.md`](../../../product/feature-decisions.md) |
| What does the product do, for whom, why? | [`docs/product/prd.md`](../../../product/prd.md) |
| What API and DB does the backend expose? | [`docs/modules/<feature>/`](../../../modules/) |
| What was actually built on the frontend? | [`reference/features/<feature>.md`](../reference/features/) (per [ADR-0006](./0006-per-feature-frontend-reference-docs-location.md)) |
| **How should the frontend look — pages, data shown, user actions, components, states — *before* we build it?** | **No defined home.** |

The fifth question is the gap. Without a defined home for **frontend design docs**:

- Reviewers learn what a feature is supposed to look like only by reading the implementation PR — a lossy process where many reviewers default to "looks fine, ship it" because the design intent isn't recorded anywhere.
- Multiple implementers building related parts of a feature reach inconsistent conclusions about page counts, data shown, and flow ordering. There is no shared north star.
- New contributors cannot get a sense of "what's in flight" without reading every open PR.
- Open questions about frontend design (e.g., *"do we show price-per-night or price-per-stay on the hotel card?"*) get re-litigated in every PR review, because no one wrote down the answer.
- The roadmap can list a feature as "Phase 5" but cannot point to a definition of what shipping that feature means visually and behaviorally.

The reference template ([`_template-feature.md`](../_template-feature.md)) is unsuitable for this purpose:
- Per [`reference/README.md`](../reference/README.md), reference docs are governed by a "no future tense" rule. They describe what *exists*, not what *will exist*.
- Pre-build authoring inevitably contains aspirational claims, open questions, and tradeoff notes — content that has no honest home in a snapshot doc.
- Mixing forward-looking content into `reference/features/` would corrupt that layer's invariant.

`docs/modules/<feature>/architecture.md` is also unsuitable: per [ADR-0006](./0006-per-feature-frontend-reference-docs-location.md), `docs/modules/` is a cross-layer product/contract spec — not a frontend implementation design surface.

`.kiro/specs/<feature>/` is unsuitable: that system is for implementation **task lists** (todo items, acceptance criteria for a sprint), not for the underlying design they execute against.

When this decision was taken:
- 14+ feature modules are listed in [`docs/product/feature-decisions.md`](../../../product/feature-decisions.md).
- Three of them (Vibe Booking, Trip Discovery, Booking Flow) are slated for Phase 5–6 implementation.
- None has a frontend design doc. The implementation will start without one unless this gap is closed.

---

## Decision

**Frontend feature design docs live at `docs/platform/frontend/design/features/<feature>.md`**, authored from a single canonical template at [`docs/platform/frontend/_template-feature-design.md`](../_template-feature-design.md), and follow a four-state lifecycle: `Drafting → Approved → Implementing → Shipped`.

### Location and structure

```
docs/platform/frontend/
├── _template-feature.md                 # reference template (unchanged, ADR-0006)
├── _template-feature-design.md          # NEW — design template
├── design/                              # NEW — forward-looking layer
│   ├── README.md
│   ├── features/
│   │   ├── <feature-1>.md               # one design doc per feature
│   │   └── …
│   └── archive/                         # (optional) shipped designs preserved for history
└── reference/                           # post-build snapshots (unchanged, ADR-0006)
    └── features/
        └── <feature-1>.md
```

- One file per feature, regardless of how many pages it owns.
- Slug matches `docs/modules/<feature>/` and the eventual `reference/features/<feature>.md`.
- Status is tracked in the doc's header table.

### Lifecycle

| Status | Trigger | Effect |
|---|---|---|
| **Drafting** | Author copies the template and starts writing. | No code yet. Open questions are tracked in §10. |
| **Approved** | All §10 questions resolved or escalated to ADRs; reviewers approve content. | Implementation may begin. |
| **Implementing** | First implementation PR opens; updates `Status` in the same PR. | PRs are reviewed against this doc. |
| **Shipped** | Matching `reference/features/<feature>.md` lands. | Design doc gets a banner pointing to the reference doc. Optionally moved to `design/archive/`. |

### Required template sections

The design template ([`../_template-feature-design.md`](../_template-feature-design.md)) is canonical. Every design doc has:

1. Goal (one sentence)
2. User flow (numbered steps)
3. Pages (table)
4. Per-page detail (purpose, data shown, user actions, components, states, backend calls, i18n keys)
5. Data model (Zod schemas + backend endpoints)
6. Client state (React Query, Zustand, forms)
7. External integrations (WebSocket, Stripe, Maps, FCM, …)
8. Edge cases & error states
9. Acceptance criteria (frontend)
10. Open questions
11. Out of scope
12. Related links

### Authoring rules

- **All future tense.** *"The page will show…"*, *"The user will tap…"*. The inverse of the `reference/` no-future-tense rule.
- **No real code samples.** Pseudo-code and shape examples only. Real code lives in the eventual reference doc.
- **Cite, don't restate.** State management, auth, i18n, design system — link to the ADR or cross-cutting reference doc.
- **Open questions are first-class.** Status cannot reach `Approved` while §10 has unresolved entries.
- **One feature per doc.** Multi-page features fit in one design doc.

### Definition of Done integration

[`governance.md`](../governance.md) gains a gate under **Documentation**:

> **Approved design doc exists** for any new feature being implemented. The implementing PR references the design doc by path and updates its `Status`.

A reference doc cannot reach `Active` until the matching design doc reaches `Shipped`.

### Roadmap integration

Phases in [`docs/platform/roadmaps/frontend-roadmap.md`](../../roadmaps/frontend-roadmap.md) cite the design docs they implement. A phase can list a feature as in-scope only if a design doc exists at `Drafting` or later; it cannot complete without the design doc reaching `Shipped`.

---

## Consequences

### Positive

- **Design intent is captured.** Reviewers, implementers, and AI agents have one document that tells them what shipping a feature means before code is written.
- **Open questions are surfaced and resolved before implementation.** They cannot hide in PR comment threads.
- **Roadmap planning becomes concrete.** Each phase row points to a design doc with explicit acceptance criteria, so estimating and sequencing get easier.
- **Reference docs stay clean.** The `no future tense` rule remains intact because forward-looking content has its own home.
- **Symmetric structure.** `design/features/<feature>.md` ↔ `reference/features/<feature>.md` makes navigation predictable.
- **The template enforces minimum coverage** of the questions every frontend design must answer.

### Negative

- **Authoring overhead.** Every new feature now requires an Approved design doc before implementation. Small features (e.g., a static page) carry more documentation burden than the change deserves. Mitigation: trivial pages may opt out with an explicit waiver in the implementing PR description.
- **Two templates to maintain.** Drift between the design and reference templates is a real risk. Mitigation: any change to either template requires a reviewer to confirm the other is still consistent.
- **Status drift.** `Implementing` docs may sit stale if the implementer forgets to update `Status`. Mitigation: PR checklist includes "design doc Status updated".
- **Duplication risk with backend module docs.** A frontend design doc may overlap with `docs/modules/<feature>/architecture.md`. Mitigation: design docs cite the module doc; do not restate API contracts.
- **Slower start.** Solo developers may feel the friction of writing a design before coding. Mitigation: the doc is small (a single template, ~12 sections); a Drafting doc need not be exhaustive to start implementing scaffolding.

### Neutral

- The existing reference template ([`_template-feature.md`](../_template-feature.md)) is unchanged. We are not renaming it (would break ADR-0006 and ADR-0007 cross-links, which are immutable per ADR rules). The new template lives alongside it as `_template-feature-design.md`.

---

## Alternatives considered

### A. Use the reference template ([`_template-feature.md`](../_template-feature.md)) for both purposes

**Rejected.** Mixing forward-looking and snapshot content corrupts the `no future tense` invariant of `reference/`. Readers can no longer trust that a `reference/features/<x>.md` describes the codebase as it stands.

### B. Put design docs in `docs/modules/<feature>/`

**Rejected.** That folder is a cross-layer product/contract spec per [ADR-0006](./0006-per-feature-frontend-reference-docs-location.md). Mixing frontend implementation design with cross-layer architecture would blur a useful separation and force backend reviewers to read frontend page-counts.

### C. Put design docs in `.kiro/specs/<feature>/`

**Rejected.** That system is for implementation task lists (todo items, sprint scope), not for the design they execute against. Design and execution-tracking are different documents with different lifecycles.

### D. One design doc per page (not per feature)

**Rejected.** Fragmentation across pages forces readers to assemble a feature's overall design from multiple files. A single `<feature>.md` keeps the design reviewable and the cross-references local.

### E. No design layer; rely on PR descriptions

**Rejected.** PR descriptions are not searchable, not linkable from the roadmap, and disappear behind merge events. They are also a poor place to track open questions across multiple PRs.

---

## Implementation steps

1. Create [`_template-feature-design.md`](../_template-feature-design.md) at the platform-frontend doc root.
2. Create [`design/README.md`](../design/README.md) explaining the layer.
3. (This file.) Land ADR-0008.
4. Update [`adr/README.md`](./README.md) index to include ADR-0007 (which was missed) and ADR-0008.
5. Update [`governance.md`](../governance.md) Definition of Done with the new "Approved design doc exists" gate under Documentation.
6. Update [`docs/platform/roadmaps/frontend-roadmap.md`](../../roadmaps/frontend-roadmap.md):
   - Add an ADR-0008 row to the Decision Log.
   - Update Current Status to mark the design layer as decided.
7. Update the three context files in `frontend/context/`:
   - `architecture.md` — add design layer to "Read in order".
   - `code-standards.md` — add design-doc-first to the new feature checklist.
   - `roadmap.md` — note design layer in the AI guidance section.
8. (Subsequent PRs.) Author one design doc per feature in priority order, starting with Vibe Booking (Phase 6).

---

## Related

- [ADR-0006 — Per-feature reference docs location](./0006-per-feature-frontend-reference-docs-location.md) — the post-build sibling layer.
- [ADR-0007 — Feature-sliced architecture with strict boundaries](./0007-feature-sliced-architecture-with-strict-boundaries.md) — what the implementation conforms to.
- [`design/README.md`](../design/README.md) — index for the new layer.
- [`_template-feature-design.md`](../_template-feature-design.md) — the canonical design template.
- [`governance.md`](../governance.md) — Definition of Done.
- [Diátaxis taxonomy](https://diataxis.fr/) — referenced by ADR-0006; design docs do not fit any of the four Diátaxis categories cleanly. They are pre-build planning artifacts; the closest analogue is "explanation" but written before the system exists.
