# ADR-0002: State management — Zustand for client state, React Query for server state

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-22 |
| **Deciders** | Frontend platform team |
| **Tags** | `state`, `data-fetching`, `caching` |

---

## Context

The DerLg frontend has two distinct kinds of state, and they have different lifecycles, ownership, and freshness requirements.

**Server-owned state.** Data that lives in the NestJS backend's database — trips, hotels, bookings, user profile, payment intents. The frontend doesn't own it; it caches it. Freshness matters. Two tabs of the same user must converge. Mutations on one screen must invalidate caches on others.

**Client-owned state.** UI and session state that only exists in the browser — the active locale, the chat WebSocket connection status, the current Vibe Booking content payload, the bottom-sheet open/closed state, the sign-in form's transient values. The server has no opinion. Some of it must survive a refresh (locale, chat history); most should not (form drafts, modal state).

When this decision was taken:

- `frontend/stores/` already contains three Zustand stores (`chat.store.ts`, `vibe-booking.store.ts`, `content.store.ts`) using `zustand/middleware` `persist` for the chat history and session id.
- React Query is **not yet installed**. The roadmap commits to it, but no hook exists yet.
- The codebase has zero raw `fetch` calls in components; the existing data path is the WebSocket-driven Vibe Booking flow only.
- The performance budget (3G Slow target) makes us care about: avoiding waterfalls, avoiding refetch storms on tab focus, and rendering as much HTML on the server as possible.

Constraints:

- **One pattern per concern.** We will not maintain two state libraries for the same job.
- **Server Components by default** ([ADR-0001](./0001-app-router-server-components-default.md)). Initial reads happen on the server; the client picks up where the server left off.
- **No global Context for cross-cutting state.** Context re-renders are too coarse for the chat/Vibe-Booking surface area.
- **Hydration safety.** Persisted state from `localStorage` must not cause SSR/CSR mismatches.
- **AI agent untrusted.** Anything that comes from the AI (`content_payload`) must be Zod-validated before it lands in any store.

---

## Decision

We will use **Zustand** as the single store for client-owned state and **TanStack Query (React Query) v5** as the single layer for server-owned state. There is no third state library.

> The boundary is: **if the backend owns the data, it goes through React Query. If only the browser owns it, it goes in a Zustand store. There is no overlap.**

Concretely:

- **Zustand** owns: auth tokens in memory (access token), chat WebSocket connection status, chat message buffer, AI content stage payload, current locale, currency, UI toggles (modals, drawers), form drafts that should survive route navigation, and the Vibe Booking session id.
- **React Query** owns: trips, hotels, guides, transport, bookings list, booking detail, user profile, payment intents, loyalty balance, anything fetched via REST `/v1/*`.
- **React Context** is allowed only for the React Query `QueryClientProvider`, the next-intl `IntlProvider`, the Toast provider, and the Theme provider (if any). Context is **not** a state library here.
- **Server Components** read directly via `lib/api/*` server helpers using `fetch` with cache hints; they hydrate React Query caches via `dehydrate` / `HydrationBoundary` when a child Client Component will reuse the data.

---

## Options considered

### Option A — Redux Toolkit + RTK Query

- **Pros:** Single library covers both halves. RTK Query has solid cache invalidation. Mature DevTools.
- **Cons:** Boilerplate-heavy (slices, reducers, action creators) for a small team. Harder to learn for new contributors. Larger bundle. Overkill for the surface area we have. Doesn't pair as cleanly with React 19 Server Components.

### Option B — Context + `useReducer` for client, raw `fetch` + `useEffect` for server

- **Pros:** Zero dependencies. Stdlib only.
- **Cons:** Re-render storms on Context updates. No cache invalidation. Every list page re-fetches on mount. No request deduping. Poor DX. Loses on every metric we care about.

### Option C — Zustand + TanStack Query *(chosen)*

- **Pros:**
  - Zustand is ~1 KB gzipped, hooks-only, no providers needed for the store itself, and survives SSR cleanly.
  - TanStack Query is the de-facto standard for server state in React 19, has built-in dedup, stale/cache-time, optimistic updates, hydration helpers for RSC, and works with both Suspense and traditional patterns.
  - The two libraries have **non-overlapping concerns**. One owns "this changes when the user clicks", the other owns "this changes when the server changes". The split is mechanically obvious.
  - Both have small bundle footprints, important on Cambodian 4G/3G.
- **Cons:**
  - Two libraries to learn instead of one.
  - Hydrating server-fetched data into React Query requires `dehydrate` / `HydrationBoundary` boilerplate (mitigated by a small wrapper helper).
  - Persisting Zustand to `localStorage` requires careful hydration to avoid SSR mismatches (mitigated by a `useHasHydrated` hook gating client-only reads).

### Option D — Jotai

- **Pros:** Atomic state, fine-grained re-renders.
- **Cons:** The atom mental model adds friction for a small team. Less momentum than Zustand in the Next.js ecosystem. No clear win for our surface area.

**Chosen:** Option C. The mechanical split (server vs client) maps cleanly to the two libraries; both have small footprints and align with the framework's direction.

---

## Consequences

### Positive

- Every state question has one obvious answer: *"Does the backend own this?"* If yes → React Query. If no → Zustand.
- New contributors can read the boundary in one sentence and apply it.
- React Query's cache invalidation removes a class of bugs (stale lists after mutation).
- Server Components can prefetch data and hydrate the React Query cache, avoiding a redundant client fetch on the first render.
- Zustand's persist middleware is enough for the small set of things we need to survive a refresh; we don't need a heavier solution.

### Negative

- Two libraries means two sets of patterns to document and review.
- Persisted Zustand state can mismatch SSR HTML if read directly during render. We mitigate with a `useHasHydrated` hook (or `skipHydration: true` + manual `rehydrate` on mount). This is a known gotcha that will trip new contributors at least once.
- React Query's hydration boundary requires a thin wrapper around server data fetching. We accept the boilerplate.

### Neutral / things we accept

- We will not adopt Server Actions for mutations in v1. All mutations go through React Query `useMutation` for consistency with the WebSocket-heavy stack and to keep cache invalidation in one place. Revisit per a future ADR if Server Actions prove valuable for forms.
- React Query devtools are enabled in development only, lazy-loaded.

---

## Implementation

### Packages to add to `frontend/package.json`

```json
{
  "dependencies": {
    "zustand": "5.0.2",
    "@tanstack/react-query": "5.62.7"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "5.62.7"
  }
}
```

Pinned versions per [`.kiro/steering/conventions.md`](../../../../.kiro/steering/conventions.md) (no `^` or `~`). Lockfile committed in the same PR.

### Code changes

- **`frontend/lib/query-client.ts`** — Single `QueryClient` factory. Default `staleTime: 30_000`, `gcTime: 300_000`, `retry: 1` for queries, `retry: 0` for mutations, `refetchOnWindowFocus: false` (Cambodian network noise) but **on** for the active booking flow via per-query override.
- **`frontend/app/providers.tsx`** — Wraps children in `QueryClientProvider` and `HydrationBoundary`. Marked `'use client'` with the required leading comment per [`../architecture.md`](../architecture.md).
- **`frontend/lib/api-client.ts`** — Plain `fetch` wrapper with envelope unwrapping (`{ success, data, message, error }` → throw on `success: false`), bearer token injection, and 401 → token refresh handoff. Used by both server helpers (`lib/api/*`) and client hooks (`hooks/use-*`).
- **`frontend/lib/api/*.ts`** — Server-side helpers (no `'use client'`). Called from Server Components. May `await` `fetch` directly. May call `prefetchQuery` on the request-scoped `QueryClient` to seed the hydration boundary.
- **`frontend/hooks/use-*.ts`** — React Query hooks. Naming: `use-<resource>.ts`, exports `useResource`, `useResourceList`, `useCreateResource`, etc. Query keys are arrays starting with the resource name.
- **`frontend/stores/*.store.ts`** — One Zustand store per domain. Existing `chat.store.ts`, `vibe-booking.store.ts`, `content.store.ts` stay. New stores added per feature when client-only state is genuinely needed.
- **`frontend/hooks/use-has-hydrated.ts`** — Helper for components that read persisted Zustand state during render.

### Documentation that flows from this ADR

- [`reference/state-and-data.md`](../reference/state-and-data.md) — full contract: store shapes, query key conventions, mutation patterns, hydration rules, error handling. To be authored once the libraries are installed.
- [`guides/wire-a-new-react-query-hook.md`](../guides/wire-a-new-react-query-hook.md) — recipe.
- [`guides/debug-a-hydration-mismatch.md`](../guides/debug-a-hydration-mismatch.md) — recipe.
- [`explanation/why-zustand-and-react-query.md`](../explanation/why-zustand-and-react-query.md) — mental model.

### Anti-patterns this decision rules out

- ❌ Storing fetched server data in a Zustand store "for convenience". The cache will go stale and there is no invalidation mechanism.
- ❌ Calling `useQuery` for static data that doesn't change after mount. Use a Server Component instead.
- ❌ Wrapping everything in `Context.Provider` to "share" state. If two components need the same state, put it in a store.
- ❌ Reading persisted Zustand state during the first render without `useHasHydrated`. SSR HTML will mismatch.
- ❌ Mixing `useQuery` and Zustand for the same piece of data (e.g., bookings list cached in both). One source of truth.

---

## Links

- Related ADRs: [ADR-0001](./0001-app-router-server-components-default.md) (Server Components by default — required for the hydration story).
- Related docs: [`../architecture.md`](../architecture.md), [`../foundation.md`](../foundation.md), planned [`../reference/state-and-data.md`](../reference/state-and-data.md).
- External:
  - [TanStack Query — Advanced SSR with Next.js App Router](https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr)
  - [Zustand — Persist middleware + Next.js hydration](https://github.com/pmndrs/zustand/wiki/Persisting-store-data)

---

## History

| Date | Change |
|------|--------|
| 2026-05-22 | Created and Accepted. Codifies the existing `frontend/stores/` Zustand usage and commits to React Query for all REST-backed state. |
