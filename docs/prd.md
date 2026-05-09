# DerLg — Product Requirements Document

## 1. Product Overview

**DerLg** is a Cambodia travel booking platform with an AI-powered travel concierge. The platform serves tourists (English, Chinese, Khmer speakers) visiting Cambodia, providing trip planning, transportation, hotels, tour guides, and emergency services.

**Unique Value Proposition:** Mobile-first PWA that combines traditional booking with conversational AI to help travelers discover, plan, and book complete Cambodia trips through natural language chat — aka **"Vibe Booking"**.

## 2. Target Users

| Segment | Needs | Language |
|---------|-------|----------|
| International tourists | Discover trips, book transport/stays/guides | EN |
| Chinese tourists (primary market) | Mandarin support, trusted payment, QR pay | ZH |
| Students | Verified discounts on bookings | EN/ZH/KM |
| Safety-conscious travelers | Emergency alerts, location sharing | EN/KM |

## 3. Core Features

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

## 4. Business Model

- **Commission-based** on confirmed bookings (transportation, hotels, guides)
- **Premium loyalty tiers** with enhanced benefits
- **Student segment** acquisition via verified discount program

## 5. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first booking | < 5 minutes for returning users |
| AI chat conversion rate | > 15% of chat sessions end in booking |
| PWA install rate | > 30% of mobile users |
| Booking completion rate | > 60% of initiated bookings |
| Emergency alert response | < 2 minutes acknowledgment |

## 6. Release Scope

| Phase | Focus | Timeline |
|-------|-------|----------|
| MVP | Auth, booking core, AI chat, payments, PWA | Launch |
| v1.1 | Loyalty, student discount, offline maps | +6 weeks |
| v1.2 | Emergency system, location sharing, festival calendar | +12 weeks |
| v2.0 | Admin dashboard, analytics, referral program | +20 weeks |

---

*This document is the high-level product truth. Detailed requirements live in `.kiro/specs/`. Feature decisions and priority live in `feature-decisions.md`.*
