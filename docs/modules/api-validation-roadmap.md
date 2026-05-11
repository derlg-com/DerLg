# API Validation Roadmap

> Master checklist and task tracker for validating all DerLg OpenAPI specifications before implementation.

**Status legend:** `-` Pending / `~` In Progress / `x` Passed / `!` Blocked / `N/A` Skipped

---

## Validation Phases

| Phase | Focus | Goal |
|-------|-------|------|
| P1 | Structural & Standards Compliance | Every spec is valid OpenAPI 3.0.3+, parseable, and self-consistent |
| P2 | Design Quality & Consistency | Naming, pagination, error envelopes, and REST conventions are uniform |
| P3 | Security & Auth Review | Auth schemes, scopes, and sensitive-data handling are correct |
| P4 | Cross-Module Integration | Inter-module references, shared schemas, and path conflicts are resolved |
| P5 | Functional & Non-Functional Requirements | Every endpoint maps to a requirement; NFRs (performance, availability, rate limits) are documented |
| P6 | CRUD Completeness & Detail Operations | Each resource exposes full Create, Read, Update, Delete + list/detail/search operations |
| P7 | Feature Operation Flows | End-to-end user journeys are documented as sequences of API calls |
| P8 | Production Standards | Rate limiting, idempotency, caching, observability, versioning, backward compatibility |
| P9 | Final Sign-off | All modules green; signed off by API owner |

---

## Per-Module Validation Tracker

### 01 — AI Travel Concierge Chat (`ai-chat/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 1.1 | OpenAPI syntax valid (lint with `swagger-codegen` or `redocly`) | - | - | - | - | - | - | - | - | - | |
| 1.2 | All paths use correct base prefix (`/v1/...`) | - | - | - | - | - | - | - | - | - | |
| 1.3 | `info.version` matches project convention (`1.0.0`) | - | - | - | - | - | - | - | - | - | |
| 1.4 | **Every endpoint has a `description` field** (not just `summary`) | - | - | - | - | - | - | - | - | - | |
| 1.5 | WebSocket `/chat` documented with upgrade headers | - | - | - | - | - | - | - | - | - | |
| 1.6 | AI tool endpoints (`/ai-tools/*`) use `serviceKey` security | - | - | - | - | - | - | - | - | - | |
| 1.7 | Request/response schemas have `required` arrays where appropriate | - | - | - | - | - | - | - | - | - | |
| 1.8 | Envelope shape (`success`, `data`, `message`) matches platform standard | - | - | - | - | - | - | - | - | - | |
| 1.9 | Enum values consistent with other modules (`en/zh/km`) | - | - | - | - | - | - | - | - | - | |
| 1.10 | **Functional requirements**: every endpoint maps to a requirement in `requirements.md` | - | - | - | - | - | - | - | - | - | |
| 1.11 | **NFRs documented**: chat response time < 2s, WebSocket reconnect, message retention (7d) | - | - | - | - | - | - | - | - | - | |
| 1.12 | **CRUD check**: AI sessions — list, get detail, delete (no update; session is immutable) | - | - | - | - | - | - | - | - | - | |
| 1.13 | **CRUD check**: AI tool calls are stateless; no persistent resource — OK | - | - | - | - | - | - | - | - | - | |
| 1.14 | **Operation flow**: user opens chat → WebSocket connect → send message → receive structured reply → action (book/QR/budget) | - | - | - | - | - | - | - | - | - | |
| 1.15 | **Production**: WebSocket rate limit, concurrent connection limit, heartbeat/ping documented | - | - | - | - | - | - | - | - | - | |
| 1.16 | **Production**: AI tool endpoints have idempotency key support | - | - | - | - | - | - | - | - | - | |
| 1.17 | Cross-check: `/ai-tools/bookings` schema aligned with `my-trip` bookings | - | - | - | - | - | - | - | - | - | |
| 1.18 | Cross-check: `/ai-tools/payments/qr` aligned with `payments` QR endpoint | - | - | - | - | - | - | - | - | - | |
| 1.19 | Cross-check: `/ai-tools/budget/estimate` aligned with `budget-planner` | - | - | - | - | - | - | - | - | - | |

### 02 — Trip Discovery & Smart Suggestions (`trip-discovery/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 2.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 2.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 2.3 | Pagination params (`page`, `limit`) consistent with other list endpoints | - | - | - | - | - | - | - | - | - | |
| 2.4 | `limit` maximum enforced (50) | - | - | - | - | - | - | - | - | - | |
| 2.5 | `sort` enum values documented and consistent | - | - | - | - | - | - | - | - | - | |
| 2.6 | `Accept-Language` header parameter defined and referenced correctly | - | - | - | - | - | - | - | - | - | |
| 2.7 | `TripDetail` schema includes all planned fields | - | - | - | - | - | - | - | - | - | |
| 2.8 | Review endpoint (`POST /trips/{tripId}/reviews`) has correct auth | - | - | - | - | - | - | - | - | - | |
| 2.9 | Search endpoint (`GET /search`) `type` enum covers all catalog types | - | - | - | - | - | - | - | - | - | |
| 2.10 | **Functional requirements**: all user stories in `requirements.md` have matching endpoints | - | - | - | - | - | - | - | - | - | |
| 2.11 | **NFRs documented**: search response < 500ms, cache TTL, max results per type | - | - | - | - | - | - | - | - | - | |
| 2.12 | **CRUD check: Trips** — Create (admin), Read (list + detail by slug), Update (admin), Delete (admin) | - | - | - | - | - | - | - | - | - | |
| 2.13 | **CRUD check: Reviews** — Create (POST), Read (GET list), Update (PATCH?), Delete (DELETE?) | - | - | - | - | - | - | - | - | - | |
| 2.14 | **CRUD check: Favorites** — Create (POST), Read (GET list), Delete (DELETE) — missing Update? | - | - | - | - | - | - | - | - | - | |
| 2.15 | **Operation flow**: browse trips → filter/sort → view detail → view related → read reviews → add favorite | - | - | - | - | - | - | - | - | - | |
| 2.16 | **Production**: search endpoint has rate limit, caching strategy, CDN for images | - | - | - | - | - | - | - | - | - | |
| 2.17 | Favorites endpoints auth and path consistency with `profile` module | - | - | - | - | - | - | - | - | - | |
| 2.18 | Cross-check: `TripSummary` schema fields aligned with `ai-chat` search results | - | - | - | - | - | - | - | - | - | |

### 03 — Transportation Booking (`transportation/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 3.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 3.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 3.3 | Vehicle `type` enum matches `admin` vehicle category enum | - | - | - | - | - | - | - | - | - | |
| 3.4 | Availability endpoint query params (`start_date`, `end_date`) consistent with `hotel-booking` | - | - | - | - | - | - | - | - | - | |
| 3.5 | Price fields use `number` with `nullable: true` where applicable | - | - | - | - | - | - | - | - | - | |
| 3.6 | `status` enum (`ACTIVE`, `INACTIVE`) documented | - | - | - | - | - | - | - | - | - | |
| 3.7 | **Functional requirements**: booking flow requirements mapped to endpoints | - | - | - | - | - | - | - | - | - | |
| 3.8 | **NFRs documented**: availability check < 200ms, concurrent booking lock | - | - | - | - | - | - | - | - | - | |
| 3.9 | **CRUD check: Vehicles** — Read (list + detail + availability) only; no public Create/Update/Delete | - | - | - | - | - | - | - | - | - | |
| 3.10 | **CRUD check: Bookings** — Create (POST), Read (GET list + detail), Update (PATCH status?), Delete (cancel?) — **MISSING** | - | - | - | - | - | - | - | - | - | |
| 3.11 | **Operation flow**: search vehicles → check availability → select → create booking → payment → confirmation | - | - | - | - | - | - | - | - | - | |
| 3.12 | **Production**: booking creation is idempotent (idempotency key), overbooking prevention | - | - | - | - | - | - | - | - | - | |
| 3.13 | Missing: booking creation endpoints? (only listing/detail now) | - | - | - | - | - | - | - | - | - | |
| 3.14 | Cross-check: vehicle schema aligned with `admin` `VehicleBrief` | - | - | - | - | - | - | - | - | - | |

### 04 — Hotel Booking (`hotel-booking/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 4.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 4.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 4.3 | `star_rating` min/max constraints (1–5) | - | - | - | - | - | - | - | - | - | |
| 4.4 | `amenities` array parameter style (`form`, `explode: true`) correct | - | - | - | - | - | - | - | - | - | |
| 4.5 | Availability endpoint path (`/hotels/{hotelId}/rooms/{roomId}/availability`) is clear | - | - | - | - | - | - | - | - | - | |
| 4.6 | `HotelDetail` uses `allOf` correctly for composition | - | - | - | - | - | - | - | - | - | |
| 4.7 | **Functional requirements**: all booking scenarios (hold, confirm, cancel) mapped | - | - | - | - | - | - | - | - | - | |
| 4.8 | **NFRs documented**: room availability cache TTL, overbooking protection | - | - | - | - | - | - | - | - | - | |
| 4.9 | **CRUD check: Hotels** — Read (list + detail) only public; Create/Update/Delete admin-only | - | - | - | - | - | - | - | - | - | |
| 4.10 | **CRUD check: Rooms** — Read (within hotel detail + availability); no public room CRUD | - | - | - | - | - | - | - | - | - | |
| 4.11 | **CRUD check: Bookings** — Create (POST), Read (GET), Update (PATCH dates?), Delete (cancel?) — **MISSING** | - | - | - | - | - | - | - | - | - | |
| 4.12 | **Operation flow**: search hotels → filter → view detail → check room availability → select room → create booking → payment | - | - | - | - | - | - | - | - | - | |
| 4.13 | **Production**: room hold TTL (e.g., 15 min), idempotency on booking creation | - | - | - | - | - | - | - | - | - | |
| 4.14 | Missing: actual booking creation/checkout flow? | - | - | - | - | - | - | - | - | - | |
| 4.15 | Cross-check: hotel/room schemas aligned with `admin` `CreateHotelDto`/`CreateRoomDto` | - | - | - | - | - | - | - | - | - | |

### 05 — Tour Guide Booking (`tour-guide/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 5.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 5.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 5.3 | `language` query enum (`EN`, `ZH`, `KM`) uppercase; check consistency with `profile` (`EN/ZH/KM`) | - | - | - | - | - | - | - | - | - | |
| 5.4 | `specialty` enum values (`Temples`, `Nature`, `Food`, `History`, `Adventure`) documented | - | - | - | - | - | - | - | - | - | |
| 5.5 | `gender` enum includes `PreferNotToSay` | - | - | - | - | - | - | - | - | - | |
| 5.6 | **Functional requirements**: guide booking scenarios mapped | - | - | - | - | - | - | - | - | - | |
| 5.7 | **NFRs documented**: availability check SLA, guide assignment logic | - | - | - | - | - | - | - | - | - | |
| 5.8 | **CRUD check: Guides** — Read (list + detail + availability) only public | - | - | - | - | - | - | - | - | - | |
| 5.9 | **CRUD check: Bookings** — Create, Read, Update, Delete — **MISSING** | - | - | - | - | - | - | - | - | - | |
| 5.10 | **Operation flow**: search guides → filter by language/specialty → view profile → check availability → book guide → payment | - | - | - | - | - | - | - | - | - | |
| 5.11 | **Production**: guide booking conflict detection, calendar sync | - | - | - | - | - | - | - | - | - | |
| 5.12 | Missing: booking creation endpoints? | - | - | - | - | - | - | - | - | - | |
| 5.13 | Cross-check: `GuideDetail` schema aligned with `admin` `CreateGuideDto` | - | - | - | - | - | - | - | - | - | |

### 06 — Explore — Historical Places (`explore-places/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 6.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 6.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 6.3 | All endpoints present and documented | - | - | - | - | - | - | - | - | - | |
| 6.4 | **Functional requirements**: place discovery, detail, navigation requirements mapped | - | - | - | - | - | - | - | - | - | |
| 6.5 | **NFRs documented**: map tile caching, geo-query performance | - | - | - | - | - | - | - | - | - | |
| 6.6 | **CRUD check: Places** — Create (admin), Read (list + detail), Update (admin), Delete (admin) | - | - | - | - | - | - | - | - | - | |
| 6.7 | **Operation flow**: browse map → filter places → view place detail → get directions → save to trip | - | - | - | - | - | - | - | - | - | |
| 6.8 | **Production**: geo-spatial indexing, image CDN, mobile bandwidth optimization | - | - | - | - | - | - | - | - | - | |
| 6.9 | Place schema fields consistent with `trip-discovery` search results | - | - | - | - | - | - | - | - | - | |
| 6.10 | Cross-check: integration with `offline-maps` for place coordinates | - | - | - | - | - | - | - | - | - | |

### 07 — Festival Calendar & Event Alerts (`festivals/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 7.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 7.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 7.3 | Date range query params follow ISO 8601 (`date` format) | - | - | - | - | - | - | - | - | - | |
| 7.4 | Alert/subscription endpoints have correct auth | - | - | - | - | - | - | - | - | - | |
| 7.5 | **Functional requirements**: festival browsing, alerts, calendar sync mapped | - | - | - | - | - | - | - | - | - | |
| 7.6 | **NFRs documented**: push notification latency, calendar feed generation | - | - | - | - | - | - | - | - | - | |
| 7.7 | **CRUD check: Festivals** — Create (admin), Read (list + detail), Update (admin), Delete (admin) | - | - | - | - | - | - | - | - | - | |
| 7.8 | **CRUD check: Alerts/Subscriptions** — Create (subscribe), Read (list), Delete (unsubscribe) | - | - | - | - | - | - | - | - | - | |
| 7.9 | **Operation flow**: view calendar → filter by date/location → view festival detail → subscribe to alert → receive push notification | - | - | - | - | - | - | - | - | - | |
| 7.10 | **Production**: recurring festival data, timezone handling (Asia/Phnom_Penh) | - | - | - | - | - | - | - | - | - | |
| 7.11 | Cross-check: festival data schema aligned with `trip-discovery` category enums | - | - | - | - | - | - | - | - | - | |

### 08 — Payment & Checkout (`payments/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 8.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 8.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 8.3 | `payment_method` enum (`STRIPE_CARD`, `STRIPE_QR`) vs `Payment.status` enum (`BAKONG_QR`, `ABA_QR`) — inconsistency check | - | - | - | - | - | - | - | - | - | |
| 8.4 | `currency` enum (`USD`, `KHR`, `CNY`) documented | - | - | - | - | - | - | - | - | - | |
| 8.5 | `/payments/qr` and `/payments/{id}/status` auth via `bearerAuth` | - | - | - | - | - | - | - | - | - | |
| 8.6 | `/webhooks/stripe` has **no** `bearerAuth`; verify webhook signature handling described | - | - | - | - | - | - | - | - | - | |
| 8.7 | `/discount-codes/validate` accessible without auth (public endpoint) | - | - | - | - | - | - | - | - | - | |
| 8.8 | Refund endpoint (`/payments/{id}/refund`) requires admin or automated auth scope | - | - | - | - | - | - | - | - | - | |
| 8.9 | `CreatePaymentIntentRequest` schema: `loyalty_points_to_redeem` minimum=0 | - | - | - | - | - | - | - | - | - | |
| 8.10 | **Functional requirements**: all payment flows (card, QR, refund, discount) mapped | - | - | - | - | - | - | - | - | - | |
| 8.11 | **NFRs documented**: payment timeout (e.g., QR expiry 5 min), webhook retry policy, idempotency | - | - | - | - | - | - | - | - | - | |
| 8.12 | **CRUD check: Payments** — Create (intent), Read (status), Update (refund), no Delete (immutable) | - | - | - | - | - | - | - | - | - | |
| 8.13 | **CRUD check: Discount codes** — Read (validate) only public; full CRUD in admin | - | - | - | - | - | - | - | - | - | |
| 8.14 | **Operation flow**: create booking → create payment intent → client confirms → Stripe webhook → update status → OR generate QR → scan → confirm | - | - | - | - | - | - | - | - | - | |
| 8.15 | **Production**: Stripe signature verification, webhook idempotency, PCI-DSS scope minimization | - | - | - | - | - | - | - | - | - | |
| 8.16 | **Production**: rate limit on payment intent (3/min/user), refund audit trail | - | - | - | - | - | - | - | - | - | |
| 8.17 | Cross-check: QR response schema aligned with `ai-chat` `/ai-tools/payments/qr` | - | - | - | - | - | - | - | - | - | |
| 8.18 | Cross-check: discount code schema aligned with `admin` `/admin/discounts` | - | - | - | - | - | - | - | - | - | |

### 09 — Emergency & Safety System (`emergency/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 9.1 | OpenAPI syntax valid | x | x | x | x | x | x | x | x | x | |
| 9.2 | **Every endpoint has a `description` field** | x | x | x | x | x | x | x | x | x | Fixed: added descriptions to all 8 endpoints |
| 9.3 | `alert_type` enum (`SOS`, `MEDICAL`, `THEFT`, `LOST`) consistent with `admin` emergency enum | x | x | x | x | x | x | x | x | x | Aligned with admin line 668 |
| 9.4 | Admin endpoints (`/emergency/alerts/{id}/acknowledge`, `/resolve`) use `bearerAuth` | x | x | x | x | x | x | x | x | x | |
| 9.5 | Location sharing (`GET /location-shares/{token}`) is **public** (no auth) | x | x | x | x | x | x | x | x | x | |
| 9.6 | `expires_in_hours` enum (`24`, `72`) documented | x | x | x | x | x | x | x | x | x | |
| 9.7 | Emergency contacts endpoint (`GET /emergency/contacts`) is public | x | x | x | x | x | x | x | x | x | |
| 9.8 | `notes` maxLength (500) on alert creation | x | x | x | x | x | x | x | x | x | |
| 9.9 | **Functional requirements**: SOS, location sharing, emergency contacts all mapped | x | x | x | x | x | x | x | x | x | |
| 9.10 | **NFRs documented**: alert delivery < 5s, 24/7 monitoring SLA, location accuracy | x | x | x | x | x | x | x | x | x | Added to architecture.md and api.yaml x-nfr extensions |
| 9.11 | **CRUD check: Alerts** — Create (POST SOS), Read (GET status), Update (acknowledge/resolve), no Delete (retained for audit) | x | x | x | x | x | x | x | x | x | |
| 9.12 | **CRUD check: Location Shares** — Create (POST), Read (GET public), Delete (revoke) | x | x | x | x | x | x | x | x | x | |
| 9.13 | **Operation flow**: trigger SOS → alert sent → admin notified → acknowledge → resolve → OR share location → recipient views → revoke | x | x | x | x | x | x | x | x | x | Documented in architecture.md |
| 9.14 | **Production**: alert retry mechanism, escalation path, GDPR/privacy for location data | x | x | x | x | x | x | x | x | x | Added retry strategy and GDPR/privacy sections to architecture.md |
| 9.15 | Cross-check: emergency alert schema aligned with `admin` `/admin/emergency` | x | x | x | x | x | x | x | x | x | `alert_type` enums match; admin status enum intentionally excludes ESCALATED (system-set only) |

### 10 — Student Discount Verification (`student-discount/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 10.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 10.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 10.3 | Upload endpoint accepts image (multipart/form-data) | - | - | - | - | - | - | - | - | - | |
| 10.4 | File size and format constraints documented | - | - | - | - | - | - | - | - | - | |
| 10.5 | Status enum (`NONE`, `PENDING`, `VERIFIED`, `REJECTED`) consistent with `profile` `student_status` | - | - | - | - | - | - | - | - | - | |
| 10.6 | **Functional requirements**: upload, review, apply discount mapped | - | - | - | - | - | - | - | - | - | |
| 10.7 | **NFRs documented**: image storage (Supabase Storage), OCR processing time, verification SLA | - | - | - | - | - | - | - | - | - | |
| 10.8 | **CRUD check: Verifications** — Create (upload), Read (GET status), Update (admin review), no Delete (audit) | - | - | - | - | - | - | - | - | - | |
| 10.9 | **Operation flow**: user uploads ID → system validates format → admin reviews → status updated → discount auto-applied at checkout | - | - | - | - | - | - | - | - | - | |
| 10.10 | **Production**: image virus scan, PII masking, retention policy, fraud detection | - | - | - | - | - | - | - | - | - | |
| 10.11 | Cross-check: admin review endpoint aligned with `admin` `/admin/student-verifications` | - | - | - | - | - | - | - | - | - | |

### 11 — Loyalty & Bonus Points (`loyalty/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 11.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 11.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 11.3 | Points balance endpoint auth | - | - | - | - | - | - | - | - | - | |
| 11.4 | Transaction history pagination | - | - | - | - | - | - | - | - | - | |
| 11.5 | **Functional requirements**: earn, redeem, view balance, view history mapped | - | - | - | - | - | - | - | - | - | |
| 11.6 | **NFRs documented**: points calculation consistency, transaction audit trail, concurrency | - | - | - | - | - | - | - | - | - | |
| 11.7 | **CRUD check: Transactions** — Create (earn/redeem, system-generated), Read (list), no Update/Delete (immutable ledger) | - | - | - | - | - | - | - | - | - | |
| 11.8 | **Operation flow**: complete booking → earn points → view balance → redeem at checkout → transaction recorded | - | - | - | - | - | - | - | - | - | |
| 11.9 | **Production**: double-spend prevention, points expiry, ACID transactions | - | - | - | - | - | - | - | - | - | |
| 11.10 | Cross-check: loyalty transaction schema aligned with `admin` `/admin/loyalty` | - | - | - | - | - | - | - | - | - | |

### 12 — Offline Maps (`offline-maps/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 12.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 12.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 12.3 | Tile/download endpoints documented | - | - | - | - | - | - | - | - | - | |
| 12.4 | Region/bounding-box parameters use correct format | - | - | - | - | - | - | - | - | - | |
| 12.5 | **Functional requirements**: offline download, cache management, region selection mapped | - | - | - | - | - | - | - | - | - | |
| 12.6 | **NFRs documented**: download size limit, storage quota, bandwidth optimization | - | - | - | - | - | - | - | - | - | |
| 12.7 | **CRUD check: Offline Regions** — Create (download), Read (list downloaded), Delete (remove), Update (refresh) | - | - | - | - | - | - | - | - | - | |
| 12.8 | **Operation flow**: select region → download tiles → store locally → use offline → update when online | - | - | - | - | - | - | - | - | - | |
| 12.9 | **Production**: tile CDN, incremental updates, storage cleanup, battery-aware download | - | - | - | - | - | - | - | - | - | |
| 12.10 | Cross-check: coordinate schema consistent with `explore-places` | - | - | - | - | - | - | - | - | - | |

### 13 — Multi-Language Support (`multilanguage/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 13.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 13.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 13.3 | Translation endpoint(s) documented | - | - | - | - | - | - | - | - | - | |
| 13.4 | Locale enum (`en`, `zh`, `km`) consistent across all modules | - | - | - | - | - | - | - | - | - | |
| 13.5 | **Functional requirements**: translation, fallback, locale switch mapped | - | - | - | - | - | - | - | - | - | |
| 13.6 | **NFRs documented**: translation cache, RTL support (if needed), locale detection | - | - | - | - | - | - | - | - | - | |
| 13.7 | **CRUD check: Translations** — Read only (GET by key/locale); updates via admin/CMS | - | - | - | - | - | - | - | - | - | |
| 13.8 | **Operation flow**: app starts → detect locale → load translations → user switches language → hot reload | - | - | - | - | - | - | - | - | - | |
| 13.9 | **Production**: CDN for translation files, versioned bundles, missing key fallback | - | - | - | - | - | - | - | - | - | |
| 13.10 | Cross-check: fallback language strategy described | - | - | - | - | - | - | - | - | - | |

### 14 — AI Budget Planner (`budget-planner/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 14.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 14.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 14.3 | Budget estimate endpoint schema complete | - | - | - | - | - | - | - | - | - | |
| 14.4 | **Functional requirements**: budget estimation, breakdown, currency conversion mapped | - | - | - | - | - | - | - | - | - | |
| 14.5 | **NFRs documented**: estimation response time, price data freshness, currency rate TTL | - | - | - | - | - | - | - | - | - | |
| 14.6 | **CRUD check**: budget is computed on-demand — no persistent resource; stateless OK | - | - | - | - | - | - | - | - | - | |
| 14.7 | **Operation flow**: enter trip details → AI estimates budget → view breakdown → adjust parameters → save to trip | - | - | - | - | - | - | - | - | - | |
| 14.8 | **Production**: cache budget estimates, rate limit AI calls, fallback pricing data | - | - | - | - | - | - | - | - | - | |
| 14.9 | Cross-check: aligned with `ai-chat` `/ai-tools/budget/estimate` | - | - | - | - | - | - | - | - | - | |

### 15 — My Trip — Booking Management (`my-trip/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 15.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 15.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 15.3 | Booking list endpoint auth and pagination | - | - | - | - | - | - | - | - | - | |
| 15.4 | Booking detail endpoint returns full payment history | - | - | - | - | - | - | - | - | - | |
| 15.5 | Cancel endpoint documented with refund policy | - | - | - | - | - | - | - | - | - | |
| 15.6 | **Functional requirements**: view bookings, cancel, reschedule, view history mapped | - | - | - | - | - | - | - | - | - | |
| 15.7 | **NFRs documented**: booking list load time, real-time status updates | - | - | - | - | - | - | - | - | - | |
| 15.8 | **CRUD check: Bookings** — Create (via `ai-chat` or checkout), Read (list + detail), Update (reschedule?), Delete (cancel) | - | - | - | - | - | - | - | - | - | |
| 15.9 | **Operation flow**: view my trips → select booking → view details → cancel/reschedule → view refund status | - | - | - | - | - | - | - | - | - | |
| 15.10 | **Production**: booking status real-time sync, cancellation deadline enforcement, refund async processing | - | - | - | - | - | - | - | - | - | |
| 15.11 | Cross-check: booking schema aligned with `admin` `/admin/bookings` | - | - | - | - | - | - | - | - | - | |
| 15.12 | Cross-check: booking creation aligned with `ai-chat` `/ai-tools/bookings` | - | - | - | - | - | - | - | - | - | |

### 16 — User Profile & Account Settings (`profile/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 16.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 16.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 16.3 | Auth endpoints (`/auth/*`) all documented | - | - | - | - | - | - | - | - | - | |
| 16.4 | `Set-Cookie` header documented for `/auth/login`, `/auth/google/callback`, `/auth/refresh` | - | - | - | - | - | - | - | - | - | |
| 16.5 | `Clear-Cookie` header documented for `/auth/logout` | - | - | - | - | - | - | - | - | - | |
| 16.6 | `RegisterRequest` password constraints match implementation plan | - | - | - | - | - | - | - | - | - | |
| 16.7 | `LoginResponse` includes `expiresIn` (seconds) | - | - | - | - | - | - | - | - | - | |
| 16.8 | `User` schema includes `student_status` and `loyalty_balance` | - | - | - | - | - | - | - | - | - | |
| 16.9 | Profile update supports both JSON and multipart (avatar upload) | - | - | - | - | - | - | - | - | - | |
| 16.10 | `phone` pattern (`^\+[1-9]\d{1,14}$`) is E.164 | - | - | - | - | - | - | - | - | - | |
| 16.11 | `preferred_language` enum (`EN`, `ZH`, `KM`) uppercase; check consistency with `trip-discovery` `Accept-Language` (lowercase `en/zh/km`) | - | - | - | - | - | - | - | - | - | |
| 16.12 | **Functional requirements**: auth (register, login, OAuth, refresh, logout, forgot/reset), profile CRUD mapped | - | - | - | - | - | - | - | - | - | |
| 16.13 | **NFRs documented**: JWT expiry (access 15min, refresh 7d), rate limits (auth 5/5min/IP), account lockout | - | - | - | - | - | - | - | - | - | |
| 16.14 | **CRUD check: Users** — Create (register), Read (`/users/me`), Update (PATCH profile), Delete (deactivate account?) | - | - | - | - | - | - | - | - | - | |
| 16.15 | **CRUD check: Sessions** — Create (login), Read (validate), Delete (logout), Refresh (rotate) | - | - | - | - | - | - | - | - | - | |
| 16.16 | **Operation flow**: register → verify email → login → access app → update profile → logout → forgot password → reset | - | - | - | - | - | - | - | - | - | |
| 16.17 | **Production**: password hashing (bcrypt/Argon2), refresh token rotation, brute-force protection, email verification | - | - | - | - | - | - | - | - | - | |
| 16.18 | Cross-check: `User` schema fields aligned with `admin` customer endpoints | - | - | - | - | - | - | - | - | - | |

### 17 — Admin Dashboard (`admin/`)

| # | Task | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | Notes |
|---|------|----|----|----|----|----|----|----|----|----|-------|
| 17.1 | OpenAPI syntax valid | - | - | - | - | - | - | - | - | - | |
| 17.2 | **Every endpoint has a `description` field** | - | - | - | - | - | - | - | - | - | |
| 17.3 | OpenAPI version is `3.1.0` (others use `3.0.3`) — decide on single version | - | - | - | - | - | - | - | - | - | |
| 17.4 | All paths prefixed with `/admin/` | - | - | - | - | - | - | - | - | - | |
| 17.5 | Global `security: bearerAuth` applied; exceptions (Telegram webhook) override correctly | - | - | - | - | - | - | - | - | - | |
| 17.6 | Dashboard composition pattern documented (parallel small endpoints) | - | - | - | - | - | - | - | - | - | |
| 17.7 | Count endpoints (`/count`, `/today-count`, `/today-revenue`) return minimal shapes | - | - | - | - | - | - | - | - | - | |
| 17.8 | `DataEnvelope` schema used consistently | - | - | - | - | - | - | - | - | - | |
| 17.9 | `PaginationMeta` includes `totalPages` | - | - | - | - | - | - | - | - | - | |
| 17.10 | SUPER_ADMIN-only endpoints tagged and described | - | - | - | - | - | - | - | - | - | |
| 17.11 | `webhookSecret` security scheme for `/telegram/driver-status` | - | - | - | - | - | - | - | - | - | |
| 17.12 | Driver `status` enum (`AVAILABLE`, `BUSY`, `OFFLINE`) consistent with `transportation` | - | - | - | - | - | - | - | - | - | |
| 17.13 | Vehicle `category`/`tier` enums consistent with `transportation` | - | - | - | - | - | - | - | - | - | |
| 17.14 | **Functional requirements**: all admin operations (CRUD, stats, export, audit) mapped | - | - | - | - | - | - | - | - | - | |
| 17.15 | **NFRs documented**: admin API rate limits, export size limits, audit log retention | - | - | - | - | - | - | - | - | - | |
| 17.16 | **CRUD check: Drivers** — full CRUD + count | - | - | - | - | - | - | - | - | - | |
| 17.17 | **CRUD check: Vehicles** — full CRUD | - | - | - | - | - | - | - | - | - | |
| 17.18 | **CRUD check: Maintenance** — full CRUD | - | - | - | - | - | - | - | - | - | |
| 17.19 | **CRUD check: Assignments** — Create, Read, Update (complete) | - | - | - | - | - | - | - | - | - | |
| 17.20 | **CRUD check: Bookings** — Read (list + detail), Update (patch), Delete (cancel) | - | - | - | - | - | - | - | - | - | |
| 17.21 | **CRUD check: Hotels** — full CRUD + rooms | - | - | - | - | - | - | - | - | - | |
| 17.22 | **CRUD check: Guides** — full CRUD | - | - | - | - | - | - | - | - | - | |
| 17.23 | **CRUD check: Emergency Alerts** — Read, Update (acknowledge/resolve) | - | - | - | - | - | - | - | - | - | |
| 17.24 | **CRUD check: Customers** — Read only | - | - | - | - | - | - | - | - | - | |
| 17.25 | **CRUD check: Discounts** — full CRUD | - | - | - | - | - | - | - | - | - | |
| 17.26 | **CRUD check: Student Verifications** — Read, Update (review) | - | - | - | - | - | - | - | - | - | |
| 17.27 | **CRUD check: Loyalty** — Create (adjust), Read (history) | - | - | - | - | - | - | - | - | - | |
| 17.28 | **CRUD check: Admin Users** — full CRUD | - | - | - | - | - | - | - | - | - | |
| 17.29 | **CRUD check: Audit Logs** — Read, Export | - | - | - | - | - | - | - | - | - | |
| 17.30 | **CRUD check: Backups** — Create (trigger), Read (list) | - | - | - | - | - | - | - | - | - | |
| 17.31 | **Operation flow**: login as admin → view dashboard KPIs → manage bookings → assign driver → resolve emergency → export data | - | - | - | - | - | - | - | - | - | |
| 17.32 | **Production**: role-based access control (RBAC), audit logging on all mutations, export encryption, backup retention | - | - | - | - | - | - | - | - | - | |
| 17.33 | Cross-check: all admin DTOs aligned with public module schemas | - | - | - | - | - | - | - | - | - | |

---

## Cross-Cutting Validation Tasks

These must be completed after all per-module tasks are done.

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| CC-1 | Standardize on single OpenAPI version (3.0.3 vs 3.1.0) | - | - | `admin` uses 3.1.0; all others 3.0.3 |
| CC-2 | Unify locale/language enum casing (`en/zh/km` vs `EN/ZH/KM`) | - | - | `Accept-Language` header uses lowercase; schema enums vary |
| CC-3 | Verify no duplicate or conflicting path definitions across modules | - | - | e.g. `/search` only in `trip-discovery` |
| CC-4 | Verify shared schema definitions (User, Booking, Payment) are identical where they overlap | - | - | |
| CC-5 | Confirm all `bearerAuth` definitions are identical across files | - | - | |
| CC-6 | Confirm all `AcceptLanguage` parameter definitions are identical | - | - | |
| CC-7 | Audit all `required` arrays for completeness | - | - | Some response schemas missing `success` in `required` |
| CC-8 | Verify HTTP status codes are complete per endpoint | - | - | Many endpoints only document 200/201; missing 400/401/404/500 |
| CC-9 | Run full spec bundle through Swagger UI / Redocly validator | - | - | |
| CC-10 | Produce merged single-file OpenAPI spec for client generation | - | - | |
| CC-11 | **Every endpoint in every module has a `description` field** | - | - | Not just `summary`; describe behavior, side effects, business rules |
| CC-12 | **All modules have `requirements.md` and endpoints map to user stories** | - | - | |
| CC-13 | **All modules define NFRs: response time SLA, availability target, rate limits** | - | - | |
| CC-14 | **All booking-related modules have complete CRUD + full operation flows** | - | - | `transportation`, `hotel-booking`, `tour-guide` missing booking endpoints |
| CC-15 | **All state-changing endpoints specify idempotency key support** | - | - | `Idempotency-Key` header for POST/PATCH |
| CC-16 | **All modules define caching strategy** | - | - | Cache TTL, invalidation rules, CDN usage |
| CC-17 | **All modules define observability: logging, metrics, alerting** | - | - | |
| CC-18 | **All modules define error handling: retry strategy, circuit breaker, fallback** | - | - | |
| CC-19 | **API versioning strategy documented** | - | - | URL path (`/v1/`) vs header vs content negotiation |
| CC-20 | **Backward compatibility policy documented** | - | - | Deprecation notices, sunset dates, breaking change process |

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Total modules | 17 |
| Total validation tasks | ~260 |
| Phase 1 (Structural) tasks | ~17 |
| Phase 2 (Design Quality) tasks | ~17 |
| Phase 3 (Security) tasks | ~17 |
| Phase 4 (Integration) tasks | ~17 |
| Phase 5 (Functional/NFR) tasks | ~17 |
| Phase 6 (CRUD Completeness) tasks | ~17 |
| Phase 7 (Operation Flows) tasks | ~17 |
| Phase 8 (Production Standards) tasks | ~17 |
| Phase 9 (Sign-off) tasks | 17 |
| Cross-cutting tasks | 20 |

---

## How to Use This Roadmap

1. **Pick a module** and run through its checklist top to bottom.
2. **Update the status columns** (`-` → `~` → `x`) as you work.
3. **Add notes** for anything blocking or requiring a decision.
4. **Complete all P1–P8** before moving a module to P9 sign-off.
5. **File issues** for any spec changes needed; link them in the Notes column.
6. **For P5 (Requirements)**: open the module's `requirements.md` and verify every user story has at least one endpoint.
7. **For P6 (CRUD)**: for each domain entity, confirm Create, Read, Update, Delete operations exist where applicable.
8. **For P7 (Flows)**: write a short sequence diagram or numbered step list in the module's `architecture.md`.
9. **For P8 (Production)**: add NFR annotations to `api.yaml` (use `x-nfr-*` extensions or document in `architecture.md`).
