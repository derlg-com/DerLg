# DerLg — Feature Decisions

> Canonical feature registry. This document answers **"what are we building, in what order, and why"**.  
> Detailed acceptance criteria live in `.kiro/specs/*/requirements.md` — this file does not duplicate them.

---

## Legend

| Field | Values |
|-------|--------|
| **Scope** | `MVP` (launch blocker) \| `v1.1` (post-launch high value) \| `v1.2` (maturity) \| `v2.0` (growth) |
| **Priority** | `P0` (cannot launch without) \| `P1` (high value) \| `P2` (medium) \| `P3` (nice-to-have) |
| **Status** | `Planned` \| `In Progress` \| `Completed` \| `Deferred` \| `Rejected` |
| **Owner** | `FE` (Frontend) \| `BE` (Backend) \| `AI` (Python chatbot) \| `Shared` |

---

## Feature Registry

### Authentication & Identity

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F01 | Email/Password Registration & Login | MVP | P0 | Planned | BE | — | Foundation for all personalized features |
| F02 | Google OAuth Login | MVP | P0 | Planned | BE | F01 | Reduces friction for Chinese/international tourists |
| F03 | JWT Token Refresh (Access + Refresh) | MVP | P0 | Planned | BE | F01 | Secure session management |
| F04 | Password Reset Flow | MVP | P1 | Planned | BE | F01 | Reduces support burden |
| F05 | User Profile Management | MVP | P0 | Planned | Shared | F01 | Name, phone, avatar, emergency contact |
| F06 | Role-Based Access Control (User / Admin) | MVP | P0 | Planned | BE | F01 | Protects admin routes |

### AI Travel Concierge ("Vibe Booking")

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F10 | AI Chat Interface (Full-Screen WebSocket) | MVP | P0 | Planned | Shared | BE WS, AI svc | **Core differentiator**; natural language trip planning |
| F11 | Trip Suggestions via AI | MVP | P0 | Planned | AI | F10, F30 | Converts chat into curated options |
| F12 | AI-Driven Booking Creation | MVP | P0 | Planned | AI+BE | F10, F40 | Close loop: chat → booked without leaving chat |
| F13 | AI Payment QR Generation | MVP | P1 | Planned | AI+BE | F10, F50 | Cambodian users prefer QR; AI can generate on request |
| F14 | AI Budget Planner / Estimator | MVP | P1 | Planned | AI+BE | F10 | Builds trust before commitment |
| F15 | Persistent Chat History (Local + Server) | MVP | P1 | Planned | FE+BE | F10 | Multi-session continuity |
| F16 | Auto-Reconnect & Message Queue | MVP | P1 | Planned | FE+AI | F10 | Resilient UX on spotty Cambodian mobile networks |

### Trip Discovery & Catalog

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F20 | Featured Trips Home Screen | MVP | P0 | Planned | Shared | — | Primary conversion surface |
| F21 | Trip Detail Pages (Itinerary, Gallery, Reviews) | MVP | P0 | Planned | Shared | — | Required for informed purchase |
| F22 | Category Filtering (Temples, Nature, Culture, Adventure, Food) | MVP | P1 | Planned | FE+BE | — | Discovery efficiency |
| F23 | Search with Autocomplete | MVP | P1 | Planned | Shared | — | Power-user path to content |
| F24 | Reviews & Ratings System | MVP | P1 | Planned | Shared | F40 | Social proof drives bookings |
| F25 | Favorites / Wishlist | MVP | P1 | Planned | Shared | F01 | Increases return visits |
| F26 | Social Sharing (Link + QR) | v1.1 | P2 | Planned | FE | — | Organic growth via WeChat/WhatsApp |

### Core Booking Engine

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F30 | Trip Package Booking | MVP | P0 | Planned | Shared | F01 | Core revenue stream |
| F31 | Hotel Room Booking | MVP | P0 | Planned | Shared | F01 | Accommodation is a major spend category |
| F32 | Transportation Booking (Van, Bus, Tuk-Tuk) | MVP | P0 | Planned | Shared | F01 | Essential for Cambodia tourism |
| F33 | Tour Guide Booking | MVP | P0 | Planned | Shared | F01 | High-margin, differentiated service |
| F34 | Availability & Conflict Detection | MVP | P0 | Planned | BE | — | Prevents double-booking; data integrity |
| F35 | Booking Hold (15-min reservation) | MVP | P0 | Planned | BE | F34 | Creates urgency, protects inventory |
| F36 | Booking Confirmation & QR Check-in | MVP | P0 | Planned | Shared | F30–F33 | Operational requirement |
| F37 | Cancellation & Refund Flow | MVP | P0 | Planned | BE | F30–F33 | Legal/trust requirement |
| F38 | Booking Itinerary Management (iCal export) | v1.1 | P1 | Planned | BE | F30–F33 | Increases perceived value |

### Payments

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F40 | Stripe Card Payments | MVP | P0 | Planned | BE+FE | F30–F33 | International tourist standard |
| F41 | QR Code Payment (Bakong/ABA) | MVP | P0 | Planned | BE+FE | F30–F33 | **Critical for Cambodian & Chinese market** |
| F42 | Payment Receipt (PDF) | MVP | P1 | Planned | FE+BE | F40 | Post-purchase trust |
| F43 | Stripe Webhook Processing (Idempotent) | MVP | P0 | Planned | BE | F40 | Source of truth for payment status |
| F44 | Refund Processing (Tiered: 100%/50%/0%) | MVP | P0 | Planned | BE | F37 | Fair cancellation policy |
| F45 | Currency Conversion (USD / KHR / CNY) | MVP | P1 | Planned | BE | F40 | Removes price ambiguity |
| F46 | Discount Code Validation | v1.1 | P1 | Planned | BE | F40 | Marketing campaigns |
| F47 | Loyalty Points Redemption at Checkout | v1.1 | P1 | Planned | BE | F60, F40 | Increases retention |

### Emergency & Safety

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F50 | Emergency SOS Alert (GPS + Type) | v1.2 | P1 | Planned | Shared | — | Safety brand promise; legal/PR protection |
| F51 | Location Sharing with Family | v1.2 | P2 | Planned | BE+FE | F50 | Peace of mind for solo travelers |
| F52 | Province-Specific Emergency Contacts | v1.2 | P1 | Planned | BE | F50 | 25 provinces in Cambodia |

### Loyalty & Student Programs

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F60 | Loyalty Points Earning (2 pts / USD) | v1.1 | P1 | Planned | BE | F40 | Retention mechanic |
| F61 | Loyalty Points History & Balance | v1.1 | P1 | Planned | Shared | F60 | Transparency builds trust |
| F62 | Student Verification (ID Upload + Review) | v1.1 | P1 | Planned | Shared | F01 | Captures student segment |
| F63 | Student Discount Auto-Applied | v1.1 | P1 | Planned | BE | F62, F30–F33 | Frictionless discount experience |
| F64 | Referral Program | v2.0 | P2 | Planned | BE | F01 | Organic acquisition |

### Notifications

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F70 | Email Confirmations (Resend) | MVP | P0 | Planned | BE | F30–F33 | Transactional trust |
| F71 | Push Notifications (FCM) | MVP | P1 | Planned | BE+FE | F30–F33 | Reminders, re-engagement |
| F72 | Travel Reminders (24h before) | v1.1 | P1 | Planned | BE | F71 | Reduces no-shows |
| F73 | In-App Notification Center | v1.1 | P2 | Planned | FE | F71 | Consolidated message inbox |

### Explore, Maps & Content

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F80 | Places Directory (Temples, Museums, Nature, etc.) | MVP | P1 | Planned | Shared | — | Discovery content |
| F81 | Festival Calendar with Alerts | v1.2 | P2 | Planned | Shared | — | Cultural content hook |
| F82 | Interactive Maps (Leaflet + OpenStreetMap) | MVP | P1 | Planned | FE | F80 | Visual trip planning |
| F83 | Offline Map Caching (Service Worker) | v1.1 | P1 | Planned | FE | F82 | Essential for rural Cambodia connectivity |
| F84 | Multi-Language Content (EN / ZH / KM) | MVP | P0 | Planned | Shared | — | Primary market requirement |
| F85 | SEO + Open Graph / Structured Data | v1.1 | P2 | Planned | FE | — | Organic traffic |

### Progressive Web App

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F90 | PWA Installable (Manifest + Service Worker) | MVP | P0 | Planned | FE | — | Mobile-first market; app-like experience without app store |
| F91 | Offline Static Asset Caching | MVP | P1 | Planned | FE | F90 | Resilient UX |
| F92 | Background Sync for Pending Actions | v1.1 | P2 | Planned | FE | F90 | Queue bookings while offline |
| F93 | Push Notification Permission & Registration | MVP | P1 | Planned | FE | F71 | Re-engagement channel |

### Admin & Operations

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F100 | Admin Dashboard (Metrics, Bookings, Users) | v2.0 | P1 | Planned | FE+BE | F06 | Business operations |
| F101 | Review Moderation | v2.0 | P2 | Planned | BE+FE | F24 | Content quality |
| F102 | Student Verification Review Queue | v1.1 | P1 | Planned | BE+FE | F62 | Manual approval workflow |
| F103 | Emergency Alert Management | v1.2 | P1 | Planned | BE+FE | F50 | Support team response |

### DevEx & Infrastructure

| ID | Feature | Scope | Priority | Status | Owner | Depends On | Rationale |
|----|---------|-------|----------|--------|-------|------------|-----------|
| F110 | Docker Compose Full-Stack Dev Environment | MVP | P0 | Planned | BE | — | Team onboarding, consistency |
| F111 | Swagger/OpenAPI Documentation | MVP | P1 | Planned | BE | — | API consumer productivity |
| F112 | Sentry Error Tracking + Performance | MVP | P1 | Planned | Shared | — | Production observability |
| F113 | Rate Limiting & Security Middleware | MVP | P0 | Planned | BE | — | Abuse prevention |
| F114 | Audit Logging for Financial Events | MVP | P1 | Planned | BE | — | Compliance & dispute resolution |

---

## Detail: Key Decisions

### Why "Vibe Booking" (AI Chat) is P0 / MVP
The AI concierge is DerLg's primary differentiator against generic OTAs (Booking.com, Agoda). Without it, the platform competes purely on inventory — a losing battle for a startup. The chat interface also lowers the barrier for non-English speakers who can converse naturally in Chinese or Khmer.

### Why QR Payment is P0 / MVP
Cambodia's dominant payment methods are ABA Pay and Bakong QR codes. Credit card penetration is low among local operators and many Chinese tourists prefer mobile wallets. Stripe alone would exclude a significant market segment.

### Why Offline Maps is v1.1 (not MVP)
While important for rural Cambodia connectivity, the MVP core loop (discover → chat → book → pay) can function online. Offline maps add significant Service Worker complexity and cache management that would delay launch.

### Why Emergency SOS is v1.2 (not MVP)
Safety is a brand pillar but the feature requires operational support (24/7 monitoring), legal review, and integration with local emergency services. Delaying to v1.2 allows the team to validate core booking unit economics first.

### Why Student Discount is v1.1 (not MVP)
A valuable acquisition channel, but requires manual verification workflow and document storage that can be built after core booking flow is validated.

---

## Deferred / Rejected

| Feature | Decision | Rationale |
|---------|----------|-----------|
| Native iOS/Android Apps | **Rejected** | PWA covers installability at 1/10th the cost. Revisit if app store discoverability becomes critical. |
| Live Video Guide Streaming | **Deferred → Future** | High infrastructure cost; no proven demand in initial user research. |
| Flight Booking | **Rejected** | Cambodia's domestic flight market is tiny; international flights are dominated by aggregators. Focus on ground transport. |

---

## Mapping to `.kiro/specs/`

| Feature IDs | Kiro Spec Path |
|-------------|----------------|
| F01–F06 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 3–4) |
| F10–F16 | `.kiro/specs/agentic-llm-chatbot/requirements.md` + frontend Req 9 |
| F20–F26 | `.kiro/specs/frontend-nextjs-implementation/requirements.md` (Req 3, 5, 20, 21, 22, 36) |
| F30–F38 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 5–9, 11, 30) |
| F40–F47 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 10–11, 40) |
| F50–F52 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 12, 31) |
| F60–F64 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 14, 33) |
| F70–F73 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 15, 39) |
| F80–F85 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 16–17, 28–29) + frontend Req 4, 13 |
| F90–F93 | `.kiro/specs/frontend-nextjs-implementation/requirements.md` (Req 12, 19) |
| F100–F103 | `.kiro/specs/system-admin-panel/requirements.md` |
| F110–F114 | `.kiro/specs/backend-nestjs-supabase/requirements.md` (Req 1, 22, 24, 35, 41–54) |

---

*Last updated: 2026-05-09. Update this file whenever scope, priority, or status changes.*
