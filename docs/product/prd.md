# DerLg — Product Requirements Document

> **Version:** 1.0  
> **Last Updated:** 2026-05-09  
> **Status:** Living document — aligned with `.kiro/specs/`, `feature-decisions.md`, and `architecture.md`

---

## 1. Product Overview

**DerLg** is a Cambodia travel booking platform with an AI-powered travel concierge. The platform serves tourists (English, Chinese, Khmer speakers) visiting Cambodia, providing trip planning, transportation, hotels, tour guides, and emergency services.

**Unique Value Proposition:** Mobile-first PWA that combines traditional booking with conversational AI to help travelers discover, plan, and book complete Cambodia trips through natural language chat — aka **"Vibe Booking"**.

---

## 2. Product Vision

> *"Make Cambodia travel booking as easy as texting a friend who knows every temple, tuk-tuk driver, and hidden beach."*

DerLg combines traditional travel-booking inventory with an AI concierge that lowers the barrier for non-English speakers and reduces decision fatigue. Unlike generic OTAs (Booking.com, Agoda), DerLg wins on experience, not inventory size.

---

## 3. Business Model

- **Commission-based** on confirmed bookings (transportation, hotels, guides)
- **Premium loyalty tiers** with enhanced benefits
- **Student segment** acquisition via verified discount program

---

## 4. Goals & Objectives

| Goal | Success Criteria |
|------|-----------------|
| Reduce time to first booking | < 5 minutes for returning users |
| Drive AI chat conversion | > 15% of chat sessions end in a booking |
| Maximize mobile engagement | > 30% of mobile users install the PWA |
| Ensure booking completion | > 60% of initiated bookings are paid |
| Guarantee safety response | < 2 minutes emergency alert acknowledgment |
| Capture student segment | > 500 verified student sign-ups in first 3 months |
| Build trust via reviews | > 4.2 average star rating across all listings |

---

## 5. Target Users

| Segment | Needs | Language |
|---------|-------|----------|
| International tourists | Discover trips, book transport/stays/guides | EN |
| Chinese tourists (primary market) | Mandarin support, trusted payment, QR pay | ZH |
| Students | Verified discounts on bookings | EN/ZH/KM |
| Safety-conscious travelers | Emergency alerts, location sharing | EN/KM |

### Personas

| Persona | Needs | Language | Key Features |
|---------|-------|----------|-------------|
| **Backpacker Ben** (International tourist, 25-35) | Discover trips, compare prices, book on mobile | EN | AI chat, trip discovery, offline maps |
| **WeChat Wendy** (Chinese tourist, 30-45) | Mandarin support, trusted payment, QR pay | ZH | AI chat in Chinese, QR payment, social sharing |
| **Student Srey** (Cambodian / ASEAN student, 18-24) | Budget travel, verified discounts | EN/KM/ZH | Student verification, discount auto-apply |
| **Solo Sarah** (Safety-conscious traveler, 28-40) | Reliable transport, emergency help, location sharing | EN/KM | Emergency SOS, live location sharing, female-friendly guides |

---

## 6. Core Features

1. **AI Travel Concierge** — Conversational booking via WebSocket (LangGraph + Claude)
2. **Transportation Booking** — Tuk-tuk, van, bus reservations
3. **Hotel & Tour Guide Booking** — Accommodation and local expert reservations
4. **Trip Discovery** — Curated packages with smart suggestions
5. **Emergency & Safety System** — GPS-tracked SOS alerts, location sharing
6. **Student Discount Verification** — ID-based discount eligibility
7. **Loyalty Points Program** — Earn/redeem points on bookings
8. **Offline Maps** — Cached OpenStreetMap tiles for offline navigation
9. **Multi-Language Support** — EN / ZH / KM across all content
10. **Festival Calendar** — Cultural events with trip tie-ins

---

## 7. Functional Requirements

### 7.1 Authentication & Identity (F01–F06)

- **F01 — Email/Password Auth:** Registration with email verification, secure login, password reset via Supabase Auth.
- **F02 — Google OAuth:** One-click login via Google to reduce friction.
- **F03 — JWT Session Management:** Access tokens (15 min expiry) + refresh tokens (7 days, httpOnly Secure SameSite=Strict cookies). Token versioning for logout invalidation.
- **F04 — Password Reset:** Self-service flow via email link.
- **F05 — User Profile:** Name, phone, avatar, emergency contact, preferred language. Avatar upload to Supabase Storage (max 5MB).
- **F06 — Role-Based Access Control:** `USER` and `ADMIN` roles. Admin routes protected by authorization guards.

### 7.2 AI Travel Concierge — "Vibe Booking" (F10–F16)

- **F10 — Full-Screen AI Chat:** WebSocket-driven interface to a Python LangGraph + Claude agent. Renders text, trip cards, hotel cards, action buttons, and payment QR codes inline.
- **F11 — AI Trip Suggestions:** Converts user intent ("I want a 3-day temple tour near Siem Reap") into curated trip, hotel, transport, and guide options.
- **F12 — AI-Driven Booking Creation:** Closes the loop — user can confirm a booking without leaving the chat. AI calls backend tool endpoints with service key.
- **F13 — AI Payment QR Generation:** On request, AI generates Bakong/ABA QR codes for Cambodian users.
- **F14 — AI Budget Planner:** Estimates total trip cost (accommodation, transport, meals, entry fees) with min/max range in USD/KHR/CNY.
- **F15 — Persistent Chat History:** Multi-session continuity via local storage + server-side sync.
- **F16 — Auto-Reconnect & Message Queue:** Resilient on Cambodian mobile networks. Exponential backoff reconnection, offline message queuing.

### 7.3 Trip Discovery & Catalog (F20–F26)

- **F20 — Featured Trips Home Screen:** Hero section, category icons, curated trip cards with images, pricing, and duration.
- **F21 — Trip Detail Pages:** Full itinerary (day-by-day), photo gallery with lightbox, included/excluded items, reviews, cancellation policy, meeting point.
- **F22 — Category Filtering:** Temples, Nature, Culture, Adventure, Food.
- **F23 — Search with Autocomplete:** Debounced full-text search across trips, places, hotels, guides.
- **F24 — Reviews & Ratings:** 1-5 stars, text (max 1000 chars), up to 5 photos. Verified-booking badge. 50 loyalty points per review.
- **F25 — Favorites / Wishlist:** Heart toggle on cards. Synced across devices for authenticated users; local storage for guests.
- **F26 — Social Sharing:** Shareable links with Open Graph metadata, QR codes for offline sharing, WeChat/WhatsApp fallback.

### 7.4 Core Booking Engine (F30–F38)

- **F30 — Trip Package Booking:** Multi-day packages with itinerary.
- **F31 — Hotel Room Booking:** Date range selection, room type, occupancy validation.
- **F32 — Transportation Booking:** Van, bus, tuk-tuk. Per-day or per-km pricing.
- **F33 — Tour Guide Booking:** Filter by language, specialty, province. Verified guides only.
- **F34 — Availability & Conflict Detection:** Database transactions with pessimistic locking. Prevents double-booking.
- **F35 — Booking Hold:** 15-minute reservation timer. Redis TTL key. Auto-cancellation on expiry.
- **F36 — Booking Confirmation & QR Check-in:** Unique booking reference (`DLG-YYYY-NNNN`), scannable QR code, shareable itinerary link.
- **F37 — Cancellation & Refund Flow:** Tiered refund policy (100% if ≥7 days, 50% if 1-7 days, 0% if <24 hours).
- **F38 — Booking Itinerary Management (v1.1):** iCal export, driver/guide contact info revealed 24h before departure.

### 7.5 Payments (F40–F47)

- **F40 — Stripe Card Payments:** 3D Secure support. Payment intent created by backend; client secret returned to frontend.
- **F41 — QR Code Payment (Bakong/ABA):** Critical for Cambodian and Chinese markets. QR image generated with expiry matching booking hold.
- **F42 — Payment Receipt (PDF):** Downloadable receipt with itemized costs.
- **F43 — Stripe Webhook Processing:** Idempotent processing via `stripe_event_id` tracking. Signature verification mandatory.
- **F44 — Refund Processing:** Stripe refund creation with tiered amounts. Loyalty points reversed.
- **F45 — Currency Conversion:** USD (default), KHR, CNY. Rates cached in Redis (1h TTL) from ExchangeRate-API.
- **F46 — Discount Code Validation (v1.1):** Single-use or limited-use codes. Non-stackable with other codes; combinable with loyalty points and student discount.
- **F47 — Loyalty Points Redemption at Checkout (v1.1):** 100 points = 1 USD.

### 7.6 Emergency & Safety (F50–F52)

- **F50 — Emergency SOS Alert:** GPS coordinates + alert type (SOS, MEDICAL, THEFT, LOST). Push + SMS to support team. 5-second cancel countdown.
- **F51 — Location Sharing with Family (v1.2):** Unique tracking link with configurable expiry (24h, 3 days, trip duration). Location updates every 5 minutes.
- **F52 — Province-Specific Emergency Contacts:** Police, hospital, fire for all 25 Cambodia provinces.

### 7.7 Loyalty & Student Programs (F60–F64)

- **F60 — Loyalty Points Earning:** 2 points per USD spent on confirmed bookings.
- **F61 — Loyalty Points History:** Transaction ledger (EARNED, REDEEMED, ADJUSTED).
- **F62 — Student Verification (v1.1):** ID card + selfie upload. Admin review queue. Max 10MB per image.
- **F63 — Student Discount Auto-Applied (v1.1):** Verified students see discounted prices automatically at checkout.
- **F64 — Referral Program (v2.0):** Unique referral code. 500 points each to referrer and referee on first completed booking.

### 7.8 Notifications (F70–F73)

- **F70 — Email Confirmations:** Resend SMTP. Multi-language templates.
- **F71 — Push Notifications (FCM):** Booking confirmations, payment status, travel reminders.
- **F72 — Travel Reminders (v1.1):** 24-hour pre-departure notification.
- **F73 — In-App Notification Center (v1.1):** Consolidated inbox with read/unread status.

### 7.9 Explore, Maps & Content (F80–F85)

- **F80 — Places Directory:** Temples, museums, nature, markets, beaches, mountains. GPS coordinates, visitor tips, dress code, entry fees, opening hours.
- **F81 — Festival Calendar (v1.2):** Upcoming cultural events. Auto-generated discount codes during festivals.
- **F82 — Interactive Maps:** Leaflet.js + OpenStreetMap. Markers for places, hotels, emergency services, bookings.
- **F83 — Offline Map Caching (v1.1):** Service Worker caches tiles. Province-based downloadable map packs.
- **F84 — Multi-Language Content:** All content stored with EN/KH/ZH variants. `Accept-Language` header driven.
- **F85 — SEO + Open Graph (v1.1):** SSR for public pages, structured data (JSON-LD), sitemap.xml.

### 7.10 Progressive Web App (F90–F93)

- **F90 — PWA Installable:** Web manifest, standalone display mode, themed icons.
- **F91 — Offline Static Asset Caching:** Cache-first for JS/CSS/images; network-first for API.
- **F92 — Background Sync (v1.1):** Queue bookings and profile updates while offline; sync on reconnect.
- **F93 — Push Permission & Registration:** FCM token registration, permission prompt.

### 7.11 Admin & Operations (F100–F103)

- **F100 — Admin Dashboard (v2.0):** Metrics, bookings, users, revenue charts.
- **F101 — Review Moderation (v2.0):** Flag/remove inappropriate reviews.
- **F102 — Student Verification Review Queue (v1.1):** Approve/reject with reason.
- **F103 — Emergency Alert Management (v1.2):** Real-time alert map, acknowledgment workflow.

---

## 8. Non-Functional Requirements

### 8.1 Performance
- API health check response < 100ms.
- Page load target: Lighthouse Performance > 90.
- API request timeout: 30 seconds.
- Default pagination: 20 items per page.
- Gzip compression for responses > 1KB.

### 8.2 Security
- All secrets in environment variables; never committed.
- Rate limiting: auth endpoints 5 req / 5 min / IP; payment intent 3 req / min / user.
- CORS whitelist: production origins only.
- Input validation via `class-validator` DTOs on every endpoint.
- Prisma parameterized queries (no raw SQL injection risk).
- Stripe webhook signature verification mandatory.
- Supabase RLS enabled on all tables.
- AI agent service key (`X-Service-Key`) required for `/v1/ai-tools/*`.
- AES-256 encryption for sensitive data at rest.
- bcrypt (salt rounds 12) for password hashing.

### 8.3 Reliability
- Database connection retry: 3 times with exponential backoff.
- Webhook retry: exponential backoff with dead-letter queue after 5 failures.
- Notification retry: 3 attempts with fallback from push to email.
- Graceful shutdown on SIGTERM.
- Sentry error tracking + performance monitoring.

### 8.4 Scalability
- Stateless backend architecture for horizontal scaling.
- Redis for distributed rate limiting and pub/sub.
- Database connection pooling (min 10, max 100).
- Full-text search indexes on trips, places, hotels.

### 8.5 Accessibility (a11y)
- Semantic HTML, ARIA labels, keyboard navigation.
- WCAG AA contrast ratios (4.5:1 for normal text).
- Skip-to-content links, focus indicators, screen-reader announcements.

---

## 9. Architecture Overview

```
┌──────────────┐     REST      ┌──────────────┐     Tools     ┌──────────────┐
│  Next.js     │ ◄──────────► │   NestJS     │ ◄──────────► │ Python AI    │
│  (Frontend)  │   (/v1/*)    │  (Backend)   │   (/v1/ai-tools/*) │  (LangGraph) │
│  Port 3000   │              │  Port 3001   │              │              │
└──────────────┘              └──────┬───────┘              └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ Supabase │    │  Redis   │    │  Stripe  │
              │   (PG)   │    │ (Cache)  │    │(Payments)│
              └──────────┘    └──────────┘    └──────────┘
```

**Communication Patterns**
- Frontend ↔ Backend: REST JSON with `{ success, data, message, error }` envelope.
- Frontend ↔ AI Agent: WebSocket for chat; structured message types (text, card, action, qr).
- AI Agent ↔ Backend: REST tool endpoints with service key auth.
- Backend → External: Stripe API, Resend email, FCM push, ExchangeRate-API.

---

## 10. Data Model Summary

| Entity | Purpose |
|--------|---------|
| `users` | Identity, profile, role, language, loyalty balance, student status |
| `trips` | Pre-packaged travel products with itinerary, pricing, translations |
| `places` | Points of interest with GPS, categories, tips, entry fees |
| `hotels` / `hotel_rooms` | Accommodation inventory with amenities, availability |
| `transportation_vehicles` | Van, bus, tuk-tuk with tier, capacity, pricing model |
| `guides` | Tour guide profiles with languages, specialties, verification |
| `bookings` | Reservations with status, holds, cancellation policy, reference |
| `payments` | Stripe intents, QR payments, refunds, webhook tracking |
| `reviews` | Ratings, text, photos, verified badges |
| `festivals` | Cultural events with dates, locations, linked discounts |
| `discount_codes` | Promo codes with usage limits, validity, type restrictions |
| `loyalty_transactions` | Earn/redeem/adjust ledger |
| `emergency_alerts` | SOS records with GPS, type, status, response timeline |
| `student_verifications` | ID uploads, review status, expiry |
| `notifications` | Delivery tracking for email, push, in-app |
| `ai_sessions` | Chat session metadata and history pointers |
| `audit_logs` | Financial and security event log |

All tables use UUID primary keys, `TIMESTAMPTZ`, `DECIMAL(10,2)` for money, `JSONB` for flexible structures, and `TEXT[]` for multi-value fields.

---

## 11. Release Scope

| Phase | Focus | Timeline |
|-------|-------|----------|
| MVP | Auth, booking core, AI chat, payments, PWA | Launch |
| v1.1 | Loyalty, student discount, offline maps | +6 weeks |
| v1.2 | Emergency system, location sharing, festival calendar | +12 weeks |
| v2.0 | Admin dashboard, analytics, referral program | +20 weeks |

### User Stories by Phase

#### MVP (Launch Blocker)
> *Goal: Prove the core loop — discover → chat → book → pay.*

| As a … | I want to … | So that … | AC Ref |
|--------|-------------|-----------|--------|
| Traveler | Register and log in | I can save bookings | F01–F03 |
| Traveler | Chat with AI in my language | I can plan without research fatigue | F10–F12 |
| Traveler | Browse featured trips | I can discover options quickly | F20–F22 |
| Traveler | Book trips, hotels, transport, guides | I can arrange my travel | F30–F33 |
| Traveler | Pay with card or QR | I can confirm my reservation | F40–F41 |
| Traveler | Receive email confirmation | I have proof of booking | F70 |
| Traveler | Install the PWA | It feels like a native app | F90 |
| Admin | Log in with elevated role | I can access protected routes | F06 |

#### v1.1 (Post-Launch: Retention)
> *Goal: Increase repeat bookings and word-of-mouth.*

| As a … | I want to … | So that … | AC Ref |
|--------|-------------|-----------|--------|
| Traveler | Earn loyalty points | I save money on future trips | F60–F61 |
| Student | Verify my student status | I get automatic discounts | F62–F63 |
| Traveler | Use offline maps | I can navigate rural areas | F83 |
| Traveler | Get travel reminders | I don't miss my trip | F72 |
| Traveler | Export itinerary to calendar | I stay organized | F38 |

#### v1.2 (Maturity: Safety & Content)
> *Goal: Build trust and brand depth.*

| As a … | I want to … | So that … | AC Ref |
|--------|-------------|-----------|--------|
| Solo traveler | Send an SOS with my location | I can get emergency help | F50 |
| Traveler | Share live location with family | They know I'm safe | F51 |
| Traveler | See festival calendars | I can plan around cultural events | F81 |
| Traveler | Read and write reviews | I can make informed choices | F24 |

#### v2.0 (Growth: Operations)
> *Goal: Scale the business operationally.*

| As a … | I want to … | So that … | AC Ref |
|--------|-------------|-----------|--------|
| Admin | View metrics dashboard | I can make business decisions | F100 |
| Admin | Moderate reviews | Content quality is maintained | F101 |
| User | Refer friends | We both earn rewards | F64 |

---

## 12. Open Questions & Assumptions

1. **Regulatory:** Emergency SOS feature requires legal review and potential partnership with local Cambodian emergency services before v1.2 launch.
2. **Payment:** Bakong/ABA QR integration may require direct bank partnership; Stripe QR is the fallback MVP solution.
3. **AI Costs:** Claude API usage costs scale with chat volume; monitoring required post-launch.
4. **Content:** Initial trip, hotel, and guide inventory will be manually seeded; self-serve partner portal is deferred post-MVP.
5. **Connectivity:** Offline map caching assumes users will pre-download regions; UX must clearly prompt this.

---

## 13. Document Relationships

| Document | Purpose |
|----------|---------|
| `prd.md` | **This document** — the single source of truth for product requirements |
| `../platform/architecture/system-overview.md` | System architecture, auth flow, payment flow, real-time channels |
| `./feature-decisions.md` | Canonical feature registry with scope, priority, status, owner |
| `../modules/` | Per-feature API specs (`api.yaml`), architecture, and requirements |
| `.kiro/specs/*/requirements.md` | Deep implementation specs for each workstream |

---

*This document is a living document. Update it whenever feature scope, priority, or acceptance criteria change.*
