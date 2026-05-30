# Vibe Booking — Test Report (v3)

**Date:** 2026-05-30
**Tested by:** browser E2E (Playwright) + direct API checks
**Result:** ✅ **PASS** — trips and hotels both render end-to-end. Fixed 2 new bugs this round. 1 minor item remains (hotel seed duplicates).

---

## 1. What Was Tested

| Service | Port | Status |
|---------|------|--------|
| Frontend (Next.js) | 3000 | ✅ UP |
| Backend (NestJS) | 3003 | ✅ UP |
| AI Agent (FastAPI) | 8000 | ✅ UP |
| Redis (Docker) | 6379 | ✅ UP |
| MinIO (Docker) | 9000 | ✅ healthy |
| Supabase Postgres | remote | ✅ connected |

**Test URL:** http://localhost:3000/vibe-booking

**Flows tested this round:**
1. "Show me trips to Siem Reap for 5 days for 2 people" → **1 distinct trip card**, images load
2. "Show me hotels in Siem Reap" → **hotel cards render**, images load
3. "Book Now" as a guest → **login modal** appears

---

## 2. Result Summary

| Capability | Result |
|------------|--------|
| Trip search → cards | ✅ 1 distinct card (no duplicates after v2 reseed), images load |
| Hotel search → cards | ✅ Cards render, images load, 0 console errors |
| Trip/hotel card images (MinIO via next/image) | ✅ 200, decode in browser |
| Booking gate for guests | ✅ Login modal |
| Agent chat text | ✅ Clean, no leaked tool-call JSON |
| Console errors | ✅ 0 |
| Backend build (`tsc`) | ✅ 0 errors |

---

## 3. New Bugs Found & Fixed This Round

### Bug 1 — Hotel search crashed the WebSocket handler (frontend) — FIXED
**Symptom:** Hotel search produced no cards; console threw `TypeError: Cannot assign to read only property 'content'` in `useWebSocket connect`.
**Cause:** `hooks/useWebSocket.ts` directly mutated frozen Zustand (Immer) state — `useVibeBookingStore.getState().messages[i].content = newText` — when finalizing a streamed message. Immer freezes state, so the assignment threw and aborted the handler **before** the `content_payload` (cards) was processed → no cards rendered.
**Fix:** Added a `finalizeStreamingMessage(text)` action to `stores/vibe-booking.store.ts` that updates the message inside a proper `set()` producer, and replaced the illegal mutation in `useWebSocket.ts` with it.

### Bug 2 — Hotel search returned 400 (backend) — FIXED
**Symptom:** Agent replied "The tool execution failed." `GET /v1/ai-tools/hotels?city=Siem Reap` → 400 `check_in/check_out must be a valid ISO 8601 date string`.
**Cause:** `SearchHotelsDto` made `check_in` and `check_out` **required**, but a plain "hotels in Siem Reap" request has no dates, so the LLM omitted them → validation 400. The service's `searchHotels` doesn't even use those dates in its query.
**Fix:** Made `check_in`/`check_out` `@IsOptional()` in `ai-tools.dto.ts`. Endpoint now returns 200 with hotels. (Same class of fix as v2's trip-search over-constraint.)

---

## 4. Carried-Over Fixes (verified still working)

| Item | Status |
|------|--------|
| MinIO images (`dangerouslyAllowLocalIP` + `dangerouslyAllowSVG`) | ✅ Working — images load |
| Duplicate **trips** cleared via trips-only reseed | ✅ 5 unique trips, 1 card per search |
| WebSocket `_safe_close` guard | ✅ In code, agent running it |
| Booking login gate | ✅ Guest → login modal |
| Google OAuth + Google Maps | ✅ Present |

---

## 5. Still Open (Minor)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| H1 | **Duplicate hotel seed data** — DB had 20 hotels (5 unique × 4). | ✅ **FIXED & VERIFIED** | Made `05-hotels.ts` idempotent (`deleteMany` like `08-trips.ts`) and ran a hotels-only reseed. DB now has 5 unique hotels, 0 duplicates; Siem Reap search returns 3 distinct hotels; UI shows distinct cards, images load, 0 console errors. (Cleared 2 throwaway test bookings first to avoid orphaned booking items.) |

_No open items remain._

---

## 6. Files Changed This Round

- `frontend/stores/vibe-booking.store.ts` — added `finalizeStreamingMessage` action
- `frontend/hooks/useWebSocket.ts` — replaced frozen-state mutation with the new action
- `backend/src/modules/ai-tools/ai-tools.dto.ts` — `check_in`/`check_out` now optional
- `backend/prisma/seeds/05-hotels.ts` — made idempotent (`deleteMany` guard); hotels reseeded (20 → 5 unique)

## 7. Evidence

- Trip cards: `vibe-booking-images-fixed.png`
- Hotel cards: `vibe-booking-hotels-working.png`
- `GET /v1/ai-tools/hotels?city=Siem Reap` → HTTP 200 (10 hotels)
- Browser: 20 hotel card images, all decoded, 0 console errors
- Backend `tsc`: 0 errors
