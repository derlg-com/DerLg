# Vibe Booking AI Agent — Agent Guide

> **Layer:** Python AI Agent Service  
> **Directory:** `vibe-booking/`  
> **Framework:** FastAPI + LangGraph + NVIDIA gpt-oss-120b (default) / Ollama fallback  
> **Port:** 8000  
> **Protocol:** WebSocket (`/ws/{session_id}`) + HTTP tools to backend

---

## What This Layer Does

The Vibe Booking AI Agent is a **stateful, purpose-built conversational booking concierge** implemented as a Python FastAPI microservice. It is DerLg's core differentiator.

**It is NOT a general-purpose chatbot.** It is designed exclusively for Cambodia travel booking, with strict rules about data accuracy, state management, and controlled side effects. Every fact (price, availability, hotel name) comes from backend tool calls — the agent never invents data.

### Responsibilities
- Orchestrate 7-stage booking journeys via LangGraph state machine
- Communicate with travelers via WebSocket (real-time bidirectional)
- Call backend tool endpoints (`/v1/ai-tools/*`) to fetch data and perform actions
- Format structured JSON responses for frontend auto-rendering
- Manage persistent sessions in Redis (7-day TTL)
- Listen for payment events via Redis pub/sub
- Support multi-language responses (EN, ZH, KM)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  WebSocket Handler (/ws/{session_id})  Health  Metrics      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Agent Core                              │
│  run_agent() → LangGraph StateGraph → System Prompt Builder │
│     │              call_llm ──► execute_tools ──► format    │
│     │                ▲─────────────────────────────┘        │
│     └───────────────────────────────────────────────────────┘
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  Model   │     │  Tool    │     │ Session  │
  │  Layer   │     │  Layer   │     │  Layer   │
  │(NVIDIA gpt-oss-120b /           │     │(20 tools │     │(Redis   │
  │ Ollama)  │     │ → NestJS)│     │ checkpt) │
  └──────────┘     └──────────┘     └──────────┘
```

### Module Organization

```
vibe-booking/
├── agent/
│   ├── core.py              # Agent execution loop (run_agent)
│   ├── graph.py             # LangGraph StateGraph definition
│   ├── models/
│   │   ├── client.py        # ModelClient abstract interface
│   │   ├── nvidia.py        # NvidiaClient — default LLM client (gpt-oss-120b)
│   │   └── ollama.py        # OllamaClient — local model fallback
│   ├── tools/
│   │   ├── schemas.py       # 20 tool schema definitions (JSON for LLM)
│   │   ├── executor.py      # execute_tools_parallel with asyncio.gather
│   │   └── handlers/
│   │       ├── trips.py     # getTripSuggestions, getTripItinerary, etc.
│   │       ├── booking.py   # createBooking, cancelBooking, modifyBooking
│   │       ├── payment.py   # generatePaymentQR, checkPaymentStatus
│   │       └── info.py      # getWeatherForecast, getPlaces, estimateBudget
│   ├── prompts/
│   │   ├── builder.py       # build_system_prompt() — dynamic by state
│   │   └── templates.py     # Stage-specific prompt templates
│   ├── session/
│   │   ├── manager.py       # SessionManager (Redis CRUD)
│   │   └── state.py         # ConversationState Pydantic model
│   └── formatters/
│       ├── formatter.py     # format_response() — tool result → frontend message
│       └── message_types.py # Pydantic models for all frontend message types
├── api/
│   ├── websocket.py         # WebSocket endpoint, auth, message handling
│   ├── health.py            # GET /health
│   └── middleware.py        # CORS, logging, exception handlers
├── config/
│   └── settings.py          # Pydantic BaseSettings, env validation
├── utils/
│   ├── logging.py           # structlog setup
│   └── redis.py             # Redis connection lifecycle
├── tests/
│   ├── unit/                # Tool handlers, prompts, formatters, side effects
│   ├── integration/         # WebSocket flow, tool execution, payment events
│   └── property/            # Round-trip serialization, schema validation
├── main.py                  # FastAPI entry point
├── requirements.txt         # Pinned Python dependencies
├── Dockerfile               # Multi-stage production build
├── Dockerfile.dev           # Hot-reload development build
└── docker-compose.yml       # Local orchestration (with backend, redis, postgres)
```

---

## LangGraph State Machine

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                   ┌─────────────┐
         ┌─────────│  DISCOVERY  │─────────┐
         │         │ (ask Qs)    │         │
         │         └──────┬──────┘         │
         │                │                │
         ▼                ▼                ▼
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ SUGGESTION  │  │ EXPLORATION │  │ CUSTOMIZATION│
  │(show cards) │◄─┤ (details)   │◄─┤ (modify)    │
  └──────┬──────┘  └─────────────┘  └─────────────┘
         │
         ▼
  ┌─────────────┐
  │   BOOKING   │
  │ (confirm)   │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │   PAYMENT   │
  │ (QR/monitor)│
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ POST_BOOKING│
  │(confirmed)  │
  └─────────────┘
```

### State Transitions
- `DISCOVERY` → gather 6 required fields before calling `getTripSuggestions`
- `SUGGESTION` → present trip options, guide selection
- `EXPLORATION` → answer questions, provide details
- `CUSTOMIZATION` → discuss modifications, calculate pricing
- `BOOKING` → 3-step flow: summary → confirmation → collect details
- `PAYMENT` → generate QR, monitor payment status
- `POST_BOOKING` → confirmation, next steps, receipts

### Side Effects (Session Mutation)
| Event | Session Update |
|-------|---------------|
| `getTripSuggestions` succeeds | `suggested_trip_ids` populated |
| `createBooking` succeeds | `booking_id`, `booking_ref`, `reserved_until` set; state → `PAYMENT` |
| `generatePaymentQR` succeeds | `payment_intent_id` set |
| `checkPaymentStatus` → "SUCCEEDED" | `payment_status` → "CONFIRMED"; state → `POST_BOOKING` |
| `cancelBooking` succeeds | Clear booking fields; state → `DISCOVERY` |
| Booking hold expires | Clear booking fields; state → `BOOKING`; notify user |

---

## Tool System

### Tool Schema Definitions (`agent/tools/schemas.py`)
All 20 tools are defined as JSON schemas in OpenAI-compatible tool calling format. Each schema includes:
- Detailed description (when to call)
- Required parameters
- Type constraints

### Tool List

| Tool | Purpose | Backend Endpoint |
|------|---------|-----------------|
| `getTripSuggestions` | Search trips by mood, budget, duration | `POST /v1/ai-tools/search/trips` |
| `getTripItinerary` | Get day-by-day plan for a trip | `POST /v1/ai-tools/search/itinerary` |
| `getTripImages` | Get photo gallery for a trip | `POST /v1/ai-tools/search/images` |
| `getHotelDetails` | Get hotel info by ID | `POST /v1/ai-tools/search/hotels` |
| `getWeatherForecast` | Get 5-day forecast for destination | `POST /v1/ai-tools/search/weather` |
| `compareTrips` | Compare up to 3 trips side-by-side | `POST /v1/ai-tools/search/compare` |
| `calculateCustomTrip` | Calculate price for customizations | `POST /v1/ai-tools/search/custom` |
| `customizeTrip` | Apply customizations to a trip | `POST /v1/ai-tools/search/customize` |
| `applyDiscountCode` | Apply discount to booking | `POST /v1/ai-tools/discounts/apply` |
| `validateUserDetails` | Validate name, phone, email | `POST /v1/ai-tools/users/validate` |
| `createBooking` | Create booking with HOLD status | `POST /v1/ai-tools/bookings` |
| `generatePaymentQR` | Generate QR payment intent | `POST /v1/ai-tools/payments/qr` |
| `checkPaymentStatus` | Check payment intent status | `POST /v1/ai-tools/payments/status` |
| `cancelBooking` | Cancel a booking | `POST /v1/ai-tools/bookings/cancel` |
| `modifyBooking` | Modify booking details | `POST /v1/ai-tools/bookings/modify` |
| `getPlaces` | Get places by category/region | `POST /v1/ai-tools/search/places` |
| `getUpcomingFestivals` | Get festivals by date range | `POST /v1/ai-tools/search/festivals` |
| `estimateBudget` | Estimate trip cost breakdown | `POST /v1/ai-tools/budget/estimate` |
| `getCurrencyRates` | Get exchange rates | `POST /v1/ai-tools/currency/rates` |
| `getTransportOptions` | Get transport between locations | `POST /v1/ai-tools/search/transport` |

### Tool Execution
- Parallel execution via `asyncio.gather` when the LLM returns multiple `tool_use` blocks
- Timeout: 15 seconds per tool request
- Backend auth: `X-Service-Key` header + `Accept-Language` header
- Error handling: catch exceptions → generic error response → continue conversation

---

## WebSocket Protocol

### Connection
```
Client ──wss://ai.derlg.com/ws/{session_id}──▶ AI Service
Headers:
  Authorization: Bearer <user_jwt>
```

### Client → Server Messages

```typescript
// Auth (first message)
{ type: "auth", user_id: "uuid", preferred_language: "EN" | "ZH" | "KM" }

// User text message
{ type: "user_message", content: "3-day temple tour in Siem Reap" }

// Action from content interaction
{ type: "user_action", action_type: "book_trip", item_id: "...", payload: {} }

// Location sharing
{ type: "location", lat: 13.3615, lng: 103.8606 }
```

### Server → Client Messages

```typescript
// Typing indicators
{ type: "typing_start" }
{ type: "typing_end" }

// Agent response (triggers auto-render on frontend)
{
  type: "agent_message",
  text: "I found 2 incredible temple tours...",
  content_payload: {
    type: "trip_cards",
    data: { trips: [...] },
    actions: [...],
    metadata: { title: "...", replace: true }
  },
  state: "SUGGESTION"
}

// Payment status push
{ type: "payment_status", payload: { status: "SUCCEEDED", ... } }

// Booking hold expiry warning
{ type: "booking_hold_expiry", payload: { secondsRemaining: 120 } }

// Error
{ type: "error", payload: { message: "..." } }
```

---

## Response Formatting System

The `format_response()` function analyzes tool results and returns structured frontend messages:

| Tool Result Contains | Frontend Message Type |
|---------------------|----------------------|
| `"trips"` array | `TripCardsMessage` |
| `"qr_code_url"` | `QRPaymentMessage` |
| Payment success + POST_BOOKING | `BookingConfirmedMessage` |
| `"forecast"` | `WeatherMessage` |
| `"itinerary"` | `ItineraryMessage` |
| `"total_estimate_usd"` | `BudgetEstimateMessage` |
| Exactly 2 trips | `ComparisonMessage` |
| `"images"` array | `ImageGalleryMessage` |
| Default | `TextMessage` |

**Rule:** The AI agent never sends HTML, JSX, or rendered markup. It sends structured JSON. The frontend owns all rendering logic.

---

## Session Management

### ConversationState Model
```python
class ConversationState(BaseModel):
    session_id: str
    user_id: str
    state: AgentState  # Enum of 7 stages
    messages: list[dict]  # OpenAI-compatible format
    preferred_language: str  # "EN" | "KH" | "ZH"
    suggested_trip_ids: list[str]
    selected_trip_id: str
    selected_trip_name: str
    booking_id: str
    booking_ref: str
    reserved_until: datetime
    payment_intent_id: str
    payment_status: str
    last_active: datetime
    created_at: datetime
```

### Redis Persistence
- Key format: `session:{session_id}`
- TTL: 7 days (604,800 seconds)
- LangGraph checkpointer: `RedisSaver`
- State saved after every node execution
- On load: check for expired booking holds, recover state

---

## Multi-Language Support

| Language | Code | Behavior |
|----------|------|----------|
| English | `EN` | Default; NVIDIA gpt-oss-120b responds in English |
| Khmer | `KM` | **Always uses NvidiaClient** (best Khmer support); proper font fallback |
| Chinese (Simplified) | `ZH` | NVIDIA gpt-oss-120b responds in Simplified Chinese |

- `preferred_language` set via WebSocket auth message
- Passed to backend in `Accept-Language` header
- Included in system prompt for LLM instruction

---

## Security

| Control | Implementation |
|---------|---------------|
| Backend auth | `X-Service-Key` header (32+ chars), validated on startup |
| User auth | `user_id` required in WebSocket auth message before processing |
| Session validation | `session_id` must be UUID format |
| Rate limiting | 10 messages/minute per session (Redis-backed) |
| Input sanitization | All user input sanitized to prevent injection |
| TLS | `wss://` for WebSocket, `rediss://` for Redis |
| Sensitive data | `user_id`, `booking_id`, `payment_intent_id` never logged in plain text |
| Booking cap | $5,000 USD per transaction (human approval above) |

---

## Error Handling & Resilience

| Scenario | Behavior |
|----------|----------|
| Model API timeout (60s) | Retry once with exponential backoff → user-friendly error |
| Tool call timeout (15s) | Return error response → continue conversation |
| Redis connection failure | Log error → attempt reconnection with backoff |
| Backend unavailable | Circuit breaker (open after 5 failures, half-open after 30s) |
| WebSocket disconnect | Save session → remove from active connections |
| Invalid tool input | Validate before backend call → return validation error |
| Unknown content_type | Fallback to `text_summary` → log warning |
| Zod validation fails | Render `ContentError` with retry button |

---

## Testing

### Test Structure
```
tests/
├── unit/
│   ├── test_tool_handlers.py      # All 20 tools with mocked backend
│   ├── test_prompt_builder.py     # All 7 states × 3 languages
│   ├── test_response_formatter.py # All message types
│   └── test_session_side_effects.py
├── integration/
│   ├── test_websocket_flow.py
│   ├── test_tool_execution.py
│   ├── test_payment_events.py
│   └── test_state_machine.py
└── property/
    ├── test_state_roundtrip.py    # parse(format(x)) == x
    └── test_schema_validation.py
```

### Requirements
- **Coverage:** Minimum 80%
- **Framework:** pytest + pytest-asyncio
- **Mocking:** NVIDIA API, backend API, Redis
- **Property tests:** Hypothesis library

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MODEL_BACKEND` | Yes | `"nvidia"` (default) or `"ollama"` |
| `NVIDIA_API_KEY` | Yes* | NVIDIA API key (default; required unless using Ollama) |
| `OLLAMA_BASE_URL` | Yes* | Ollama server URL (required when MODEL_BACKEND=ollama) |
| `BACKEND_URL` | Yes | NestJS backend base URL (e.g., `http://backend:3001`) |
| `AI_SERVICE_KEY` | Yes | 32+ character service key for backend auth |
| `REDIS_URL` | Yes | Redis connection string |
| `HOST` | No | Default `0.0.0.0` |
| `PORT` | No | Default `8000` |
| `LOG_LEVEL` | No | Default `info` |
| `SENTRY_DSN` | No | Sentry error tracking |

### Startup Validation
- All required env vars checked on startup
- `AI_SERVICE_KEY` length validated (≥32 chars)
- Fail fast with clear error message if config missing

---

## Development Workflow

### Local (Docker Compose)
```bash
# From project root
docker-compose up
# Services: postgres (5432), redis (6379), backend (3001), ai-agent (8000), frontend (3000)
```

### Direct Python
```bash
cd vibe-booking
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Running Tests
```bash
pytest                          # All tests
pytest tests/unit/             # Unit only
pytest --cov=agent --cov-report=html  # With coverage
```

---

## Integration Points

### With Frontend (Next.js)
- **Protocol:** WebSocket at `/ws/{session_id}`
- **Auth:** JWT Bearer token in connection header
- **Message format:** JSON with `type` field
- **Auto-render:** AI sends `content_payload`; frontend routes to renderer

### With Backend (NestJS)
- **Protocol:** HTTP (`httpx.AsyncClient`)
- **Base URL:** `{BACKEND_URL}/v1/ai-tools/{endpoint}`
- **Auth:** `X-Service-Key: {AI_SERVICE_KEY}`
- **Language:** `Accept-Language: {preferred_language}`
- **Timeout:** 15 seconds

### With Redis
- **Session store:** Key-value with 7-day TTL
- **Pub/Sub:** `payment_events:{user_id}` channel for payment notifications
- **Checkpointer:** LangGraph `RedisSaver` for state persistence

---

## Agent Conventions

1. **Never invent data.** All facts come from backend tool calls.
2. **Always confirm before booking.** `createBooking` only after explicit user confirmation.
3. **Khmer = NVIDIA.** When `preferred_language == "KM"`, always use NvidiaClient.
4. **State drives behavior.** System prompt includes stage-specific instructions based on `session.state`.
5. **JSON only to frontend.** Never send HTML/JSX. Send structured `content_payload`.
6. **Parallel tools.** Execute multiple tool calls concurrently with `asyncio.gather`.
7. **Limit context window.** Pass last 20 messages to model; max 5 tool call loops.
8. **Sanitize errors.** Never expose stack traces or internal details to users.
9. **Log structured.** Use `structlog` for JSON logs; include token counts and latency.
10. **Test everything.** 80%+ coverage; mock all external dependencies.

---

## Related Documentation

| Document | Path |
|----------|------|
| Feature Requirements | `docs/modules/vibe-booking/requirements.md` |
| System Architecture | `docs/modules/vibe-booking/architecture.md` |
| AI Agent Requirements | `.kiro/specs/vibe-booking/requirements.md` |
| AI Agent Design | `.kiro/specs/vibe-booking/design.md` |
| Implementation Tasks | `.kiro/specs/vibe-booking/tasks.md` |
| Frontend Requirements | `.kiro/specs/vibe-booking-frontend/requirements.md` |
| Frontend Design | `.kiro/specs/vibe-booking-frontend/design.md` |
| Auto-Render Architecture | `.kiro/specs/vibe-booking-frontend/auto-render-system-design.md` |
| Research Synthesis | `.kiro/specs/vibe-booking-frontend/vibe_booking_researched.md` |

---

*Last updated: 2026-05-14*
