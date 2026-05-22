# Tutorials

> **Learning-oriented documentation.** A tutorial walks a newcomer through building something real, end to end, in the DerLg frontend. The goal is *familiarity through doing*, not exhaustive coverage. The reader finishes with a working result and a mental model of the system.
>
> If your doc is a recipe for a single task, it belongs in [`../guides/`](../guides/). If it's a description of how something already works, it belongs in [`../reference/`](../reference/).

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active |
| **Last reviewed** | 2026-05-22 |
| **Related** | [`../index.md`](../index.md), [`../governance.md`](../governance.md), [Diátaxis — Tutorials](https://diataxis.fr/tutorials/) |

---

## What "Tutorial" means here

A tutorial is a guided, narrative experience. It is the doc you hand a new engineer on day one. It deliberately picks a happy path, hides irrelevant detail, and prioritizes momentum over completeness.

Characteristics:

- **Beginner-shaped.** Assumes the reader knows TypeScript and React, not DerLg.
- **End-to-end.** Starts from `git clone` (or the previous tutorial's end state) and ends with a working, runnable artifact.
- **One narrative.** A single storyline; sub-paths are out of scope.
- **Trustworthy.** Every command and snippet is copy-paste runnable on the supported Node/npm versions.
- **Confidence-building.** The reader should never have to debug an unfamiliar system to keep going.

---

## Put a doc here when…

- An **onboarding path** is needed for a recurring kind of work (a new feature, a new module, an integration).
- A pattern is **easier to learn by building** than by reading.
- The system has **enough moving parts** that a guide-by-guide approach would lose the reader.

## Don't put a doc here when…

- It's a **single task** with no narrative arc → [`../guides/`](../guides/).
- It's **explanation of an idea** without hands-on work → [`../explanation/`](../explanation/).
- It's a **specification** of an existing contract → [`../reference/`](../reference/).
- It would duplicate **AGENTS.md** or **README** content → improve those instead.

---

## Index

| Tutorial | What you'll build |
|----------|-------------------|
| _(none yet — add as you write them)_ | — |

### Suggested first tutorials (write when the underlying code lands)

- `01-onboarding-build-trip-card.md` — clone, run, build a static `TripCard` component, render it on `/trips`. Outcome: the reader has the dev loop working and shipped one trivial Server Component.
- `02-add-a-feature-end-to-end.md` — pick a small feature (e.g. a "Save trip" button), wire it from UI → React Query mutation → backend → toast. Outcome: the reader has touched every layer.
- `03-build-an-ai-renderable-card.md` — define a Zod schema for a new AI message type, register a renderer, validate, render in the chat. Outcome: the reader understands the AI content trust boundary in practice.

---

## Template for a tutorial

```markdown
# Tutorial: <build the thing>

> One paragraph. What will the reader build, and why is it useful for understanding the system?

| Field | Value |
|-------|-------|
| **Owner** | <team or individual> |
| **Status** | Active |
| **Last reviewed** | YYYY-MM-DD |
| **Time to complete** | ~30 min |
| **Prerequisites** | Node 20, completed setup in `frontend/README.md` |

## What you'll learn

- …
- …
- …

## What you'll build

A short description + screenshot/diagram of the end result.

## Step 1 — <verb phrase>

Narrative paragraph. Why are we doing this step? What's the mental model?

```bash
# exact command
```

```typescript
// exact code, no placeholders
```

> **What just happened?** One paragraph explaining the outcome of this step.

## Step 2 — …

…

## What you built

Recap. Link to the relevant **reference** docs that describe what the reader just touched.

## What's next

- Try the next tutorial: `…`
- Read the reference: [`../reference/<topic>.md`](../reference/<topic>.md)
- See the full pattern in: `frontend/<path>`
```

---

## Conventions for tutorials

1. **Numbered filenames.** `01-…`, `02-…`. The order matters; later tutorials may build on earlier ones.
2. **Time estimate in the header.** Real budget, not aspirational.
3. **Working code, every step.** The reader's app should run after every step. No "we'll fix this in step 5" cliffhangers.
4. **Recap at the end.** Link out to reference docs so the reader can deepen understanding without you re-stating it inline.
5. **Re-test before merging.** A tutorial that compiles today rots fast. Re-run it from scratch every time `Last reviewed` is bumped.
6. **Limit scope.** A tutorial that covers more than one feature is two tutorials.

---

## See also

- [`../index.md`](../index.md) — frontend platform docs entry point
- [`../guides/README.md`](../guides/README.md) — task-oriented how-to guides
- [`../reference/README.md`](../reference/README.md) — factual lookup docs
- [`../explanation/README.md`](../explanation/README.md) — conceptual / "why" docs
