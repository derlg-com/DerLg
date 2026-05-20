---
inclusion: always
---

# Product Overview

DerLg.com is a Cambodia travel booking platform with an AI-powered travel concierge. The platform serves tourists (English, Chinese, Khmer speakers) visiting Cambodia, providing trip planning, transportation, hotels, tour guides, and emergency services.

## Core Value Proposition

Mobile-first PWA that combines traditional booking with conversational AI to help travelers discover, plan, and book complete Cambodia trips through natural language chat.

## Key Features (MVP)

- AI Travel Concierge — conversational booking via WebSocket chat
- Trip discovery — curated packages with category filtering
- Multi-booking — trips, hotels, transport, guides in one place
- Smart availability — 15-min holds with Redis TTL
- Payments — Stripe + Bakong/ABA QR for local markets
- Multi-language — EN, ZH, KM across all content
- PWA — installable, offline static asset caching

## User Personas (Priority Order)

1. **WeChat Wendy** (30-45, Chinese tourist) — PRIMARY MARKET
   - Needs: Mandarin UI, QR payments, trusted recommendations
   - Pain: Language barrier, unfamiliar payment systems
   - Success metric: Booking completion rate

2. **Backpacker Ben** (25-35, International)
   - Needs: Price comparison, mobile-first, offline access
   - Pain: Decision fatigue from too many options
   - Success metric: Time from search to booking

3. **Solo Sarah** (28-40, Safety-conscious)
   - Needs: Verified transport, emergency features, location sharing
   - Pain: Safety concerns in unfamiliar areas
   - Success metric: Trust signals engagement

4. **Student Srey** (18-24, Cambodian/ASEAN)
   - Needs: Budget options, student discounts, local knowledge
   - Pain: Limited budget, wants verified deals
   - Success metric: Repeat booking rate

## Non-Goals (What We Won't Build)

- ❌ Flight booking — use existing OTAs, we focus on in-country
- ❌ Social network / travel feed — we're a booking tool, not a social app
- ❌ Multi-country support — Cambodia only for v1-v2
- ❌ Real-time chat between users — only AI concierge chat
- ❌ Custom itinerary builder with drag-and-drop — AI handles planning
- ❌ Desktop-optimized experience — mobile-first, desktop is secondary
- ❌ Marketplace for third-party apps/plugins

## Business Constraints

- **Revenue**: Commission-based (10-15% on bookings). No subscription model.
- **Regulatory**: Must comply with Cambodia tourism licensing. Payment processing via licensed providers only.
- **Budget**: Bootstrap phase — minimize infrastructure costs. Use free tiers where possible (Supabase, Upstash, Vercel).
- **Timeline**: MVP in 8 weeks. Prove core loop: discover → chat → book → pay.
- **Team**: Solo developer + AI agents. Architecture must be simple enough for one person to maintain.

## Key Decisions

- AI agent cannot write to DB directly — all mutations through backend API (security boundary)
- USD is default currency — KHR and CNY supported with hourly rate caching
- Refund policy: 100% if ≥7 days, 50% if 1-7 days, 0% if <24 hours
- 15-minute booking holds — auto-cancel via Redis TTL expiry
- Offline-first for static content — message queue for spotty networks
