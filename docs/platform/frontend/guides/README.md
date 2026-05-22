# How-to Guides

> **Task-oriented documentation.** Each guide answers a single concrete question in the form *"How do I…?"*. The reader is an experienced engineer who already knows the system exists; they need a recipe, not a lecture.
>
> If you find yourself explaining concepts or covering many tasks at once, the doc belongs in [`../explanation/`](../explanation/) or [`../tutorials/`](../tutorials/) instead.

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active |
| **Last reviewed** | 2026-05-22 |
| **Related** | [`../index.md`](../index.md), [`../governance.md`](../governance.md), [Diátaxis — How-to guides](https://diataxis.fr/how-to-guides/) |

---

## What "How-to Guide" means here

A how-to guide is a short, focused procedure that delivers a result. It assumes competence, not familiarity with this specific codebase. It doesn't teach concepts — it links to the reference doc that does.

Characteristics:

- **One goal per doc.** Title is `<verb> <object>`, e.g. *"Add an authenticated route"*.
- **Numbered steps.** Linear from "you need this" to "it works".
- **Minimal prose.** Just enough context to know each step is the right one.
- **Concrete.** Real file paths, real commands, real code — no `// your-code-here` placeholders.
- **Outcome-checked.** End with "How to verify it worked."

---

## Put a doc here when…

- A task is **performed more than once** by more than one engineer.
- The procedure is **not obvious** from the reference doc alone.
- A teammate has had to ask the same question twice.
- A pattern is **easy to get wrong** in a way the type system can't catch (e.g. forgetting `'use client'`, putting i18n keys in the wrong namespace).

## Don't put a doc here when…

- It's a **one-off operation** that won't be repeated → leave a note in the PR.
- The task is **trivial** if you read the reference → improve the reference instead.
- It's a **conceptual explanation** without concrete steps → [`../explanation/`](../explanation/).
- It's an **end-to-end build narrative** → [`../tutorials/`](../tutorials/).

---

## Index

| Guide | When to use it |
|-------|----------------|
| _(none yet — add as you write them)_ | — |

### Suggested first guides (write when the underlying code lands)

- `add-a-new-route.md` — choosing a route group, page vs layout, metadata, auth guard
- `add-a-client-component.md` — when to use `'use client'`, the required leading comment, hydration considerations
- `add-an-i18n-string.md` — namespace selection, key naming, EN/ZH/KM workflow, fallback rules
- `wire-a-new-react-query-hook.md` — query key shape, cache invalidation, optimistic updates
- `handle-an-ai-content-payload.md` — Zod schema, error boundary, DOMPurify sanitization
- `debug-a-hydration-mismatch.md` — common causes, how to bisect, useful Next.js flags
- `ship-a-new-shared-component.md` — shadcn/ui adoption, design tokens, accessibility checks
- `add-a-feature-flag.md` — flag naming, evaluation point, rollout/rollback procedure

---

## Template for a how-to guide

```markdown
# How to <do the thing>

> One-sentence goal. What does the reader walk away having done?

| Field | Value |
|-------|-------|
| **Owner** | <team or individual> |
| **Status** | Active |
| **Last reviewed** | YYYY-MM-DD |
| **Related reference** | [`../reference/<topic>.md`](../reference/<topic>.md) |

## Prerequisites

- …
- …

## Steps

1. **Do X.**
   ```bash
   # exact command
   ```
2. **Edit Y.**
   ```typescript
   // exact diff or snippet
   ```
3. …

## Verify it worked

- [ ] Observable outcome 1
- [ ] Observable outcome 2

## Common pitfalls

- ❌ … because …
- ❌ … because …

## See also

- Reference: …
- Related guide: …
```

---

## Conventions for guides

1. **Title is a verb phrase.** `Add a new route`, not `Routing how-to`.
2. **Imperative voice.** "Run `npm run dev`", not "You should run `npm run dev`".
3. **No teaching.** Link to the reference doc; don't restate it.
4. **Verifiable end state.** Every guide ends with a checklist or a command whose output proves success.
5. **Pin versions** when a step depends on a tool version (Node, npm, Next.js).
6. **Bump `Last reviewed`** whenever a step is updated.

---

## See also

- [`../index.md`](../index.md) — frontend platform docs entry point
- [`../reference/README.md`](../reference/README.md) — factual lookup docs the guides link to
- [`../tutorials/README.md`](../tutorials/README.md) — end-to-end learning narratives
- [`../explanation/README.md`](../explanation/README.md) — conceptual / "why" docs
