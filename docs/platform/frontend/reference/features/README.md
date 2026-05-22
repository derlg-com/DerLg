# Per-feature frontend reference

> Each major frontend feature has a reference doc here. The doc is the **single source of truth for how the feature is implemented on the frontend** — its routes, components, stores, queries, mutations, i18n namespaces, error states, and tests.
>
> See [ADR-0006](../../adr/0006-per-feature-frontend-reference-docs-location.md) for why these docs live here. See [`../README.md`](../README.md) for the cross-cutting reference docs every per-feature doc cites.

| Field | Value |
|-------|-------|
| **Owner** | Frontend platform team |
| **Status** | Active |
| **Last reviewed** | 2026-05-22 |
| **Related ADRs** | [ADR-0006](../../adr/0006-per-feature-frontend-reference-docs-location.md) |
| **Template** | [`../../_template-feature.md`](../../_template-feature.md) |

---

## What lives here

A per-feature reference doc:

- Describes a **single feature's frontend implementation** factually (routes, components, state, data flow).
- Cites cross-cutting reference docs ([`../state-and-data.md`](../state-and-data.md), [`../auth-and-session.md`](../auth-and-session.md), [`../design-system.md`](../design-system.md), [`../i18n-and-locale.md`](../i18n-and-locale.md), [`../testing.md`](../testing.md), …) — never restates them.
- Pairs with the **product spec** under [`docs/modules/<feature>/`](../../../../modules/) (requirements, API contract, cross-cutting architecture). The product spec describes *the feature as a product*; the doc here describes *the feature as frontend code*.

A per-feature reference doc is **not**:

- A guide ("how to do X with this feature") — those go under [`../../guides/`](../../guides/).
- An explanation ("why we built it this way") — those go under [`../../explanation/`](../../explanation/).
- A tutorial — those go under [`../../tutorials/`](../../tutorials/).
- A product spec — that lives in [`docs/modules/<feature>/`](../../../../modules/).

---

## Index

| Feature doc | Product spec |
|-------------|--------------|
| _(none yet — add a row when you author the first one)_ | — |

When the table grows long, group by category (Booking, AI / Vibe Booking, Account, Settings, etc.) and keep the per-row link shape uniform.

---

## How to add a feature doc

1. Copy [`../../_template-feature.md`](../../_template-feature.md) to `<feature>.md` here. Use kebab-case matching the slug in [`docs/modules/<feature>/`](../../../../modules/).
2. Fill in the header (Owner, Status, Last reviewed, Product spec link, Related ADRs, Related code paths).
3. Complete the required sections — they are listed in the template and enforced by [ADR-0006](../../adr/0006-per-feature-frontend-reference-docs-location.md).
4. Add a row to the **Index** table above.
5. Add a row to the table in [`../README.md`](../README.md#per-feature-reference--features) for top-level discoverability.
6. Delete the **Authoring notes** section from your copy of the template before merging.

---

## Naming and file placement

| Item | Convention | Example |
|------|-----------|---------|
| Feature doc filename | `kebab-case.md` matching `docs/modules/<feature>/` slug | `vibe-booking.md` |
| Sub-doc folder (rare) | `kebab-case/` with its own `README.md` | `vibe-booking/renderers.md` |
| Feature components folder | `frontend/components/<feature>/` | `frontend/components/vibe-booking/` |

Anti-patterns:

- ❌ `VibeBooking.md` — wrong case.
- ❌ `vibe_booking.md` — wrong separator.
- ❌ Splitting one feature into multiple top-level files (`vibe-booking-routes.md`, `vibe-booking-state.md`). Use sub-doc folders instead, with a single entry-point file.

---

## See also

- [`../README.md`](../README.md) — cross-cutting reference index.
- [`../../adr/0006-per-feature-frontend-reference-docs-location.md`](../../adr/0006-per-feature-frontend-reference-docs-location.md) — why this folder exists.
- [`../../governance.md`](../../governance.md) — Diátaxis taxonomy and Definition of Done.
- [`../../_template-feature.md`](../../_template-feature.md) — the scaffold.
