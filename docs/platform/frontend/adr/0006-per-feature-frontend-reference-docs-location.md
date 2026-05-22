# ADR-0006: Per-feature frontend reference docs live under `reference/features/`

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `documentation`, `taxonomy` |

---

## Context

The frontend platform docs commit to the [Diátaxis](https://diataxis.fr/) taxonomy in [`governance.md`](../governance.md#documentation-taxonomy-diátaxis): every doc has exactly one home, chosen by what the reader needs from it. Reference docs answer *"look up a fact"*; explanation answers *"understand why"*; guides answer *"do this task"*; tutorials answer *"learn by building"*.

Right now, `reference/` only enumerates **cross-cutting** topics — `state-and-data.md`, `auth-and-session.md`, `i18n-and-locale.md`, etc. There is no defined home for **per-feature frontend docs** (e.g. *"how the booking flow is wired on the frontend"*, *"how the Vibe Booking content stage renders AI payloads"*).

This is a real gap. The product has 14+ feature modules (auth, hotel-booking, vibe-booking, payments, profile, my-trip, loyalty, …), and each will need a frontend-side reference doc that describes its routes, components, stores, queries, and i18n keys. Without a defined home:

- Contributors will invent locations ad-hoc, and reviewers will spend cycles relocating docs.
- Feature docs may end up duplicating cross-cutting reference content (state, auth, design system) instead of citing it.
- The index in [`reference/README.md`](../reference/README.md) will become incoherent.

The existing `docs/modules/<feature>/` folder is a **product/contract spec** — `requirements.md`, `architecture.md`, `api.yaml`. It describes the feature *as a product capability across all layers*, not how it is implemented on the frontend specifically. Mixing frontend implementation docs into `docs/modules/` would blur a useful separation.

When this decision was taken:

- `reference/README.md` lists 11 cross-cutting reference docs as planned scope. None mention per-feature docs.
- Three Diátaxis subfolders (`reference/`, `guides/`, `tutorials/`, `explanation/`) only contain READMEs — no actual content yet.
- `_template.md` is generic; it works for any of the four Diátaxis categories but not specifically for a per-feature doc.

Constraints:

- **One home per doc** ([`governance.md`](../governance.md#documentation-taxonomy-diátaxis)). No duplication across categories.
- **Reference describes "what is"** ([`reference/README.md`](../reference/README.md)). Per-feature frontend docs naturally fit that shape.
- **The `docs/modules/<feature>/` folder is product-shaped, not platform-shaped.** It belongs to the product and feature-decisions team; it predates the Diátaxis split.
- **Discoverability matters.** A reader scanning `reference/` should see "this is where I find feature X on the frontend".

---

## Decision

Per-feature frontend reference docs live in **`docs/platform/frontend/reference/features/<feature>.md`**.

> The boundary is: **`docs/modules/<feature>/` describes the *feature as a product*. `docs/platform/frontend/reference/features/<feature>.md` describes the *feature as a frontend implementation*. They cite each other but never duplicate.**

The naming convention is `kebab-case-feature.md`, matching the slug used in `docs/modules/*`. Examples:

- `reference/features/auth.md`
- `reference/features/vibe-booking.md`
- `reference/features/hotel-booking.md`
- `reference/features/my-trip.md`

A per-feature doc is a **reference** doc — it describes the routes, components, stores, queries, mutations, i18n namespaces, and accessibility considerations that exist for that feature in `frontend/`. It does not teach concepts (link to explanation), narrate a build (link to a tutorial), or walk through tasks (link to a guide).

A small **`_template-feature.md`** sits next to `_template.md` and is the canonical scaffold. Authoring conventions for these docs are added to [`reference/README.md`](../reference/README.md).

---

## Options considered

### Option A — `docs/modules/<feature>/frontend.md` (sibling to `requirements.md`, `architecture.md`, `api.yaml`)

- **Pros:** Co-locates everything about a feature in one folder. Easy to find when working "feature-end-to-end".
- **Cons:** Mixes product-spec docs (requirements, API contract) with implementation docs (frontend wiring). Different audiences, lifecycles, and ownership. The `docs/modules/` folder is currently feature-decisions-team territory; injecting platform docs there muddies ownership. Forces every backend reader to step over frontend content and vice versa. Does not benefit from the Diátaxis taxonomy `docs/platform/frontend/` already follows.

### Option B — `docs/platform/frontend/features/<feature>.md` (new top-level subfolder, outside Diátaxis)

- **Pros:** Visible. Symmetric for backend (could mirror as `docs/platform/backend/features/`).
- **Cons:** Breaks the Diátaxis purity claim in [`governance.md`](../governance.md#documentation-taxonomy-diátaxis). Adds a fifth category — *"feature"* — that doesn't map to a reader need; the actual reader need *is* reference. We'd be introducing a synonym.

### Option C — `docs/platform/frontend/reference/features/<feature>.md` *(chosen)*

- **Pros:**
  - Honors Diátaxis: per-feature frontend docs *are* reference docs (factual lookup of contracts and conventions).
  - Discoverable next to cross-cutting reference (state, auth, design-system); a feature reader naturally finds the cross-cutting docs they should cite.
  - Doesn't bloat `docs/modules/`; keeps product spec and platform implementation cleanly separated.
  - Single index home in [`reference/README.md`](../reference/README.md).
- **Cons:**
  - Slightly deeper path. Acceptable given the discoverability win.
  - Requires `reference/README.md` to grow a sub-index for the `features/` subfolder.

### Option D — `docs/platform/frontend/<feature>.md` (top-level, no subfolder)

- **Pros:** Shortest path.
- **Cons:** The top level is reserved for the three "front door" docs (`foundation.md`, `architecture.md`, `governance.md`) and category READMEs. Mixing 14 feature docs in there destroys that scannability.

**Chosen:** Option C. The reader-need test ("what does the reader want from this doc?") gives a clear answer: reference. Filing it anywhere else would be a synonym for reference, which Diátaxis explicitly forbids.

---

## Consequences

### Positive

- One canonical location per feature. Cross-references work uniformly.
- The `reference/` index gains a sub-index for `features/`, mirroring the cross-cutting section above it.
- Cross-cutting reference docs (`state-and-data.md`, `auth-and-session.md`, etc.) and per-feature reference docs are siblings — readers naturally encounter both.
- `docs/modules/<feature>/` stays pure product spec; backend and frontend platform docs are siblings of equal weight.
- A future backend equivalent (`docs/platform/backend/reference/features/<feature>.md`) can mirror this layout if/when backend platform docs adopt Diátaxis.

### Negative

- Slightly deeper path: `docs/platform/frontend/reference/features/auth.md` is five segments. We accept this; deep paths matter less than discoverability.
- Each feature now has at least three docs across the repo:
  - `docs/modules/<feature>/architecture.md` — cross-cutting product spec
  - `docs/platform/frontend/reference/features/<feature>.md` — frontend implementation
  - (Future) `docs/platform/backend/reference/features/<feature>.md` — backend implementation
  - This is the right shape. Different audiences, different update cadences.

### Neutral / things we accept

- Per-feature **how-to guides** (`guides/<verb>-<feature>-<thing>.md`) and per-feature **explanation** docs (e.g., `explanation/why-vibe-booking-uses-websocket.md`) remain in their respective Diátaxis homes; only **reference** docs live under `features/`.
- Tiny features (e.g., a single component) may not need their own per-feature doc. The threshold is roughly: *if the feature has its own folder under `frontend/components/<feature>/` or its own route group, it gets a doc.*
- A per-feature doc may, when warranted, link to a deeper sub-doc (e.g., `reference/features/vibe-booking/renderers.md`). We allow nested subfolders inside `features/` when one feature has enough internal structure to justify it. The default remains a single file per feature.

---

## Implementation

### Folder layout (changes to `docs/platform/frontend/`)

```
docs/platform/frontend/
├── reference/
│   ├── README.md                       # Updated: add a "Per-feature reference" section
│   ├── state-and-data.md
│   ├── auth-and-session.md
│   ├── …
│   └── features/                       # NEW
│       ├── auth.md                     # Created per-feature, on demand
│       ├── vibe-booking.md
│       └── …
├── _template.md                        # Existing generic template
└── _template-feature.md                # NEW — scaffold for per-feature reference docs
```

### Required header for a per-feature doc

```markdown
# Frontend reference: <Feature Name>

> One-paragraph summary of what this feature is on the frontend.

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active \| Draft \| Deprecated |
| **Last reviewed** | YYYY-MM-DD |
| **Product spec** | [`docs/modules/<feature>/architecture.md`](../../../../modules/<feature>/architecture.md) |
| **Backend reference** | [`docs/platform/backend/...`](...) (when it exists) |
| **Related ADRs** | ADR-XXXX |
| **Related code** | `frontend/app/<...>/`, `frontend/components/<feature>/`, `frontend/stores/<feature>.store.ts` |
```

### Required sections

A per-feature reference doc MUST have these sections (the template enforces them):

1. **TL;DR** — 3–5 bullets.
2. **Routes** — table of route paths, layout group, auth requirement, SEO posture.
3. **Components** — what's in `components/<feature>/`, what's shared.
4. **State** — Zustand stores used, React Query keys/hooks owned by the feature.
5. **Data flow** — diagram of which Server Components fetch, which Client Components mutate.
6. **i18n namespaces** — which keys in `messages/{en,zh,km}.json` belong to this feature.
7. **Validation schemas** — Zod schemas in `schemas/<feature>.ts`.
8. **Error states** — what the user sees on failure (toast vs inline vs modal).
9. **Performance considerations** — anything route-specific (preloads, dynamic imports, image sizes).
10. **Accessibility** — feature-specific keyboard / screen-reader notes.
11. **Testing** — what the unit + E2E coverage looks like for this feature.
12. **Open questions** — pending decisions or known gaps.
13. **Related** — links to product spec, ADRs, cross-cutting reference docs, guides.

The template provides skeleton content for each.

### `reference/README.md` update

A new section is added to the index:

```markdown
## Per-feature reference

Each major frontend feature has a reference doc under `features/`. The doc is the
single source of truth for *how this feature is implemented on the frontend*.

| Doc | Purpose |
|-----|---------|
| (none yet — add as features land) | — |
```

The section sits below the cross-cutting table.

### Authoring rules

1. **MUST** be a reference doc. Tasks, narratives, or rationales go in their respective Diátaxis homes.
2. **MUST** cite cross-cutting reference docs rather than restate them. ("State management follows the rules in [`../state-and-data.md`](../state-and-data.md).")
3. **MUST** link the corresponding `docs/modules/<feature>/architecture.md` in the header.
4. **MUST** be updated in the same PR that adds or changes the corresponding code.
5. **SHOULD** include a Mermaid diagram of the route + state + data flow when the feature has more than one screen.
6. **SHOULD** be created before the feature lands — even an outline is better than nothing for review.

### Anti-patterns this decision rules out

- ❌ Inlining cross-cutting rules ("for forms, use React Hook Form + Zod…") instead of citing the cross-cutting reference. One source of truth.
- ❌ Putting per-feature explanation content (concepts, mental models) in the reference doc. That goes in `explanation/`.
- ❌ Putting backend or AI-agent details in the frontend doc. The frontend doc cites the backend's `/v1/<feature>/` endpoints; it does not describe them.
- ❌ Skipping a per-feature doc because "the code is self-documenting". Code documents *what*; the reference doc documents *which* code is the canonical implementation.
- ❌ Naming the file with PascalCase or camelCase. Always kebab-case.

---

## Links

- Related ADRs: [ADR-0001](./0001-app-router-server-components-default.md), [ADR-0002](./0002-state-management-split.md), [ADR-0003](./0003-auth-and-session-model.md), [ADR-0004](./0004-i18n-routing-strategy.md), [ADR-0005](./0005-testing-stack.md) — every per-feature doc cites a subset of these.
- Related docs: [`../governance.md`](../governance.md#documentation-taxonomy-diátaxis), [`../reference/README.md`](../reference/README.md), [`../_template.md`](../_template.md), planned `../_template-feature.md`.
- External:
  - [Diátaxis](https://diataxis.fr/)
  - [Diátaxis — Reference](https://diataxis.fr/reference/)

---

## History

| Date | Change |
|------|--------|
| 2026-05-22 | Created and Accepted. Establishes `reference/features/` before the first feature doc is written. |
