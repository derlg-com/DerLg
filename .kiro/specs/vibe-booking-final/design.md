# Design: Vibe Booking — AI Travel Concierge

> **Source of truth:** `.kiro/specs/vibe-booking-final/design.md` (this file)  
> **Services:** AI Agent (`vibe-booking/`), Frontend Stream Mode (`frontend/app/(app)/vibe-booking/`)

---

## 1. Overview

Vibe Booking is a full-stack conversational booking experience. The AI Agent (Python FastAPI + LangGraph + gpt-oss-120b) powers natural-language trip planning, while the Frontend (Next.js Stream Mode) renders rich interactive content in real-time as the AI discovers options.

### Core Design Principles

1. **Tool-First Data Access** — The agent never invents facts. All data comes from backend tool calls.
2. **No Direct DB Access** — All mutations go through `/v1/ai-tools/*` endpoints authenticated with `X-Service-Key`.
3. **Human-in-the-Loop Payment** — The agent never executes payments. It sends `requires_payment` to the frontend.
4. **Stateful Sessions** — Active sessions live in Redis (`ai:conv:{user_id}`, 7-day TTL). On disconnect, state archives to PostgreSQL.
5. **Stream-First Rendering** — Content appears on the Content Stage as tool results arrive, not at conversation end.
6. **Renderer Isolation** — Each content type is self-contained with its own Zod schema, styles, and error boundary.
7. **No-ReRender Drag** — Drag/resize mutates CSS transforms directly; React state updates only on operation end.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js) — Port 3000                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ SplitScreenLayout (Client Component)                             │   │
│  │ ┌──────────────┐  ┌─────────────────────────────────────────┐  │   │
│  │ │ ChatPanel    │  │ ContentStage (PRIMARY VIEWPORT)         │  │   │
│  │ │ ──────────── │  │ ─────────────────────────────────────── │  │   │
│  │ │ ChatHeader   │  │ ContentStageHeader                      │  │   │
│  │ │ MessageList  │  │ ├─ ContentHistory (scrollable)          │  │   │
│  │ │ ChatInput    │  │ │  ├─ ContentItem (memo, ErrorBoundary) │  │   │
│  │ │ ResizeHandle │  │ │  │  ├─ ContentRenderer (lazy-loaded)  │  │   │
│  │ └──────────────┘  │ │  │  └─ ActionBar                      │  │   │
│  │                   │ │  └─ ContentItemSkeleton                │  │   │
│  │                   │ └─ ContentPlaceholder                   │  │   │
│  │                   └─────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │ WebSocket (ws://localhost:8000/ws/chat)  │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI Agent Service (vibe-booking/) — Port 8000          │
│                         Python FastAPI + LangGraph + gpt-oss-120b        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ LangGraph Agent                                                  │   │
│  │ GREETING → DISCOVERY → RECOMMEND → BOOKING → PAYMENT → CONFIRMED │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         ┌────────────────┬────────────────┐                            │
│         ▼                ▼                ▼                            │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                       │
│  │ gpt-oss- │     │ Tool     │     │ Session  │                       │
│  │ 120b     │     │ Executor │     │ Store    │                       │
│  │ (LLM)    │     └────┬─────┘     └────┬─────┘                       │
│  └──────────┘          │ HTTP +        Redis                          │
│                        │ X-Service-Key                                │
└────────────────────────┼────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend (NestJS) — Port 3001 — /v1/ai-tools/*   │
│  search_hotels  search_trips  search_guides  search_transport           │
│  check_availability  create_booking_hold  get_weather                   │
│  get_emergency_contacts  send_sos_alert  get_user_loyalty               │
│  estimate_budget  check_payment_status                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Communication Patterns

| Direction | Protocol | Auth | Base URL |
|-----------|----------|------|----------|
| Frontend → AI Agent | WebSocket | Bearer JWT | `wss://ai.derlg.com/ws/chat` |
| AI Agent → Backend | HTTP REST | `X-Service-Key` | `http://backend:3001/v1/ai-tools/*` |
| Frontend → Backend | HTTP REST | Bearer JWT | `https://api.derlg.com/v1/*` |

---

## 3. Module Organization

### 3.1 AI Agent (`vibe-booking/`)

```
vibe-booking/
├── src/
│   ├── main.py                    # FastAPI app entry point
│   ├── agent/
│   │   ├── state_machine.py       # LangGraph StateGraph definition
│   │   ├── tools.py               # Tool schema definitions + TOOL_DISPATCH
│   │   ├── prompts.py             # System prompt builder (state-aware)
│   │   ├── nodes.py               # call_llm, execute_tools, format_response
│   │   └── core.py                # Max iteration enforcement, error handling
│   ├── websocket/
│   │   ├── chat_handler.py        # WebSocket endpoint + connection manager
│   │   └── protocol.py            # Message type definitions and validators
│   ├── services/
│   │   ├── nvidia_client.py       # NVIDIA NIM API client (gpt-oss-120b)
│   │   ├── redis_client.py        # Redis connection + session persistence
│   │   └── backend_client.py      # httpx client for /v1/ai-tools/* calls
│   ├── models/
│   │   ├── conversation.py        # ConversationState Pydantic model
│   │   └── messages.py            # WS message schemas
│   └── config/
│       └── settings.py            # Pydantic BaseSettings
├── tests/
│   ├── unit/
│   ├── integration/
│   └── property/                  # Hypothesis tests
├── Dockerfile
├── Dockerfile.dev
└── requirements.txt
```

### 3.2 Frontend Stream Mode (`frontend/`)

```
frontend/app/(app)/vibe-booking/
├── page.tsx                       # VibeBookingPage (Server Component)
├── layout.tsx
└── _components/
    ├── SplitScreenLayout.tsx      # Two-pane layout wrapper
    ├── ChatPanel/
    │   ├── ChatPanel.tsx          # Draggable/resizable panel
    │   ├── ChatHeader.tsx         # Drag handle, status, controls
    │   ├── MessageList.tsx        # Virtualized message list
    │   ├── ChatMessage.tsx        # Individual message bubble
    │   ├── ChatInput.tsx          # Text input + send
    │   └── ResizeHandle.tsx       # Resize grip
    ├── ContentStage/
    │   ├── ContentStage.tsx       # Primary viewport
    │   ├── ContentStageHeader.tsx # Title, clear all, streaming indicator
    │   ├── ContentHistory.tsx     # Scrollable item container
    │   ├── ContentItem.tsx        # Wrapper with error boundary
    │   ├── ContentPlaceholder.tsx # Empty state with prompt chips
    │   └── StreamingIndicator.tsx # Pulsing dot + localized text
    └── renderers/
        ├── TripCardsRenderer.tsx
        ├── HotelCardsRenderer.tsx
        ├── TransportOptionsRenderer.tsx
        ├── ItineraryRenderer.tsx
        ├── MapViewRenderer.tsx
        ├── BudgetEstimateRenderer.tsx
        ├── QRPaymentRenderer.tsx
        ├── BookingConfirmedRenderer.tsx
        ├── PaymentStatusRenderer.tsx
        ├── WeatherRenderer.tsx
        ├── ComparisonRenderer.tsx
        ├── ImageGalleryRenderer.tsx
        └── TextSummaryRenderer.tsx  # Fallback

frontend/stores/
└── vibe-booking.store.ts          # Zustand store with Immer + persist

frontend/hooks/
├── useWebSocket.ts                # WS connection, reconnect, queue
├── useDraggableResizable.ts       # RAF-based drag/resize
├── useContentRouter.ts            # Routes WS messages to store actions
└── useContentRenderer.ts          # Maps type to lazy-loaded component

frontend/lib/vibe-booking/
├── content-registry.ts            # Type → renderer + schema mapping
├── content-pipeline.ts            # createContentRenderer factory
└── renderers/
    └── types.ts                   # ContentRendererProps interface
```

---

## 4. WebSocket Protocol (Unified)

### 4.1 Connection

```
Client ──ws://localhost:8000/ws/chat──▶ AI Agent
Headers:
  Authorization: Bearer <user_jwt>
  X-Session-Id: <session_uuid>   (optional)
```

### 4.2 Client → Server Messages

```typescript
// Authentication (first message, or use header)
interface AuthMessage {
  type: 'auth';
  payload: {
    userId: string;
    sessionId: string;
    preferredLanguage: 'en' | 'zh' | 'km';
    token: string;
  };
}

// User text input
interface UserMessage {
  type: 'user_message';
  conversation_id: string;
  content: string;
}

// Action from Content Stage button click
interface UserActionMessage {
  type: 'user_action';
  payload: {
    actionType: string;   // e.g., "book_trip", "view_detail"
    itemId: string;
    data: Record<string, unknown>;
  };
}

// Payment completion
interface PaymentCompletedMessage {
  type: 'payment_completed';
  booking_id: string;
}

// Location sharing
interface LocationMessage {
  type: 'location';
  payload: { lat: number; lng: number; accuracy?: number; address?: string };
}

// Heartbeat
interface PingMessage {
  type: 'ping';
}
```

### 4.3 Server → Client Messages

```typescript
// AI text response + optional content for Content Stage
interface AgentMessage {
  type: 'agent_message';
  conversation_id: string;
  content: string;
  content_payload?: ContentPayload;  // Triggers auto-render
  suggestions?: Suggestion[];
}

// Payment handoff
interface RequiresPaymentMessage {
  type: 'requires_payment';
  booking_id: string;
  amount_usd: number;
  methods: ('stripe' | 'bakong')[];
}

// Real-time payment status push
interface PaymentStatusMessage {
  type: 'payment_status';
  payload: {
    paymentIntentId: string;
    bookingId: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    amountUsd: number;
    amountKhr: number;
    receiptUrl?: string;
  };
}

// Booking hold countdown warning
interface BookingHoldExpiryMessage {
  type: 'booking_hold_expiry';
  payload: { bookingId: string; secondsRemaining: number };
}

// Incremental content during parallel tool execution
interface AgentStreamChunkMessage {
  type: 'agent_stream_chunk';
  payload: {
    content_type: ContentType;
    content_data: Record<string, unknown>;
    meta: {
      tool_call_id: string;
      sequence_number: number;
      is_final: boolean;
      total_expected: number;
    };
  };
}

// Tool execution progress
interface AgentToolStatusMessage {
  type: 'agent_tool_status';
  payload: {
    tool_call_id: string;
    tool_name: string;
    status: 'started' | 'in_progress' | 'completed' | 'failed';
    progress?: number;
  };
}

// Typing indicators
interface TypingStartMessage { type: 'typing_start'; timestamp: string; }
interface TypingEndMessage { type: 'typing_end'; timestamp: string; }

// Heartbeat response
interface PongMessage { type: 'pong'; timestamp: string; }

// Error
interface ErrorMessage {
  type: 'error';
  payload: { code: string; message: string; recoverable: boolean };
}
```

### 4.4 ContentPayload Schema

```typescript
interface ContentPayload {
  type: ContentType;
  data: Record<string, unknown>;
  actions: ContentAction[];
  metadata: {
    title?: string;
    subtitle?: string;
    icon?: string;
    backable?: boolean;
    shareable?: boolean;
    replace?: boolean;  // Replace current content vs. append
  };
}

type ContentType =
  | 'trip_cards'
  | 'trip_detail'
  | 'hotel_cards'
  | 'hotel_detail'
  | 'transport_options'
  | 'map_view'
  | 'itinerary'
  | 'booking_summary'
  | 'qr_payment'
  | 'payment_status'
  | 'booking_confirmed'
  | 'budget_estimate'
  | 'weather'
  | 'comparison'
  | 'image_gallery'
  | 'text_summary';

interface ContentAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
  style?: 'primary' | 'secondary' | 'danger';
  icon?: string;
}
```

---

## 5. LangGraph State Machine

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  GREETING   │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
         ┌─────────►│  DISCOVERY  │◄────────┐
         │          └──────┬──────┘         │
         │                 ▼                │
         │          ┌─────────────┐         │
         │          │  RECOMMEND  │─────────┘
         │          └──────┬──────┘  (back to DISCOVERY if user changes mind)
         │                 ▼
         │          ┌─────────────┐
         │          │   BOOKING   │
         │          └──────┬──────┘
         │                 ▼
         │          ┌─────────────┐
         │          │   PAYMENT   │  ← sends requires_payment to frontend
         │          └──────┬──────┘
         │                 ▼ (payment_completed received)
         │          ┌─────────────┐
         └──────────│  CONFIRMED  │
                    └─────────────┘
```

### Node Definitions

| Node | Responsibility |
|------|---------------|
| `call_llm` | Send conversation + tools to gpt-oss-120b; receive response |
| `execute_tools` | Run tool calls in parallel via `asyncio.gather`; call backend |
| `format_response` | Convert AI text + tool results into typed WS message with `content_payload` |

### Edge Conditions

```python
def should_execute_tools(state) -> str:
    if state["model_response"].stop_reason == "tool_use":
        return "execute_tools"
    return "format_response"
```

---

## 6. Conversation State Model

```python
# src/models/conversation.py

from pydantic import BaseModel
from typing import Any, Literal

class Message(BaseModel):
    role: Literal["user", "assistant", "tool_result", "system"]
    content: str | list

class ConversationState(BaseModel):
    messages: list[Message] = []
    user_id: str
    conversation_id: str
    intent: str | None = None
    pending_tool_calls: list[dict] = []
    last_action: str | None = None
    last_tool_call: str | None = None
    context: dict[str, Any] = {}
    preferred_language: str = "en"
    booking_id: str | None = None
```

**Context Stack Fields:**

```python
# Stored in ConversationState.context
{
    "dates": { "check_in": "...", "check_out": "..." },
    "budget": { "min_usd": 100, "max_usd": 500 },
    "selected_trip_id": "trip_001",
    "selected_hotel_id": "hotel_001",
    "active_booking_id": "booking_001",
    "user_location": { "lat": 11.5564, "lng": 104.9282, "address": "..." },
    "search_filters": {
        "price_min": 50,
        "price_max": 200,
        "rating_min": 4.0,
        "amenities": ["wifi", "pool"]
    }
}
```

---

## 7. Session Persistence

| Layer | Storage | Key | TTL |
|-------|---------|-----|-----|
| Active session | Redis | `ai:conv:{user_id}` | 7 days |
| Long-term archive | PostgreSQL | `conversations` + `messages` tables | Permanent |

### Connection Lifecycle

```
Frontend ──WS connect + JWT──► AI Agent
AI Agent ──verify JWT──► (reject 1008 if invalid)
AI Agent ──GET ai:conv:user_123──► Redis
Redis ──► ConversationState (or empty)
AI Agent ──► Frontend: WS open + "conversation_resumed" (or "conversation_started")

Frontend ──user_message──► AI Agent
AI Agent ──LangGraph processes──►
AI Agent ──SET ai:conv:user_123 (TTL 7d)──► Redis
AI Agent ──► Frontend: agent_message + content_payload

Frontend ──WS close──►
AI Agent ──SET ai:conv:user_123 (TTL 7d)──► Redis
AI Agent ──INSERT conversation + messages──► PostgreSQL (via backend API)
```

---

## 8. Tool Execution

### 8.1 Unified TOOL_DISPATCH

All tools call `{BACKEND_URL}/v1/ai-tools/*` with:
- `X-Service-Key: <AI_SERVICE_KEY>`
- `Accept-Language: <locale>`

```python
TOOL_DISPATCH = {
    "search_hotels":          ("GET",  "/v1/ai-tools/hotels"),
    "search_trips":           ("GET",  "/v1/ai-tools/trips"),
    "search_guides":          ("GET",  "/v1/ai-tools/guides"),
    "search_transport":       ("GET",  "/v1/ai-tools/transport"),
    "check_availability":     ("GET",  "/v1/ai-tools/availability"),
    "create_booking_hold":    ("POST", "/v1/ai-tools/booking-holds"),
    "get_weather":            ("GET",  "/v1/ai-tools/weather"),
    "get_emergency_contacts": ("GET",  "/v1/ai-tools/emergency-contacts"),
    "send_sos_alert":         ("POST", "/v1/ai-tools/sos"),
    "get_user_loyalty":       ("GET",  "/v1/ai-tools/loyalty"),
    "estimate_budget":        ("POST", "/v1/ai-tools/budget/estimate"),
    "check_payment_status":   ("GET",  "/v1/ai-tools/payments/{payment_intent_id}/status"),
}
```

### 8.2 Parallel Execution

```python
async def execute_tools_parallel(tool_calls: list[dict], session: dict) -> list[dict]:
    tasks = [execute_single_tool(tc, session) for tc in tool_calls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [
        {"success": False, "error": {"code": "TOOL_ERROR", "message": str(r)}}
        if isinstance(r, Exception) else r
        for r in results
    ]
```

### 8.3 Tool Call Flow

```
AI Agent ──send conversation + tools──► gpt-oss-120b API
gpt-oss-120b ──► tool_use: search_trips(params)
AI Agent ──GET /v1/ai-tools/trips?...──► Backend (X-Service-Key)
Backend ──► 200 OK { trips: [...] }
AI Agent ──tool_result: trips──► gpt-oss-120b
gpt-oss-120b ──► Natural-language response + content_payload
```

---

## 9. Frontend State Management

### 9.1 Zustand Store: `vibeBookingStore`

Single store with slices. Uses Immer for mutation-safe updates. Only layout and last-50 messages persist to localStorage.

```typescript
// stores/vibe-booking.store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'error';
  linkedContentId?: string;
  timestamp: string;
}

interface ContentItem {
  id: string;
  type: ContentType;
  data: unknown;
  actions: ContentAction[];
  metadata: ContentMetadata;
  status: 'ready' | 'streaming' | 'error';
  timestamp: string;
  linkedMessageId?: string;
  linkedToolCallId?: string;
}

interface LayoutConfig {
  dock: 'left' | 'right' | 'center' | 'floating';
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
}

type BookingState =
  | { status: 'idle' }
  | { status: 'holding'; bookingId: string; reservedUntil: string }
  | { status: 'paying'; bookingId: string; paymentIntentId: string }
  | { status: 'confirmed'; bookingId: string; bookingRef: string }
  | { status: 'failed'; bookingId: string; error: string };

const DEFAULT_LAYOUT: LayoutConfig = {
  dock: 'right',
  x: 0,
  y: 0,
  width: 420,
  height: 0,
  collapsed: false,
};

export const useVibeBookingStore = create<VibeBookingState>()(
  persist(
    immer((set) => ({
      messages: [],
      isTyping: false,
      isStreaming: false,
      connectionStatus: 'disconnected',
      contentItems: [],
      activeContentId: null,
      layout: DEFAULT_LAYOUT,
      booking: { status: 'idle' },
      // Actions omitted for brevity — see full implementation
    })),
    {
      name: 'derlg:vibe-booking:store',
      partialize: (state) => ({
        layout: state.layout,
        messages: state.messages.slice(-50),
        contentItems: state.contentItems.slice(-20),
      }),
    }
  )
);
```

### 9.2 React Query Integration

Server state (bookings, payments, user profile) uses React Query:

```typescript
// hooks/useBooking.ts
export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`),
    enabled: !!bookingId,
    refetchInterval: (data) =>
      data?.paymentStatus === 'PENDING' ? 5000 : false,
  });
}
```

---

## 10. Custom Hooks

### 10.1 `useDraggableResizable`

Core hook for Chat Panel drag and resize. Uses refs and RAF to avoid React re-renders during operations.

- All position/size state lives in refs, not React state.
- `mousedown` / `touchstart` on header → drag mode
- `mousedown` / `touchstart` on resize handle → resize mode
- `mousemove` / `touchmove` → update CSS `transform` and `width/height` directly on DOM node via RAF
- `mouseup` / `touchend` → calculate snap, call `onChange()`, update React state once
- Keyboard: Arrow keys → move 10px, Shift+Arrow → resize 10px

### 10.2 `useWebSocket`

Extended WebSocket hook with auto-reconnect and message queue.

- Exponential backoff: 1s → 2s → 4s → 8s → max 30s
- Messages sent while disconnected are queued in a ref and flushed on reconnect
- Queue persists in `localStorage` (max 100 messages)

### 10.3 `useContentRouter`

Routes incoming WebSocket messages to the correct store actions. Bridge between WebSocket messages and UI state.

Handles: `typing_start`, `typing_end`, `agent_message`, `agent_stream_chunk`, `payment_status`, `booking_hold_expiry`, `error`.

### 10.4 `useContentRenderer`

Maps `ContentType` to lazy-loaded renderer component. Performs ingestion-time Zod validation.

---

## 11. Content Renderers

### 11.1 Renderer Registry

All renderers are lazy-loaded for code splitting. Each has a Zod schema.

```typescript
// lib/vibe-booking/content-registry.ts

export const CONTENT_REGISTRY = {
  trip_cards:       { renderer: lazy(() => import('./renderers/TripCards')),       schema: TripCardsSchema },
  hotel_cards:      { renderer: lazy(() => import('./renderers/HotelCards')),      schema: HotelCardsSchema },
  transport_options:{ renderer: lazy(() => import('./renderers/TransportOptions')),schema: TransportOptionsSchema },
  itinerary:        { renderer: lazy(() => import('./renderers/Itinerary')),        schema: ItinerarySchema },
  map_view:         { renderer: lazy(() => import('./renderers/MapView')),         schema: MapViewSchema },
  budget_estimate:  { renderer: lazy(() => import('./renderers/BudgetEstimate')),  schema: BudgetEstimateSchema },
  qr_payment:       { renderer: lazy(() => import('./renderers/QRPayment')),       schema: QRPaymentSchema },
  booking_confirmed:{ renderer: lazy(() => import('./renderers/BookingConfirmed')),schema: BookingConfirmedSchema },
  payment_status:   { renderer: lazy(() => import('./renderers/PaymentStatus')),   schema: PaymentStatusSchema },
  weather:          { renderer: lazy(() => import('./renderers/Weather')),         schema: WeatherSchema },
  comparison:       { renderer: lazy(() => import('./renderers/Comparison')),      schema: ComparisonSchema },
  image_gallery:    { renderer: lazy(() => import('./renderers/ImageGallery')),    schema: ImageGallerySchema },
  text_summary:     { renderer: lazy(() => import('./renderers/TextSummary')),     schema: TextSummarySchema },
  booking_summary:  { renderer: lazy(() => import('./renderers/BookingSummary')),  schema: BookingSummarySchema },
} as const;
```

### 11.2 Content Stage Dual Modes

**Discovery Mode (Multiple Items Stacked):**
- New content appends to the bottom
- `metadata.replace: true` replaces items of the same type
- Items are scrollable within the Content Stage
- Each item has a dismiss button

**Booking Flow Mode (Single Item with Transition):**
- Uses `AnimatePresence` for enter/exit animations
- Previous content slides out, new content slides in
- Booking flow items have `metadata.replace: true`
- Transition: `initial={{ x: 100 }}` → `animate={{ x: 0 }}` → `exit={{ x: -100 }}`

---

## 12. Payment Flow (Human-in-the-Loop)

```
AI Agent ──create_booking_hold──► Backend → booking_id (RESERVED, 15-min hold)
AI Agent ──► Frontend WS: { type: "requires_payment", booking_id, amount_usd, methods }
Frontend ──renders Booking Summary Card on Content Stage
User ──clicks "Confirm Booking"
Frontend ──renders Payment UI (Stripe Elements / Bakong QR) on Content Stage
Frontend ──calls payment API + polls GET /v1/bookings/{booking_id} (or listens WS payment_status)
Backend ──► Frontend: payment confirmed
Frontend ──► AI Agent WS: { type: "payment_completed", booking_id }
AI Agent ──► Frontend WS: agent_message with booking_confirmed content_payload
Content Stage ──► Booking Confirmed card (reference, QR, receipt, calendar)
```

---

## 13. AI Conversation Flow Design

### 13.1 Intent Detection & Tool Filtering

The AI classifies each user message into an **Intent Category** before deciding which tools to call.

| Intent | Example | Relevant Tools | Content Stage |
|--------|---------|----------------|---------------|
| `hotel_search` | "Hotel near me" | `search_hotels`, `check_availability` | Hotel cards + map |
| `trip_search` | "3-day temple tour" | `search_trips`, `search_guides`, `search_transport` | Trip cards |
| `transport_search` | "Van from PP to SR" | `search_transport` | Transport comparison |
| `guide_search` | "English guide in Battambang" | `search_guides` | Guide profiles |
| `booking_request` | "Book this hotel" | `check_availability`, `create_booking_hold` | Booking summary |
| `payment_check` | "Is my payment done?" | `check_payment_status` | Payment status card |
| `budget_estimate` | "How much for 5 days?" | `estimate_budget` | Budget breakdown |
| `general_info` | "What's the weather?" | `get_weather` | Weather widget |
| `emergency` | "Help!" | `get_emergency_contacts`, `send_sos_alert` | Emergency contacts |

**Tool Filtering Rules:**
1. Only tools relevant to the detected intent are eligible.
2. `create_booking_hold` is ONLY called after explicit user confirmation.
3. `send_sos_alert` is ONLY available when intent is `emergency`.

### 13.2 Context-Aware Tool Selection

The AI maintains a **Context Stack** to prevent irrelevant suggestions:

```python
# In ConversationState.context
{
    "currentIntent": "hotel_search",
    "activeHotelId": "hotel_001",
    "activeTripId": None,
    "activeBookingId": None,
    "userLocation": { "lat": 11.5564, "lng": 104.9282, "address": "Toul Tom Poung, Phnom Penh" },
    "lastToolCall": "search_hotels",
    "searchFilters": { "priceMin": 50, "priceMax": 150, "ratingMin": 4.0 }
}
```

---

## 14. Configuration

### 14.1 AI Agent (`vibe-booking/src/config/settings.py`)

```python
class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"

    # LLM
    NVIDIA_API_KEY: str
    NVIDIA_MODEL: str = "gpt-oss-120b"

    # Backend
    BACKEND_URL: str = "http://backend:3001"
    AI_SERVICE_KEY: str  # min 32 chars

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Monitoring
    SENTRY_DSN: str | None = None

    class Config:
        env_file = ".env"
```

### 14.2 Frontend Environment

```
NEXT_PUBLIC_AI_AGENT_URL=ws://localhost:8000/ws/chat
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

## 15. Docker / Deployment

### 15.1 docker-compose.yml (ai-agent service)

```yaml
ai-agent:
  build:
    context: ./vibe-booking
    dockerfile: Dockerfile.dev
  container_name: derlg-ai-agent
  environment:
    NVIDIA_API_KEY: ${NVIDIA_API_KEY}
    BACKEND_URL: http://backend:3001
    AI_SERVICE_KEY: ${AI_SERVICE_KEY}
    REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
    HOST: 0.0.0.0
    PORT: 8000
    LOG_LEVEL: debug
  ports:
    - "8000:8000"
  volumes:
    - ./vibe-booking:/app
    - /app/__pycache__
  depends_on:
    redis:
      condition: service_healthy
    backend:
      condition: service_started
  command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
  networks:
    - derlg-network
```

### 15.2 Production Dockerfile

```dockerfile
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

## 16. Error Handling

### 16.1 AI Agent Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid JWT on connect | Close WebSocket with code 1008 |
| Tool call timeout (>15s) | Return error result, continue conversation |
| Model API timeout (>60s) | Retry once, then send user-friendly error |
| Backend circuit open (5+ failures) | Inform user, suggest retry later |
| Redis unavailable | Log error, attempt reconnect; degrade gracefully |
| Unhandled exception | Log with stack trace, send sanitized error to client |

### 16.2 Frontend Error Handling

| Scenario | Behavior |
|----------|----------|
| Unknown content type | Render `TextSummaryRenderer` fallback |
| Zod validation fail | Log error, render `ContentError` card |
| Connection lost | Show "Reconnecting..." banner; queue messages |
| Reconnect success | Flush queued messages; restore session |
| Reconnect fail | Show "Connection lost" with manual retry button |
| Payment API timeout | Show retryable error; preserve form state |
| Booking hold expiry | Show expiry notice with "Restart Booking" button |

---

## 17. Monitoring

- **Health check:** `GET /health` → `{ status: "healthy", uptime_seconds: N }`
- **Metrics:** `GET /metrics` (Prometheus format)
  - `ai_agent_active_connections`
  - `ai_agent_messages_total{status}`
  - `ai_agent_tool_calls_total{tool_name}`
  - `ai_agent_response_time_seconds{quantile}`
- **Logging:** structlog JSON to stdout
- **Error tracking:** Sentry (via `SENTRY_DSN`)

---

## 18. Security Checklist

| Requirement | Implementation |
|-------------|---------------|
| Service key auth | `X-Service-Key` header, min 32 chars, validated on startup |
| JWT validation | Bearer JWT on every WebSocket connection |
| Rate limiting | 10 messages/minute per session (Redis counter) |
| Input sanitization | Strip + basic XSS filtering on agent; DOMPurify on frontend |
| No secrets in logs | JWT tokens and payment details redacted |
| WSS in production | `wss://` enforced when `NODE_ENV=production` |
| localStorage namespacing | All keys prefixed with `derlg:` |
| QR expiry overlay | CSS `::after` pseudo-element with countdown |

---

## 19. Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Drag/Resize FPS | 60fps |
| Content History Scroll | 60fps at 100 items |
| Bundle Size (vibe-booking route) | < 150KB gzipped |
| AI Agent response time (p50) | < 3s |
| AI Agent response time (p99) | < 10s |

---

*Reference: `docs/platform/architecture/realtime-and-ai.md`, `docs/product/prd.md`*
