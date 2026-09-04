Audit complete. The structured review has been saved to `/home/rayu/derlg-v2/docs/review-frontend.md`.

Summary:
- **Tests, typecheck, and build all pass** (`28/28` tests, `npm run build` succeeds).
- **One critical issue**: `useVibeWebSocket.ts` is mock-first and cannot drive the real backend end-to-end.
- **Major gaps**: inverted/leaky resize logic in `SplitScreenLayout`, missing focus trap on mobile chat, `MapViewRenderer` is only a static placeholder, `HotelCardsRenderer` lacks thumbnail grid, `BottomNav` is hidden on all desktop routes, `npm run lint` is broken (Next.js 16 has no `next lint`), and the PWA manifest references icons that do not exist.
- **Minor/polish items**: trust-bar icon colors, 44px touch targets on quick-reply chips, localized hardcoded chips, `next/image` usage, view-mode toggle, countdown pulse animation, social-login placeholders, temple icon, confetti, and error-boundary fallback wiring.
