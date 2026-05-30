# Vibe Booking — Test Report (v2)

**Date:** 2026-05-30
**Tested by:** local dev startup + browser E2E (Playwright)
**Result:** ✅ **PASS** — feature works end-to-end. All originally-reported issues are fixed. 2 minor items remain.

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

**Flow tested:**
1. Open chat → "Show me trips to Siem Reap for 5 days, budget ~$700 for 2 people"
2. Agent searches → **trip cards render** in the Content Stage (image, duration, price, Book Now/Details)
3. Click "Book Now" as a guest → **login modal appears** ("Log in to complete your booking")

---

## 2. Verified Working

| Capability | Result |
|------------|--------|
| Trip search → cards render | ✅ 3 cards with image, "5 days · $599.00", action buttons |
| Agent chat text | ✅ Clean ("I found three 5-day trip options…") — no leaked tool-call JSON |
| Booking gate for guests | ✅ "Book Now" opens login modal instead of failing |
| Booking hold (authenticated path) | ✅ HTTP 200, creates booking |
| Hotel search / budget estimate | ✅ Working |
| Google OAuth + Google Maps | ✅ Added (`google-callback`, `MapViewRenderer`, `LoginModal`) |
| Agent unit tests | ✅ 14 passed |
| Backend unit tests (ai-tools + google-callback) | ✅ 7 passed |

---

## 3. Original Issues — Now Fixed

These were the blockers found in the first test pass. All resolved:

| # | Issue | How it was fixed |
|---|-------|------------------|
| 1 | Backend wouldn't compile — stale Prisma client (78 errors) | `prisma generate` |
| 2 | Missing dep `@nestjs/event-emitter` | `npm install` |
| 3 | `ai-tools.service.ts` used old enum/fields (`reserved`, `date`) | Updated to `hold`, `startDate`/`endDate`, `method`, `snapshot` |
| 4 | DB schema out of sync → booking writes 500 | `prisma db push` (additive, no data lost) |
| 5 | **"No cards"** — agent sent `null` for optional fields; frontend Zod `.optional()` rejects `null` → payload silently dropped | `_strip_none()` in `agent/core.py` |
| 8 | Trip search over-constrained by default $300/3-day budget | Duration now ±2-day tolerance window; budget optional |
| 9 | Model leaked raw tool-call JSON into chat | Fixed — agent text is now clean |
| 10 | Agent sent invalid `user_id "12345"` for guests | Deferred-auth gate: guests get a login prompt; real user_id injected from JWT |

---

## 4. Still Open (Minor)

## 4. Item Status (after follow-up fixes)

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| A | `next/image` **400** for MinIO images. Root cause was TWO Next.js 16 security defaults, not a missing remotePattern: (1) loopback-IP optimization is blocked by default, (2) the seed placeholder images are SVGs (served with `.jpg` names) and SVG optimization is blocked by default. | ✅ **FIXED & VERIFIED** | `next.config.ts`: `images.dangerouslyAllowLocalIP: true` + `images.dangerouslyAllowSVG: true`. Proxy now returns 200; images decode in browser; 0 console errors. |
| C | WebSocket double-close `RuntimeError` in agent log. | ✅ **FIXED & VERIFIED** | `_safe_close()` guard in `api/websocket.py` (+ `test_safe_close.py`). Agent restarted to run it. |
| B | **Duplicate seed data** — `search/trips` returned 3× of each trip (15 rows = 5 trips × 3). | ✅ **FIXED & VERIFIED** | Ran a trips-only reseed (`08-trips.ts`, now idempotent — `deleteMany` then recreate). DB now has 5 unique trips, 0 duplicates; `search/trips` returns 1 distinct "Cambodia Highlights"; UI shows a single card. |

---

## 5. How to Run the Stack

```bash
# 1. Dependencies (Docker)
docker start derlg-redis derlg-minio        # Redis :6379, MinIO :9000

# 2. Backend (from backend/)
npm run start:dev                            # :3003 → Supabase

# 3. Agent (from vibe-booking/) — unset stale shell key so .env is used
env -u NVIDIA_API_KEY .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 4. Frontend (from frontend/)
npm run dev                                  # :3000 → /vibe-booking
```

---

## 6. Evidence

- Browser screenshot of working cards: `vibe-booking-cards-working.png`
- `POST /v1/ai-tools/search/trips` → HTTP 200
- `POST /v1/ai-tools/bookings` → HTTP 200 (booking created)
- 21 unit tests passing (14 agent + 7 backend)
