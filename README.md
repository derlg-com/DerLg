# DerLg

> **Cambodia Travel Booking, Reimagined.**
>
> Book trips, hotels, transport, and guides through natural language conversation — no more endless tabs, no more decision fatigue.

---

## What is DerLg?

**DerLg** is a mobile-first travel booking platform for Cambodia. Unlike generic OTAs that make you browse through hundreds of listings, DerLg lets you **chat with an AI travel concierge** to plan and book your entire trip — from temple tours in Siem Reap to tuk-tuk rides in Phnom Penh.

Our mission: *"Make Cambodia travel booking as easy as texting a friend who knows every temple, tuk-tuk driver, and hidden beach."*

---

## The Big Idea: Vibe Booking

**Vibe Booking** is our signature feature — an AI-powered conversational booking experience.

Instead of navigating complex search filters and comparison tables, you simply *chat*:

> **You:** "I want a 3-day temple tour near Siem Reap with a guide who speaks Chinese"
>
> **DerLg AI:** *"Great choice! I found 3 packages that match. The first includes Angkor Wat, Bayon, and Ta Prohm with a Mandarin-speaking guide, hotel pickup, and lunch — $189 per person. Want me to hold a spot for 15 minutes while you decide?"*

The AI handles the entire loop: **discover → plan → book → pay** — all within the chat. No context switching. No research fatigue.

### Why Vibe Booking Matters

- **Lower barrier for non-English speakers** — chat naturally in Chinese, Khmer, or English
- **Reduces decision fatigue** — AI curates options based on your intent, not just keywords
- **Closes the booking loop** — confirm reservations and pay without leaving the conversation
- **Works offline** — message queueing for spotty Cambodian mobile networks

---

## Features

### Live Now (MVP)

| Feature | Description |
|---------|-------------|
| **Vibe Booking (AI Chat)** | Full-screen WebSocket chat with a LangGraph + Claude AI agent. Renders trip cards, hotel listings, action buttons, and payment QR codes inline. |
| **Trip Discovery** | Curated Cambodia trip packages — temples, nature, culture, adventure, food. Hero home screen with category filtering. |
| **Multi-Booking Engine** | Book trips, hotels, transportation (van/bus/tuk-tuk), and verified tour guides in one place. |
| **Smart Availability** | 15-minute booking holds with Redis TTL, conflict detection, and auto-cancellation. |
| **Payments** | Stripe card payments (3D Secure) + Bakong/ABA QR codes for Cambodian and Chinese markets. |
| **Multi-Language** | Full support for **English, Chinese (中文), and Khmer (ខ្មែរ)** across all content. |
| **PWA** | Installable Progressive Web App with offline static asset caching. Feels like a native app without the app store. |

### Coming Soon

| Feature | Description | Release |
|---------|-------------|---------|
| **Loyalty Points** | Earn 2 points per USD spent. Redeem at checkout (100 pts = $1). | v1.1 |
| **Student Discounts** | Verify student ID for automatic discounts across bookings. | v1.1 |
| **Offline Maps** | Downloadable OpenStreetMap packs for rural Cambodia navigation. | v1.1 |
| **Emergency SOS** | GPS-tracked SOS alerts with 5-second cancel countdown. Direct push + SMS to support team. | v1.2 |
| **Location Sharing** | Share live location with family via unique tracking links. | v1.2 |
| **Festival Calendar** | Cultural events with auto-generated discount codes. | v1.2 |
| **Admin Dashboard** | Metrics, bookings, users, revenue charts for operations. | v2.0 |

---

## Who Is This For?

| Traveler | Need | How DerLg Helps |
|----------|------|-----------------|
| **Backpacker Ben** (25-35, International) | Discover trips, compare prices, book on mobile | AI chat, trip discovery, offline maps |
| **WeChat Wendy** (30-45, Chinese) | Mandarin support, trusted payment, QR pay | AI chat in Chinese, Bakong/ABA QR, social sharing |
| **Student Srey** (18-24, Cambodian/ASEAN) | Budget travel, verified discounts | Student verification, discount auto-apply |
| **Solo Sarah** (28-40, Safety-conscious) | Reliable transport, emergency help | Emergency SOS, live location sharing, female-friendly guides |

---

## Tech Stack

```
Frontend (Next.js)  ←REST→  Backend (NestJS)  ←Tools→  AI Agent (Python/FastAPI)
    Port 3000                  Port 3001                    LangGraph + Claude
         │                         │
         └──────────┬──────────────┘
                    ▼
            ┌───────────────┐
            │  Supabase PG  │  ← Primary Database
            │  Redis        │  ← Cache, Sessions, Pub/Sub
            │  Stripe       │  ← Payments
            └───────────────┘
```

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, Geist fonts |
| **Backend** | NestJS 11, TypeScript 5.7, Prisma ORM, Jest |
| **AI Agent** | Python 3.11, FastAPI, LangGraph, Claude Sonnet |
| **Database** | PostgreSQL via Supabase |
| **Cache** | Redis (Upstash in prod) |
| **Payments** | Stripe + Bakong/ABA QR |
| **Email** | Resend |
| **Push** | Firebase Cloud Messaging |
| **Maps** | Leaflet.js + OpenStreetMap |

---

## Architecture Highlights

- **Conversational Booking Loop** — AI agent renders interactive cards (trips, hotels, QR codes) directly in chat. Users confirm bookings without leaving the conversation.
- **Service-Key Isolation** — AI agent cannot write to the database directly. All mutations go through backend `/v1/ai-tools/*` endpoints authenticated with `X-Service-Key`.
- **Resilient Messaging** — Exponential backoff reconnection + offline message queue for Cambodian mobile networks.
- **Tiered Refunds** — 100% refund if cancelled >=7 days, 50% if 1-7 days, 0% if <24 hours.
- **Currency Flexibility** — USD (default), KHR, CNY with hourly rate caching.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/product/prd.md`](docs/product/prd.md) | Full Product Requirements Document |
| [`docs/product/feature-decisions.md`](docs/product/feature-decisions.md) | Feature registry with scope, priority, status |
| [`docs/platform/architecture/system-overview.md`](docs/platform/architecture/system-overview.md) | System architecture, auth flow, payment flow |
| [`docs/modules/`](docs/modules/) | Per-feature API specs and architecture |
| [`CLAUDE.md`](CLAUDE.md) | Development guide for Claude Code |

---

## Getting Started

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Run frontend dev server (port 3000)
cd frontend && npm run dev

# Run backend dev server (port 3001)
cd backend && npm run start:dev
```

---

## Project Status

**Phase:** Early scaffolding. Boilerplate is up. Implementation is underway.

**MVP Goal:** Prove the core loop — *discover → chat → book → pay*.

For the full feature roadmap and release timeline, see [`docs/product/feature-decisions.md`](docs/product/feature-decisions.md).

---

*Built for travelers. Built for Cambodia.*
