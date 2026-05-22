# Explanation

> **Understanding-oriented documentation.** Discussion of *why* the frontend is shaped the way it is — concepts, trade-offs, mental models, alternatives considered. The reader is here to deepen understanding, not to do a task or look something up.
>
> If a doc is justifying a single irreversible decision, it probably belongs in [`../adr/`](../adr/) instead. ADRs are the historical record; explanation docs are the living conceptual narrative.

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active |
| **Last reviewed** | 2026-05-22 |
| **Related** | [`../index.md`](../index.md), [`../governance.md`](../governance.md), [`../adr/README.md`](../adr/README.md), [Diátaxis — Explanation](https://diataxis.fr/explanation/) |

---

## What "Explanation" means here

Explanation docs answer "why does it work this way?" and "what should I be thinking about when I touch this?". They sit one level above reference: where reference says *what is*, explanation says *what it means*.

Characteristics:

- **Discursive.** Prose, diagrams, comparison tables — not step-by-step.
- **Opinionated.** Captures the team's mental model, including the things you can't lint for.
- **Boundary-shaped.** Often explains *why a boundary exists* between two parts of the system.
- **Evergreen.** Updated when the conceptual model evolves, not on every code change.
- **Honest about trade-offs.** Names the alternatives that were considered and why they lost.

---

## Put a doc here when…

- A **mental model** needs to be shared before code can be reviewed sensibly (e.g. *"AI content is untrusted — here's what that means in practice"*).
- A **conceptual boundary** is repeatedly violated by new contributors and a doc-only reminder is needed.
- A **trade-off** doesn't fit one ADR (e.g. spans multiple decisions over time).
- A **comparison** is useful (Server vs Client Components, Zustand vs Context, why React Query and not SWR, etc.).
- The team needs to argue **what's not in scope** for the frontend.

## Don't put a doc here when…

- It's a **single, dated decision** → [`../adr/`](../adr/).
- It describes **what the system does** without justification → [`../reference/`](../reference/).
- It's a **task recipe** → [`../guides/`](../guides/).
- It's a **build narrative** → [`../tutorials/`](../tutorials/).
- It's just **personal preference** without a team consequence — leave it in the PR description.

---

## Index

| Doc | Topic |
|-----|-------|
| _(none yet — add as you write them)_ | — |

### Suggested first explanation docs (write when patterns stabilize)

- `why-server-components-default.md` — performance reasoning for Cambodian mobile networks, the hand-off between Server and Client Components, when to break the default.
- `why-zustand-and-react-query.md` — the split between client UI state (Zustand) and server state (React Query); why Context is not a state library; what belongs in localStorage.
- `ai-content-trust-model.md` — the AI agent is untrusted input; what the renderer can and cannot assume; the role of Zod, the error boundary, and DOMPurify.
- `mobile-first-rationale.md` — why we design at 375–428px first; what "progressive enhancement" means concretely; how desktop styles are layered on top.
- `i18n-philosophy.md` — why every string is a key; the cost of "small exceptions"; how plurals/genders/RTL would be handled if we needed them.
- `boundary-between-frontend-and-backend.md` — what the frontend is allowed to know, compute, and cache; why business logic stays in NestJS; what the AI agent's tool layer means for the frontend.

---

## Template for an explanation doc

```markdown
# <Concept or "Why X">

> One paragraph. What concept or trade-off does this explain? Who needs to read it before reviewing code in this area?

| Field | Value |
|-------|-------|
| **Owner** | <team or individual> |
| **Status** | Active |
| **Last reviewed** | YYYY-MM-DD |
| **Related ADRs** | ADR-XXXX |
| **Related reference** | [`../reference/<topic>.md`](../reference/<topic>.md) |

## TL;DR

3–5 bullets that capture the mental model.

## The problem

What forces shape this part of the system? What goes wrong without this concept?

## The model

Prose + diagrams. The team's preferred way of thinking about this.

## Alternatives considered

| Option | Why it lost |
|--------|-------------|
| … | … |
| … | … |

## Implications for code

Concrete consequences. What does a reviewer look for? What does a contributor avoid?

## Open questions

Things the team is still working out. Each should either become an ADR or be resolved in a follow-up.

## See also

- ADR: …
- Reference: …
- Guide: …
```

---

## Conventions for explanation docs

1. **Lead with TL;DR.** Three to five bullets that survive even if the rest is skimmed.
2. **Diagrams over prose** wherever a relationship is being explained.
3. **Name the alternatives.** A trade-off doc that doesn't list what was rejected isn't a trade-off doc.
4. **Link to ADRs and reference**, never duplicate them. Explanation docs *connect* facts; they don't restate them.
5. **Bump `Last reviewed`** when the mental model shifts, even if no single line changed.

---

## Explanation vs ADR

They look similar. The difference matters.

| | ADR | Explanation |
|---|-----|-------------|
| **Scope** | One specific decision | A concept, mental model, or recurring trade-off |
| **Lifecycle** | Immutable once Accepted; superseded by a new ADR | Living doc; updated as the model evolves |
| **Format** | Fixed template (Status, Context, Decision, Consequences) | Flexible — whatever explains the concept best |
| **When to write** | "We just decided X" | "I keep having to explain X in PR reviews" |
| **Tone** | Historical record | Teaching |

If in doubt, write the ADR first (decisions are easier to file), then if the concept needs ongoing teaching, add an explanation doc that links to it.

---

## See also

- [`../index.md`](../index.md) — frontend platform docs entry point
- [`../adr/README.md`](../adr/README.md) — architecture decision records
- [`../reference/README.md`](../reference/README.md) — factual lookup docs
- [`../guides/README.md`](../guides/README.md) — task-oriented how-to guides
