# Frontend Architecture Decision Records (ADRs)

> An Architecture Decision Record captures **a single significant decision**, the **context** that led to it, the **consequences**, and its **status**. ADRs are how the frontend codebase remembers *why* it looks the way it does.

---

## How ADRs work here

- ADRs are numbered sequentially: `0001`, `0002`, …
- Each ADR has one status: `Proposed`, `Accepted`, `Deprecated`, or `Superseded by ADR-XXXX`.
- Once **Accepted**, an ADR is **immutable**. To change a decision, write a new ADR that supersedes it.
- Filename pattern: `NNNN-short-kebab-title.md`. Use the present-tense title that describes the decision (e.g., `0003-use-zustand-for-client-state.md`).
- Use [`0000-template.md`](./0000-template.md) when creating a new one.

See [`../governance.md`](../governance.md) for when an ADR is required.

---

## Index

| #    | Title                                                                 | Status   | Date       |
|------|-----------------------------------------------------------------------|----------|------------|
| 0001 | [App Router with Server Components by default](./0001-app-router-server-components-default.md) | Accepted | 2026-05-22 |

> Add a row above for each new ADR. Newest at the top after this row, or keep sorted ascending — pick one and stick to it. (Convention here: ascending by number.)

---

## Statuses

| Status | Meaning |
|--------|---------|
| **Proposed** | Drafted in a PR, under discussion, not yet binding. |
| **Accepted** | Merged. Code and other docs reflect this decision. |
| **Deprecated** | No longer relevant (the system no longer does this), but kept for history. Add a note explaining why. |
| **Superseded by ADR-NNNN** | Replaced by a later decision. Link the new ADR. |

---

## Authoring tips

- One decision per ADR. If you find yourself writing "and also…", you have two ADRs.
- Be honest about **trade-offs**. The "Negative consequences" section is the most valuable part.
- Link to **specific code** and **specific docs** that change because of the decision.
- Avoid restating the obvious. Future readers can read the framework docs; they need to know *why this team picked this option for this product*.
