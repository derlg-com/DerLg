# ADR-0001: App Router with Server Components by default

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `routing`, `rendering`, `performance` |

---

## Context

DerLg's primary market is mobile travelers in Cambodia, often on 3G/4G networks with high latency and intermittent connectivity. Reducing JavaScript shipped to the browser is the single highest-leverage performance lever we have.

When this decision was taken:

- Next.js 16.2.6 and React 19.2 were already installed in `frontend/`.
- The Pages Router was still available but no longer the default for new Next.js apps.
- The team had Vibe Booking and a heavy WebSocket-driven chat experience to build, both inherently client-side.
- The product surface includes a marketing landing page and trip detail pages that benefit from SEO and fast first paint.

Constraints:

- **Performance budget:** Mobile devices on 3G Slow (~400 Kbps, 400 ms RTT) must render a usable home screen within the budget defined in `performance.md`.
- **SEO:** Public marketing and trip detail pages must be server-rendered and indexable.
- **AI chat:** Vibe Booking is Client-heavy by definition (WebSocket, Zustand, Leaflet).
- **Team size:** Small team. We cannot afford to maintain two routing paradigms.

---

## Decision

We will use **Next.js App Router** as the only routing system, and **Server Components** as the default rendering mode for every file under `app/`. The `'use client'` directive is opt-in and requires one of five documented triggers (state, effects, refs, event handlers, or client-only libraries).

The boundary is enforced by:

1. ESLint configuration that flags suspicious patterns in Server Components.
2. The build itself, which fails when client-only imports leak into Server Components.
3. Code review against the Definition of Done in `governance.md`.

---

## Options considered

### Option A — Pages Router with React Query everywhere

- **Pros:** Familiar, mature, well-documented. Simpler mental model (everything is a Client Component).
- **Cons:** Ships a JS bundle for every page. Worse mobile performance. Diverges from Next.js's stated direction. We would be building on a path the framework is moving away from.

### Option B — App Router, but mark every page `'use client'` for simplicity

- **Pros:** Fewer surprises for engineers new to RSC. No mental overhead about the boundary.
- **Cons:** Defeats the purpose of adopting App Router. Same bundle problem as Pages Router. Loses RSC's ability to fetch data without `useEffect`.

### Option C — App Router with Server Components by default *(chosen)*

- **Pros:**
  - Smallest possible JS payload on first load.
  - Direct `await fetch()` in Server Components removes a layer of `useEffect` + loading-state ceremony.
  - Marketing and detail pages get true SSR with streaming.
  - Matches the framework's intended direction; we benefit from upstream optimizations.
- **Cons:**
  - Requires the team to internalize the RSC mental model (what runs where, why).
  - Some libraries (Zustand, Leaflet, Stripe Elements) require explicit `'use client'` boundaries.
  - Hydration mismatches between persisted Zustand state and SSR HTML need careful handling.

**Chosen:** Option C. The performance benefit on mobile is the deciding factor; the team friction is real but manageable through documentation and lint rules.

---

## Consequences

### Positive

- Server-rendered pages have a measurably smaller JS bundle. Critical for our 3G/4G target.
- Data fetching co-located with the route that needs it — fewer indirection layers.
- SEO works out of the box for `(public)` routes.
- We can hydrate React Query caches from the server, avoiding a second fetch on the client.

### Negative

- Engineers must learn the RSC boundary. New hires will trip over `'use client'` at first.
- Some popular libraries require client wrappers. We must maintain a small `components/ui/client/` shim layer for these cases.
- Hydration of persisted Zustand state requires explicit handling (see `state-and-data.md`).

### Neutral / things we accept

- Server Actions exist as an alternative to React Query mutations. We are not adopting them yet (consistency wins; revisit per future ADR).
- Some routes will inevitably be majority-client (Vibe Booking is the canonical example). We accept this as a special case rather than a reason to rethink the default.

---

## Implementation

- `frontend/app/` is structured per [`../architecture.md`](../architecture.md): three route groups `(public)`, `(auth)`, `(app)` plus the standalone `vibe-booking/`.
- ESLint flat config (`frontend/eslint.config.mjs`) extends `eslint-config-next` and is updated to flag client-only patterns in server files where the rule is available.
- Every Client Component declares `'use client'` on the first line and a one-line comment justifying the decision.
- Documentation:
  - [`../architecture.md`](../architecture.md) — folder layout and the five legitimate triggers for `'use client'`.
  - [`../foundation.md`](../foundation.md) — runtime contract.
  - [`../governance.md`](../governance.md) — Definition of Done enforces the rule.
- Anti-patterns called out in `architecture.md`:
  - Marking the whole page `'use client'` to enable one button.
  - Importing client-only libraries into Server Components.

---

## Links

- Related ADRs: none (first ADR).
- Related docs: [`../architecture.md`](../architecture.md), [`../foundation.md`](../foundation.md), [`../governance.md`](../governance.md).
- External:
  - [Next.js App Router docs](https://nextjs.org/docs/app)
  - [React Server Components RFC](https://github.com/reactjs/rfcs/pull/188)

---

## History

| Date | Change |
|------|--------|
| 2026-05-22 | Created and Accepted (codifies the existing structure of `frontend/app/`). |
