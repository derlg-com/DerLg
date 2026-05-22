# Frontend Design Queue

> **Live state.** What's designed, what's next, who owns what. Updated every time a design doc lands or changes status.
>
> Static rules and lifecycle live in [`README.md`](./README.md). Decision and rationale live in [ADR-0008](../adr/0008-frontend-feature-design-docs-location-and-lifecycle.md).
>
> **For new contributors / AI agents:** read [`README.md`](./README.md) first, then [`../_template-feature-design.md`](../_template-feature-design.md), then check the table below to know what to pick up.

| Field | Value |
|---|---|
| **Last reviewed** | 2026-05-22 |
| **Total features in queue** | 15 |
| **Drafting** | 7 |
| **Approved** | 2 |
| **Implementing** | 0 |
| **Shipped** | 0 |

---

## How to use this queue

1. **Find the next feature.** Look down the table for the highest-priority `Not started` row whose dependencies are all `Approved` or `Shipped`.
2. **Confirm ownership.** If the row is owned by someone else, pick the next eligible row.
3. **Create the design doc.** Copy [`../_template-feature-design.md`](../_template-feature-design.md) → `features/<slug>.md`. Set `Status: Drafting`.
4. **Update this queue.** Change Status to `Drafting`, fill in the Doc column, bump `Last reviewed`. Same PR.
5. **Iterate.** When the doc reaches `Approved`, update this queue. When implementation starts, update again. When the matching `reference/features/<slug>.md` lands, mark `Shipped` here and link the reference doc.

The queue is the **only place** `Status` lives at the queue-wide level. The doc itself also tracks status; the two must stay in sync (PR review enforces this).

---

## Live queue (sorted by build order)

| Order | Feature slug | Phase | Priority | Scope | Status | Owner | Depends on | Doc |
|---|---|---|---|---|---|---|---|---|
| 1 | `auth` | 3 | P0 | MVP | Approved | You | — | [`features/auth.md`](features/auth.md) |
| 2 | `app-shell` | 4 | P0 | MVP | Approved | You | `auth` | [`features/app-shell.md`](features/app-shell.md) |
| 3 | `vibe-booking` | 6 | P0 | MVP | Not started | Senior | `auth` (token contract) | — |
| 4 | `trip-discovery` | 5 | P0 | MVP | Drafting | You | `auth`, `app-shell` | [`features/trip-discovery.md`](features/trip-discovery.md) |
| 5 | `hotel-booking` | 5 | P0 | MVP | Drafting | TBD | `auth`, `trip-discovery` (pattern) | [`features/hotel-booking.md`](features/hotel-booking.md) |
| 6 | `transportation` | 5 | P0 | MVP | Drafting | TBD | `auth`, `trip-discovery` (pattern) | [`features/transportation.md`](features/transportation.md) |
| 7 | `tour-guide` | 5 | P0 | MVP | Drafting | TBD | `auth`, `trip-discovery` (pattern) | [`features/tour-guide.md`](features/tour-guide.md) |
| 8 | `payments` | 5 | P0 | MVP | Drafting | TBD | At least one booking flow | [`features/payments.md`](features/payments.md) |
| 9 | `my-trip` | 7 | P0 | MVP | Drafting | TBD | `auth`, bookings | [`features/my-trip.md`](features/my-trip.md) |
| 10 | `profile` | 7 | P0 | MVP | Drafting | TBD | `auth` | [`features/profile.md`](features/profile.md) |
| 11 | `explore-places` | 5–6 | P1 | MVP | Not started | TBD | `app-shell` | — |
| 12 | `student-verification` | — | P1 | v1.1 | Not started | TBD | `auth` | — |
| 13 | `loyalty` | — | P2 | v1.1 | Not started | TBD | `auth`, `payments` | — |
| 14 | `emergency` | — | P1 | v1.2 | Not started | TBD | `auth`, `my-trip` | — |
| 15 | `festivals` | — | P2 | v1.2 | Not started | TBD | `app-shell` | — |

`Status` values: `Not started` · `Drafting` · `Approved` · `Implementing` · `Shipped`.

---

## Parallel tracks

To unblock multiple contributors at once:

| Track | Owner | Sequence |
|---|---|---|
| **A — User-facing core** | You | `auth` → `app-shell` → `trip-discovery` → (one of) `hotel-booking` / `transportation` / `tour-guide` → `payments` → `my-trip` → `profile` |
| **B — AI differentiator** | Senior | `vibe-booking` (can start §1–§5 of the doc in parallel; §6 client state waits on `auth`'s access-token contract) |
| **C — Post-MVP** | TBD | `explore-places` → `loyalty` → `student-verification` → `emergency` → `festivals` |

Track A and Track B can proceed in parallel. Track A's `auth` design doc reaching `Approved` is the unblock event for Track B's §6 (client state).

---

## Dependency rules

A feature can only reach `Approved` if **all features it depends on** are at `Approved` or beyond.

Why: the dependency means *this design borrows decisions from that one*. If the upstream design is still in flux, this design's decisions are unsafe to lock in.

Critical-path notes:

- **`auth` is the universal gate.** Almost every feature depends on F01–F06 in some form.
- **`trip-discovery` sets the list-detail-book pattern.** `hotel-booking`, `transportation`, `tour-guide` reuse it. Don't design those first; you'll re-do them.
- **`payments` consumes the booking-hold contract.** Design at least one booking feature first to lock that contract.
- **`vibe-booking` consumes the access-token contract from `auth`.** Senior may write §1–§5 of the Vibe Booking design (goal, flow, pages, per-page, data model) while `auth` is still drafting; §6 (client state) is the sync point.
- **`my-trip` aggregates all bookings.** Design after `hotel-booking` / `transportation` / `tour-guide` are at least `Approved`.
- **`emergency` lives inside `my-trip`'s active-trip context.** Design after `my-trip`.

---

## Excluded from this queue

These appear in `docs/modules/README.md` but are **not** features in the frontend code sense. They're cross-cutting infrastructure that lives in `shared/` and gets a cross-cutting reference doc, not a feature design doc.

| Module | Frontend home | Doc home (when authored) |
|---|---|---|
| `multilanguage` (#13) | `shared/lib/i18n/` | `docs/platform/frontend/reference/i18n-and-locale.md` (per ADR-0004) |
| `offline-maps` (#12) — tile caching half | `shared/lib/pwa/` | `docs/platform/frontend/reference/pwa.md` |
| HTTP client / providers / theme | `shared/lib/api/`, `shared/components/providers/` | `docs/platform/frontend/reference/state-and-data.md` |

The map page UI from `offline-maps` lives inside `explore-places`'s design doc (one feature, one design — the map is part of how Explore renders).

---

## How to update this file

When a design doc transitions states, **the same PR** updates:

1. The `Status` field in the doc itself (`features/<slug>.md` header).
2. The matching row's `Status` and `Doc` columns in this file.
3. The summary stats at the top (`Approved`, `Implementing`, `Shipped` counts).
4. The `Last reviewed` field.

When a feature is added (e.g., a new feature lands in `feature-decisions.md`):

1. Add a new row in the live queue table.
2. Decide phase, priority, scope, owner, dependencies. If unclear, leave `TBD` and flag in the PR.
3. Bump `Total features in queue`.

When a feature is removed (rejected, deferred indefinitely):

1. Move the row to a new "Removed / Deferred" section at the bottom with a one-line reason and date.
2. Decrement `Total features in queue`.

---

## Resuming after a context reset

If you (human or AI) are picking this up fresh, the read order is:

1. [`frontend/context/roadmap.md`](../../../../frontend/context/roadmap.md) — current phase, what's decided, what's not in code yet.
2. [`README.md`](./README.md) — design layer rules.
3. **This file** — what to design next.
4. [`../_template-feature-design.md`](../_template-feature-design.md) — the template.
5. [ADR-0008](../adr/0008-frontend-feature-design-docs-location-and-lifecycle.md) — the binding decision behind the layer.

Then pick the highest-priority `Not started` row whose dependencies are clear and start drafting.

---

## Related

- [`README.md`](./README.md) — design layer rules and lifecycle.
- [`../_template-feature-design.md`](../_template-feature-design.md) — canonical design template.
- [ADR-0008](../adr/0008-frontend-feature-design-docs-location-and-lifecycle.md) — decision behind this layer.
- [Roadmap](../../roadmaps/frontend-roadmap.md) — phased build plan.
- [Feature registry](../../../product/feature-decisions.md) — F-IDs cited in design docs.
- [Module index](../../../modules/README.md) — module-level (=feature-level) coarse list.
