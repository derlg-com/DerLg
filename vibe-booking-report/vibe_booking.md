# Vibe Booking — End-to-End Flow

> **Feature:** AI Travel Concierge (Vibe Booking)  
> **Feature IDs:** F10–F16  
> **Layers:** Frontend (Next.js) → AI Agent (Python FastAPI) → Backend (NestJS)

---

## 1. What Vibe Booking Is

**Vibe Booking** is DerLg's core differentiator: a conversational AI travel concierge where travelers type what they want in natural language (e.g., *"3-day temple tour in Siem Reap for 2 people under $300"*) and the system returns curated trip cards, hotel listings, maps, booking summaries, and payment QR codes — all rendered instantly without the user ever leaving the chat or browsing categories manually.

The name "Vibe Booking" emerged from product positioning sessions to describe "booking by vibe" — travelers expressing mood, preferences, and constraints in casual language rather than navigating rigid search filters.

### Core Value Proposition
> *"Make Cambodia travel booking as easy as texting a friend who knows every temple, tuk-tuk driver, and hidden beach."*

---

## 2. The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: FRONTEND (Next.js 16)                                             │
│  ┌─────────────────┐     ┌──────────────────────────────────────────────┐  │
│  │  Chat Panel     │     │  Content Stage  ← PRIMARY VIEWPORT           │  │
│  │  (text chat)    │────►│  (auto-rendered cards, maps, QR codes, etc.) │  │
│  └─────────────────┘     └──────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │ WebSocket (wss://ai.derlg.com/ws/{session_id})
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: AI AGENT (Python FastAPI + LangGraph + NVIDIA gpt-oss-120b)      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │  LLM        │  │  Tool       │  │  Session    │  │  Response       │   │
│  │  (NVIDIA)   │  │  Executor   │  │  (Redis)    │  │  Formatter      │   │
│  └─────────────┘  └──────┬──────┘  └─────────────┘  └─────────────────┘   │
│                          │                                                  │
└──────────────────────────┼──────────────────────────────────────────────────┘
                           │ HTTP + X-Service-Key
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: BACKEND (NestJS)                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ /ai-tools/  │  │ /ai-tools/  │  │ /ai-tools/  │  │ /ai-tools/      │   │
│  │ search      │  │ bookings    │  │ payments/qr │  │ budget          │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘   │
│                                                                             │
│  Database: Supabase PostgreSQL    Cache/Events: Redis                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Core Principle: Chat is Summary, JSON is Content

The frontend uses a **split-screen layout**:

| Pane | Purpose | Format |
|------|---------|--------|
| **Chat Panel** (left) | Conversation — user reads AI text summaries, types replies, clicks quick actions | Plain text + action buttons |
| **Content Stage** (right) | Rich browsing — trip cards, hotel photos, interactive maps, payment QR codes | **JSON-driven auto-render** |

**The golden rule:** The AI agent never sends HTML, JSX, or rendered markup. It sends structured JSON (`content_payload`). The frontend owns all rendering logic. This prevents XSS, ensures design consistency, and makes the system testable.

---

## 4. End-to-End Flow: From User Message to Rendered UI

### Step 1 — User Sends a Message

The traveler opens the Vibe Booking interface and types:
> *"I want a 3-day temple tour near Siem Reap under $300"*

The frontend sends this via WebSocket:
```json
{
  "type": "user_message",
  "content": "I want a 3-day temple tour near Siem Reap under $300"
}
```

### Step 2 — AI Agent Processes (LangGraph State Machine)

The Python AI Agent receives the message. It runs a **LangGraph state machine** with 7 stages:

```
START → DISCOVERY → SUGGESTION → EXPLORATION → CUSTOMIZATION → BOOKING → PAYMENT → POST_BOOKING
```

For this message, the AI:
1. **Classifies intent:** `trip_search`
2. **Extracts parameters:** province="Siem Reap", duration=3, budget=300, theme="temple"
3. **Builds a dynamic system prompt** based on current state (`DISCOVERY` → `SUGGESTION`)
4. **Calls the LLM** (NVIDIA gpt-oss-120b) with the prompt + last 20 messages + all 20 tool schemas

The LLM decides it needs real data and returns a `tool_use` request:
```json
{
  "tool_use": {
    "name": "getTripSuggestions",
    "input": {
      "province": "Siem Reap",
      "duration_days": 3,
      "budget_usd": 300,
      "theme": "temple"
    }
  }
}
```

### Step 3 — Tool Execution (Backend Calls)

The AI Agent's **Tool Executor** calls the NestJS backend in parallel (if multiple tools are requested):
```
POST {BACKEND_URL}/v1/ai-tools/search/trips
Headers: X-Service-Key: ***, Accept-Language: EN
```

The backend queries Supabase/PostgreSQL and returns:
```json
{
  "trips": [
    {
      "id": "trip_angkor_classic",
      "name": "Angkor Classic Temple Tour",
      "description": "Explore Angkor Wat, Bayon, and Ta Prohm...",
      "province": "Siem Reap",
      "durationDays": 3,
      "priceUsd": 245,
      "priceKhr": 998000,
      "rating": 4.8,
      "reviewCount": 342,
      "imageUrl": "https://cdn.derlg.com/trips/angkor-classic-1.jpg",
      "highlights": ["Angkor Wat sunrise", "Bayon smiling faces", "Ta Prohm jungle temple"],
      "includes": ["Guide", "Transport", "Temple pass", "Lunch"],
      "meetingPoint": "Siem Reap Pub Street",
      "maxGuests": 8
    },
    {
      "id": "trip_banteay_srei",
      "name": "Banteay Srei & Remote Temples",
      "priceUsd": 195,
      "priceKhr": 794000
    }
  ]
}
```

### Step 4 — AI Formats Response (Text + JSON Payload)

The AI Agent sends **one WebSocket message** containing both:
- A **text summary** for the Chat Panel
- A **structured JSON payload** for the Content Stage

```json
{
  "type": "agent_message",
  "text": "I found 2 incredible temple tours in Siem Reap within your $300 budget. The Angkor Classic covers the iconic temples with a small group, while the Banteay Srei tour takes you to more remote, less crowded ruins. Both include your temple pass and transport.",
  "content_payload": {
    "type": "trip_cards",
    "data": {
      "trips": [ /* full trip objects from backend */ ]
    },
    "actions": [
      { "type": "view_trip_detail", "label": "View Details", "payload": { "tripId": "trip_angkor_classic" }, "style": "primary" },
      { "type": "book_trip", "label": "Book This Tour", "payload": { "tripId": "trip_angkor_classic" }, "style": "primary" },
      { "type": "compare_trip", "label": "Add to Compare", "payload": { "tripId": "trip_angkor_classic" }, "style": "secondary" }
    ],
    "metadata": {
      "title": "Temple Tours in Siem Reap",
      "subtitle": "2 options under $300",
      "icon": "Landmark",
      "replace": true,
      "shareable": true
    }
  },
  "state": "SUGGESTION"
}
```

---

## 5. Frontend Auto-Render: How JSON Becomes UI

When the frontend receives the `agent_message`, the **auto-render pipeline** activates automatically — no user click required.

### The Render Loop

```
WebSocket message arrives
        ↓
┌─────────────────┐
│ MessageParser   │ ──► text → Chat Panel (summary bubble)
│                 │ ──► content_payload → ContentRouter
└────────┬────────┘
         ↓
┌─────────────────┐
│ ContentRouter   │ ──► reads payload.type = "trip_cards"
│ (useContentRouter│ ──► looks up renderer in CONTENT_REGISTRY
│     hook)       │ ──► validates payload.data with Zod schema
└────────┬────────┘
         ↓
┌─────────────────┐
│ ContentStore    │ ──► adds new ContentItem to Zustand state
│   (Zustand)     │ ──► triggers React re-render
└────────┬────────┘
         ↓
┌─────────────────┐
│ ContentStage    │ ──► maps ContentItem.type → lazy-loaded renderer
│   (React)       │ ──► passes validated data as props
│                 │ ──► renderer mounts with full rich UI
└─────────────────┘
```

### What the User Sees

**Chat Panel (left):**
> *"I found 2 incredible temple tours in Siem Reap within your $300 budget. The Angkor Classic covers the iconic temples with a small group, while the Banteay Srei tour takes you to more remote, less crowded ruins. Both include your temple pass and transport."*

**Content Stage (right) — auto-rendered immediately:**
```
┌─────────────────────────────────────────────┐
│  Temple Tours in Siem Reap                  │
│  2 options under $300                    [X]│
├─────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────┐            │
│ │ [trip photo]│  │ [trip photo]│            │
│ │ Angkor      │  │ Banteay     │            │
│ │ Classic     │  │ Srei &      │            │
│ │ $245 USD    │  │ Remote      │            │
│ │ ⭐ 4.8      │  │ $195 USD    │            │
│ │ 3 days      │  │ ⭐ 4.6      │            │
│ │             │  │ 3 days      │            │
│ │ [Book Now]  │  │ [Book Now]  │            │
│ └─────────────┘  └─────────────┘            │
│                                             │
│ [View Details] [Add to Compare] [Share]     │
└─────────────────────────────────────────────┘
```

The trip cards include images, prices in USD/KHR, ratings, duration, highlights, and action buttons — all rendered from the JSON payload.

---

## 6. The Booking Flow (Closed Loop)

When the user clicks **"Book Now"**, the entire booking journey continues inside the same conversation:

### Discovery → Booking → Payment → Confirmed

```
User clicks "Book Now"
        ↓
Frontend sends: { type: "user_action", action_type: "book_trip", ... }
        ↓
AI Agent calls: createBooking(tool) → Backend creates booking with HOLD status
        ↓
AI Agent sends content_payload: { type: "booking_summary", data: { ...price breakdown... } }
        ↓
ContentStage RENDERS: Booking Summary Card with 15-min countdown timer
        ↓
User clicks "Confirm Booking"
        ↓
AI Agent calls: generatePaymentQR(tool) → Backend creates QR payment intent
        ↓
ContentStage TRANSITIONS (slide animation): booking_summary → qr_payment
        ↓
User scans QR and pays
        ↓
Backend publishes payment event to Redis pub/sub
        ↓
AI Agent receives event, updates session state to POST_BOOKING
        ↓
ContentStage TRANSITIONS: qr_payment → booking_confirmed
        ↓
User sees: Booking reference DLG-2026-0042, check-in QR, download receipt button
```

**Content transitions use `AnimatePresence`** — old content slides out left, new content slides in from right (300ms). The `metadata.replace: true` flag tells the system to replace the previous content rather than stack it.

---

## 7. Streaming Mode: Real-Time Progressive Disclosure

Vibe Booking doesn't wait for the AI to finish thinking before showing content. It uses **Stream Mode**:

1. User sends message
2. Frontend shows **typing indicator** + **streaming skeleton** on Content Stage
3. AI calls tools in parallel
4. As soon as first tool results arrive, the frontend renders them immediately
5. Subsequent results append or update
6. Perceived wait time drops by 60-70%

**Streaming message types:**
- `agent_tool_status` — "Finding hotels..." (shows global indicator)
- `agent_stream_chunk` — partial results append to existing ContentItem
- `agent_message` — final text + full `content_payload`

---

## 8. State Management (Frontend)

The frontend uses a **Zustand store** with 4 slices:

| Slice | Holds |
|-------|-------|
| **Chat** | messages[], isTyping, connectionStatus |
| **Content** | contentItems[], activeContentId, isStreaming |
| **Layout** | panel position/size/dock (persisted to localStorage) |
| **Booking** | booking status: idle → holding → paying → confirmed/failed |

Only layout and last 50 messages persist to `localStorage`. Content items are ephemeral — they rebuild from AI messages on reconnect.

---

## 9. Content Type Registry (All 16 Renderers)

The frontend maintains a registry mapping `content_payload.type` to a lazy-loaded React component + Zod schema:

| Type | What Renders |
|------|-------------|
| `trip_cards` | Grid of trip cards with images, prices, ratings, action buttons |
| `hotel_cards` | Hotel listings with photo gallery, amenities, map thumbnail |
| `transport_options` | Comparison table of tuk-tuk, van, bus, private car |
| `itinerary` | Day-by-day timeline with activities and meal indicators |
| `map_view` | Interactive Leaflet map with markers and routes |
| `booking_summary` | Price breakdown, guest info, 15-min hold countdown |
| `qr_payment` | Large scannable QR code with amount and expiry |
| `booking_confirmed` | Booking ref `DLG-YYYY-NNNN`, check-in QR, downloads |
| `payment_status` | Status badge (PENDING/SUCCEEDED/FAILED) with retry actions |
| `budget_estimate` | Stacked bar chart in USD/KHR/CNY |
| `weather` | 5-day Cambodia forecast widget |
| `comparison` | Side-by-side feature matrix for up to 3 items |
| `image_gallery` | Photo grid with lightbox |
| `text_summary` | Fallback plain text block |

Each renderer is:
- **Lazy-loaded** for code splitting
- **Zod-validated** at ingestion time (not render time)
- **Memoized** with `React.memo` to prevent unnecessary re-renders
- **Wrapped in an ErrorBoundary** so one bad payload can't crash the app

---

## 10. Session & Resilience

- **Redis sessions** persist for 7 days with LangGraph checkpointing
- **WebSocket auto-reconnect** with exponential backoff (1s → 2s → 4s → 8s → max 30s)
- **Offline message queue** stores messages in `localStorage` and flushes on reconnect
- **Payment events** use Redis pub/sub so the user gets instant confirmation even if they switch apps to scan the QR

---

## Summary

Vibe Booking works by strictly separating **conversation** from **content**:

1. **User** chats naturally in the Chat Panel
2. **AI Agent** (LangGraph + NVIDIA) interprets intent, calls backend tools, and returns **structured JSON**
3. **Frontend** auto-routes that JSON through a type-safe pipeline (Zod validation → renderer registry → React component)
4. **Content Stage** renders rich, interactive UI instantly — trip cards, maps, booking forms, QR codes — without page reloads
5. **Booking flows** transition smoothly with animations, and payment confirmations arrive in real-time via Redis pub/sub

The result: a traveler can plan, book, and pay for a complete Cambodia trip by simply having a conversation.

---

*Last updated: 2026-05-14*
