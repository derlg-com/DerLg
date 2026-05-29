# Template Booking — Multi-Resource Journey Layer

Methods **M1 / M2 / M3** from `../booking-methods.md`.

This folder covers booking flows where the user commits a **multi-resource journey** — a multi-day itinerary composed of several `BookingItem`s (transportation segments, hotel nights, guide hours, optional single-trip slots). The journey may be:

- **M1 — public package:** the user picks a fixed, atomic published trip with package-level capacity. The package itself is the inventory unit; underlying resources are admin-coordinated. (Spec deferred to its own PR.)
- **M2 — private package:** the user starts from a curated `Trip` template and customizes it (swap days, change hotel, etc.). The `Booking.tripTemplateId` records the seed Trip so analytics and (future) bundle-discount logic can compare the committed itinerary against the template.
- **M3 — build from scratch:** the user composes the journey from an empty canvas, day by day. No `tripTemplateId`.

All three converge on the same atomic writer: `src/modules/bookings/use-cases/commit-booking.use-case.ts`. The simplest entry point — a single `POST /v1/bookings/template` that takes a journey body directly and books it — ships in `feature/2026-05-23-booking-engine` (proves the path works end-to-end). The richer per-method flows (M3's skeleton generator + per-day wizard, M2's template loading + edit detection, M1's atomic capacity + departure-date slots) ship in follow-up PRs that sit on top of `TemplateBookingUseCase`.

## Build order

1. **`build-from-scratch/`** (M3) — broadest customization surface; once its primitives work (skeleton generator, per-day wizard, journey assembly, draft persistence), M1 and M2 become subsets.
2. **`private-package/`** (M2) — adds the template-driven layer on top of M3 (template loading, as-is materializer, edit detection, group-size / kid-friendly / day-mutation validators).
3. **`public-package/`** (M1) — adds atomic package-level capacity tracking on top of the journey layer (departure-date slots, fixed-price commit, no item-level customization).

## Counterpart

See `../specific-booking/README.md` for the parallel single-resource layer (M4a–M4d).
