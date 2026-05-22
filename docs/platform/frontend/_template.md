# [Doc Title]

> One-paragraph summary. What does this document cover? Who is it for?
>
> If a reader spends 5 minutes here, what should they walk away knowing?

| Field | Value |
|-------|-------|
| **Owner** | <team or individual> |
| **Status** | Draft \| Active \| Deprecated |
| **Last reviewed** | YYYY-MM-DD |
| **Related ADRs** | ADR-XXXX, ADR-YYYY |
| **Related specs** | `.kiro/specs/...` |
| **Related code** | `frontend/...` |

---

## TL;DR

3–5 bullet points. The minimum a reader needs to know if they read nothing else.

- …
- …
- …

---

## Context

Why does this part of the system exist? What problem does it solve?
What constraints (business, technical, regulatory) shape it?

---

## Design / Pattern

The actual content. Use subsections freely. Prefer:

- **Diagrams** (Mermaid) over prose
- **Tables** for enumerations (states, error codes, message types)
- **Code blocks with language tags** for examples
- **Concrete file paths** (`frontend/lib/api-client.ts`) over abstract references

```mermaid
flowchart LR
  A --> B
```

```typescript
// Concrete example, not pseudo-code
```

---

## Rules and conventions

Numbered list of MUST / SHOULD / MUST NOT rules a PR is reviewed against.

1. **MUST** …
2. **SHOULD** …
3. **MUST NOT** …

---

## Anti-patterns

What this design explicitly does NOT do, and why people might be tempted to.

- ❌ … because …
- ❌ … because …

---

## Acceptance criteria

A reviewer can use this as a checklist when reviewing a PR that touches this area.

- [ ] …
- [ ] …
- [ ] …

---

## Open questions

Decisions not yet made. Each should either become an ADR or be resolved in a follow-up.

- …

---

## References

- [Related doc](./other-doc.md)
- [Steering rule](../../../.kiro/steering/conventions.md)
- [External reference](https://...)
