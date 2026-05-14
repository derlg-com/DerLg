# Vibe Booking — AI Travel Concierge

> **Feature IDs:** F10–F16  
> **Status:** Planned / In Design  
> **Scope:** MVP

## What Is Vibe Booking?

**Vibe Booking** is DerLg's core product differentiator: a conversational AI interface that lets travelers discover, plan, and book complete Cambodia trips through natural language chat. Instead of browsing categories and filling forms, a traveler types *"I want a 3-day temple tour near Siem Reap for 2 people under $300"* and receives curated trip options, hotel suggestions, transport arrangements, and booking confirmation — all within a single chat loop.

### Origin
The name "Vibe Booking" emerged from product positioning sessions to describe "booking by vibe" — travelers expressing mood, preferences, and constraints in casual language rather than navigating rigid search filters.

### Core Value Proposition
> *"Make Cambodia travel booking as easy as texting a friend who knows every temple, tuk-tuk driver, and hidden beach."*

---

## Architecture Overview

```
┌──────────────┐     WebSocket      ┌─────────────────────────────┐
│   Next.js    │ ◄───────────────►  │  Python AI Agent (FastAPI)  │
│  (Frontend)  │   wss://ai.derlg   │  LangGraph + NVIDIA gpt-oss-120b (default) / Ollama fallback │
│   Port 3000  │                    │         Port 8000           │
└──────────────┘                    └──────────────┬──────────────┘
       ▲                                           │ HTTP + X-Service-Key
       │                                           ▼
       │                              ┌─────────────────────────────┐
       │                              │   NestJS Backend (Port 3001)│
       │                              │  /v1/ai-tools/* endpoints   │
       │                              └──────────────┬──────────────┘
       │                                             │
       └─────────────────────────────────────────────┘
                          REST API /v1/*
```

### High-Level Flow
1. **User** chats with AI via WebSocket (Next.js frontend)
2. **AI Agent** (Python FastAPI + LangGraph) interprets intent, calls backend tools
3. **Backend** (NestJS) executes business logic, queries Supabase/PostgreSQL
4. **AI Agent** streams structured JSON back to frontend for auto-render
5. **Frontend** displays rich content (trip cards, maps, payment QR) in real time

---

## Key Components

### 1. AI Agent Service (Python)
- **Framework:** FastAPI with async WebSocket support
- **State Machine:** LangGraph (`DISCOVERY → SUGGESTION → EXPLORATION → CUSTOMIZATION → BOOKING → PAYMENT → POST_BOOKING`)
- **LLM:** NVIDIA gpt-oss-120b (default) with Ollama as local fallback
- **Session Store:** Redis (7-day TTL, checkpoint persistence)
- **Tool System:** 20 backend tool schemas with parallel execution

### 2. Vibe Booking Frontend (Next.js)
- **Layout:** Split-screen — draggable Chat Panel + Content Stage
- **Stream Mode:** Content renders as tool results arrive, not at conversation end
- **Auto-Render:** JSON `content_payload` from AI automatically routes to the correct renderer
- **State:** Zustand store with chat, content, layout, and booking slices

### 3. Backend AI Tools (NestJS)
- **Prefix:** `/v1/ai-tools/*`
- **Auth:** `X-Service-Key` header (service-to-service)
- **Endpoints:** Search, bookings, payments/QR, budget estimation, user profile

---

## Features (F10–F16)

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| F10 | Full-Screen AI Chat Interface | P0 | WebSocket chat with text/voice input, typing indicators, quick-reply buttons |
| F11 | Trip Suggestions via AI | P0 | AI asks clarifying questions, queries inventory, shows interactive trip cards |
| F12 | AI-Driven Booking Creation | P0 | Booking summary → user confirmation → HOLD status → payment QR inline |
| F13 | AI Payment QR Generation | P0 | Bakong/ABA QR code generation with expiry countdown in chat |
| F14 | AI Budget Planner / Estimator | P1 | Real inventory-based cost breakdown in USD/KHR/CNY |
| F15 | Persistent Chat History | P1 | Server sync + localStorage backup, 90-day retention, auto-titled sessions |
| F16 | Auto-Reconnect & Message Queue | P1 | Exponential backoff reconnection, offline message queue, localStorage persistence |

---

## Message Types (Frontend Renderers)

The AI agent sends structured JSON payloads that the frontend auto-renders:

| Type | Content Stage Shows |
|------|---------------------|
| `trip_cards` | Grid of trip cards with image, title, price, rating, action buttons |
| `hotel_cards` | Hotel listings with photo gallery, amenities, price/night, map thumbnail |
| `transport_options` | Comparison table of tuk-tuk, van, bus, private car |
| `itinerary` | Day-by-day timeline with activities, locations, meal indicators |
| `map_view` | Interactive Leaflet map with markers and routes |
| `budget_estimate` | Stacked bar/pie chart breakdown in user's currency |
| `qr_payment` | Large scannable QR with amount, expiry countdown, instructions |
| `booking_confirmed` | Booking ref (`DLG-YYYY-NNNN`), check-in QR, itinerary, download buttons |
| `payment_status` | Status badge (PENDING/SUCCEEDED/FAILED) with retry actions |
| `weather` | 5-day forecast widget |
| `comparison` | Side-by-side feature matrix for up to 3 items |
| `image_gallery` | Photo grid with lightbox |
| `text_summary` | Fallback plain text block |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| AI Service | Python 3.11+, FastAPI, LangGraph, NVIDIA gpt-oss-120b, httpx, Pydantic, structlog |
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, Zustand, Framer Motion, Leaflet |
| Backend Integration | NestJS `/v1/ai-tools/*`, `X-Service-Key` auth |
| Session & Events | Redis (pub/sub for payment events, session persistence) |
| Deployment | Docker, Docker Compose, Railway |

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `docs/modules/vibe-booking/requirements.md` | Feature requirements F10–F16 with acceptance criteria |
| `docs/modules/vibe-booking/architecture.md` | System architecture, WebSocket protocol, state machine, auto-reconnect logic |
| `.kiro/specs/vibe-booking/requirements.md` | AI Agent backend requirements (20 requirements covering FastAPI, LangGraph, tools, prompts, formatting) |
| `.kiro/specs/vibe-booking/design.md` | AI Agent design: module organization, Docker environment, component interfaces, code examples |
| `.kiro/specs/vibe-booking/tasks.md` | Implementation task list (21 phases, 800+ tasks) |
| `.kiro/specs/vibe-booking-frontend/requirements.md` | Frontend Stream Mode requirements (12 requirements: split layout, drag/resize, content rendering, booking loop, i18n, a11y, performance) |
| `.kiro/specs/vibe-booking-frontend/design.md` | Frontend component hierarchy, Zustand store, custom hooks, content renderers, AI conversation flow |
| `.kiro/specs/vibe-booking-frontend/system-design.md` | JSON-driven auto-render architecture, ContentPayload protocol, Zod schemas, renderer registry |
| `.kiro/specs/vibe-booking-frontend/auto-render-system-design.md` | Auto-render pipeline, streaming chunks, booking flow content state machine, error handling |
| `.kiro/specs/vibe-booking-frontend/vibe_booking_researched.md` | Market research, competitive analysis, UX patterns, Cambodia-specific considerations |
| `docs/product/prd.md` | Product PRD — Section 7.2: AI Travel Concierge |
| `docs/product/feature-decisions.md` | Canonical feature registry (F10–F16 scope, priority, status) |

---

## Quick Start

```bash
# AI Agent (from project root)
cd vibe-booking
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Full stack (Docker Compose)
docker-compose up
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NVIDIA_API_KEY` | Yes* | NVIDIA API key (default; required when MODEL_BACKEND=nvidia) |
| `BACKEND_URL` | Yes | NestJS backend base URL |
| `AI_SERVICE_KEY` | Yes | 32+ char secret for backend tool auth |
| `REDIS_URL` | Yes | Redis connection string |
| `MODEL_BACKEND` | Yes | `"nvidia"` (default) or `"ollama"` |
| `OLLAMA_BASE_URL` | Yes* | Ollama server URL (required when MODEL_BACKEND=ollama) |
| `SENTRY_DSN` | No | Error tracking |

---

*Last updated: 2026-05-14*
