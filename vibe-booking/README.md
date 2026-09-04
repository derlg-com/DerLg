# Vibe Booking — AI Travel Concierge

> **Feature IDs:** F10–F16
> **Status:** Implemented
> **Scope:** MVP

## What Is Vibe Booking?

**Vibe Booking** is DerLg's core product differentiator: a conversational AI interface that lets travelers discover, plan, and book complete Cambodia trips through natural language chat.

> *"Make Cambodia travel booking as easy as texting a friend who knows every temple, tuk-tuk driver, and hidden beach."*

---

## Architecture

```
┌──────────────┐     WebSocket      ┌─────────────────────────────┐
│   Next.js    │ ◄───────────────►  │  Python AI Agent (FastAPI)  │
│  (web/)      │   ws://agent:8001  │  hand-rolled async tool loop │
│   Port 3002  │                    │  LLM Gateway (RayuCode)     │
└──────────────┘                    └──────────────┬──────────────┘
       ▲                                           │ HTTP + X-Service-Key
       │                                           ▼
       │                              ┌─────────────────────────────┐
       │                              │   NestJS Backend (Port 3003)│
       │                              │  /v1/ai-tools/* endpoints   │
       │                              └──────────────┬──────────────┘
       │                                             │
       └─────────────────────────────────────────────┘
                          REST API /v1/*
```

### High-Level Flow
1. **User** chats with AI via WebSocket (Next.js frontend)
2. **AI Agent** (Python FastAPI) interprets intent, calls backend tools
3. **Backend** (NestJS) executes business logic, queries PostgreSQL
4. **AI Agent** streams Markdown text + structured JSON payloads back to frontend
5. **Frontend** renders Markdown responses + rich content blocks in real time

---

## Key Components

### 1. AI Agent Service (Python)
- **Framework:** FastAPI with async WebSocket support
- **Pattern:** Hand-rolled async tool loop (not LangGraph) — `run_agent()` / `run_agent_streaming()`
- **LLM:** OpenAI-compatible Gateway (RayuCode `longcat-2.0` default) with Ollama as local fallback
- **Session Store:** Redis (7-day TTL)
- **Tool System:** 15 tools with parallel execution via `asyncio.gather`
- **Custom Trips:** Composes and saves bespoke trips with server-side pricing

### 2. Vibe Booking Frontend (Next.js)
- **Entry:** `/chat` route — full-screen AI chat
- **Markdown:** AI responses rendered with react-markdown + remark-gfm
- **Auto-Render:** JSON `content_payloads` route to the correct block renderer (19 block types)
- **State:** Zustand stores, TanStack Query for backend data

### 3. Backend AI Tools (NestJS)
- **Prefix:** `/v1/ai-tools/*`
- **Auth:** `X-Service-Key` header (service-to-service)
- **Endpoints:** Search, bookings, payments/QR, budget estimation, custom trips, loyalty

---

## Features (F10–F16)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F10 | Full-Screen AI Chat Interface | P0 | ✅ Implemented |
| F11 | Trip Suggestions via AI | P0 | ✅ Implemented |
| F12 | AI-Driven Booking Creation | P0 | ✅ Implemented |
| F13 | AI Payment QR Generation | P0 | ✅ Implemented |
| F14 | AI Budget Planner / Estimator | P1 | ✅ Implemented |
| F15 | Persistent Chat History | P1 | ✅ Implemented (Redis, 7-day TTL) |
| F16 | Auto-Reconnect & Message Queue | P1 | ✅ Implemented |

---

## Message Types (Frontend Renderers)

| Type | Shows |
|------|-------|
| `trip_cards` | Grid of trip cards |
| `hotel_cards` | Hotel listings |
| `guide_cards` | Guide profiles |
| `transport_options` | Vehicle comparison |
| `custom_trip_card` | AI-composed custom trip (bookable) |
| `booking_summary` | Booking hold confirmation |
| `booking_confirmed` | Confirmed booking |
| `qr_payment` | QR code + expiry countdown |
| `payment_status` | Payment status badge |
| `itinerary` | Day-by-day plan |
| `budget_estimate` | Cost breakdown |
| `weather` | Forecast widget |
| `comparison` | Side-by-side comparison |
| `image_gallery` | Photo grid |
| `text_summary` | Fallback text |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| AI Service | Python 3.12, FastAPI, OpenAI-compatible Gateway (RayuCode longcat-2.0), httpx, Pydantic, structlog |
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, Zustand, react-markdown |
| Backend Integration | NestJS `/v1/ai-tools/*`, `X-Service-Key` auth |
| Session & Events | Redis (session persistence, 7-day TTL) |

---

## Quick Start

```bash
# AI Agent
cd vibe-booking
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001  # no --reload
```

---

*Last updated: 2026-08-05*
