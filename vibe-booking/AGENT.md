# Vibe Booking AI Agent — Agent Guide

> **Layer:** Python AI Agent Service
> **Directory:** `vibe-booking/`
> **Framework:** FastAPI + hand-rolled async tool loop + NVIDIA gpt-oss-120b
> **Port:** 8001
> **Protocol:** WebSocket (`/ws/chat`) + HTTP tools to backend

---

## What This Layer Does

The Vibe Booking AI Agent is a **stateful, purpose-built conversational booking concierge** implemented as a Python FastAPI microservice. It is DerLg's core differentiator.

**It is NOT a general-purpose chatbot.** It is designed exclusively for Cambodia travel booking. Every fact (price, availability, hotel name) comes from backend tool calls — the agent never invents data.

### Responsibilities
- Orchestrate booking journeys via an async tool loop (search → compose → book → pay)
- Communicate with travelers via WebSocket (real-time bidirectional)
- Call backend tool endpoints (`/v1/ai-tools/*`) to fetch data and perform actions
- Format structured JSON responses for frontend auto-rendering
- Manage persistent sessions in Redis (7-day TTL)
- Support multi-language responses (EN, ZH, KM)
- Compose and save custom trips from hotel + guide + transport + extras (server-side pricing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  WebSocket Handler (/ws/chat)  Health  Metrics              │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Agent Core                              │
│  run_agent() → async tool loop → system prompt builder      │
│     │              call_llm ──► execute_tools ──► format     │
│     │                ▲─────────────────────────────┘        │
│     └──────────────────────────────────────────────────────┘
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  Model   │     │  Tool    │     │ Session  │
  │  Layer   │     │  Layer   │     │  Layer   │
  │(NVIDIA   │     │ 15 tools │     │(Redis   │
  │ gpt-oss- │     │ → NestJS)│     │ checkpt) │
  │ 120b)    │     │          │     │          │
  └──────────┘     └──────────┘     └──────────┘
```

### Module Organization

```
vibe-booking/
├── agent/
│   ├── core.py              # Agent execution loop (run_agent, run_agent_streaming)
│   ├── backend_client.py    # HTTP client to backend /v1/ai-tools/* (circuit breaker, 15s timeout)
│   ├── messages.py          # Message type definitions
│   ├── blurbs.py            # Card blurb generation
│   ├── suggestions.py       # Follow-up suggestion generation
│   ├── models/
│   │   ├── client.py        # ModelClient abstract interface
│   │   ├── nvidia.py        # NvidiaClient — default LLM client (gpt-oss-120b)
│   │   ├── ollama.py        # OllamaClient — local model fallback
│   │   └── factory.py       # Model client factory
│   ├── tools/
│   │   └── _defs.py         # 15 tool schemas + TOOL_DISPATCH map
│   ├── prompts/
│   │   ├── builder.py       # build_system_prompt() — dynamic by state
│   │   └── templates.py     # System prompt templates (ANSWER STYLE, CUSTOM TRIPS, etc.)
│   ├── session/
│   │   ├── manager.py       # SessionManager (Redis CRUD)
│   │   └── state.py         # ConversationState Pydantic model
│   └── utils/
│       └── ...
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
│   ├── unit/                # Tool handlers, prompts, models, side effects
│   ├── integration/         # WebSocket flow, tool execution, payment events
│   └── property/            # Round-trip serialization, schema validation
├── main.py                  # FastAPI entry point
├── requirements.txt         # Pinned Python dependencies
└── .env                     # Environment variables (gitignored)
```

---

## Tool System

### Tool Definitions (`agent/tools/_defs.py`)
All 15 tools are defined as JSON schemas in OpenAI-compatible tool calling format. Each schema includes a description, required parameters, and type constraints.

### Tool List

| Tool | Purpose | Backend Endpoint |
|------|---------|-----------------|
| `search_trips` | Search trips by mood, budget, duration | `POST ai-tools/search/trips` |
| `search_hotels` | Search hotels by city, price, type | `GET ai-tools/hotels` |
| `search_guides` | Search guides by language, specialty, location | `GET ai-tools/guides` |
| `search_transport` | Search transport by mode, tier, subtype | `GET ai-tools/search/transport` |
| `check_availability` | Check resource availability for dates | `GET ai-tools/availability` |
| `create_trip` | Compose and save a custom trip (server-priced) | `POST ai-tools/trips` |
| `create_booking_hold` | Create a booking with HOLD status | `POST ai-tools/bookings` |
| `check_payment_status` | Check payment intent status | `GET ai-tools/payments/status` |
| `generate_payment_qr` | Generate QR payment intent | `POST ai-tools/payments/qr` |
| `estimate_budget` | Estimate trip cost breakdown | `POST ai-tools/budget/estimate` |
| `get_weather` | Get weather forecast | `GET ai-tools/weather` |
| `get_emergency_contacts` | Get emergency contacts | `GET ai-tools/emergency-contacts` |
| `send_sos_alert` | Send SOS alert | `POST ai-tools/sos` |
| `get_user_loyalty` | Get user loyalty points | `GET ai-tools/loyalty` |
| `get_trip_detail` | Get trip details | `GET trips/{trip_id}` |
| `get_hotel_detail` | Get hotel details | `GET ai-tools/hotels` |

### Tool Dispatch
Tools are dispatched via `TOOL_DISPATCH` map in `_defs.py`: tool name → (HTTP method, backend path). The dispatch path must match `ai-tools.controller.ts` exactly.

### Tool Execution
- Parallel execution via `asyncio.gather` when the LLM returns multiple `tool_use` blocks
- Timeout: 15 seconds per tool request
- Backend auth: `X-Service-Key` header + `Accept-Language` header
- Circuit breaker: opens after 5 failures for 60s
- Error handling: catch exceptions → generic error response → continue conversation

---

## WebSocket Protocol

### Connection
```
Client ──ws://localhost:8001/ws/chat──▶ AI Agent
```

### Client → Server Messages
```typescript
// Auth (first message)
{ type: "auth", user_id: "uuid", session_id: "uuid", preferred_language: "EN" | "ZH" | "KM" }

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

// Streaming reasoning (gpt-oss-120b reasoning_content)
{ type: "agent_reasoning_chunk", delta: "..." }

// Tool execution status
{ type: "agent_tool_status", tool_use_id: "...", tool_name: "...", status: "running" | "done" }

// Final agent response
{ type: "agent_message", text: "...", content_payloads: [...], suggestions: [...] }

// Error (structured, retryable)
{ type: "error", code: "AGENT_INTERNAL_ERROR", message: "...", retryable: true }
```

---

## Response Formatting

The `text` field in `agent_message` is the raw model output (Markdown-formatted per the system prompt). The frontend renders it with react-markdown.

The `content_payloads` field contains typed blocks that the frontend auto-renders:

| Block Type | What It Shows |
|-----------|---------------|
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
| `text_summary` | Fallback text |

---

## Session Management

### ConversationState Model (`agent/session/state.py`)
```python
class ConversationState(BaseModel):
    session_id: str
    user_id: str
    is_authenticated: bool
    messages: list[dict]  # OpenAI-compatible format
    preferred_language: str  # "EN" | "KH" | "ZH"
    last_active: datetime
    created_at: datetime
```

### Redis Persistence
- Key format: `session:{session_id}`
- TTL: 7 days (604800 seconds)
- Messages capped at 60
- State saved after every turn

---

## Multi-Language Support

| Language | Code | Behavior |
|----------|------|----------|
| English | `EN` | Default |
| Khmer | `KM` | Always uses NVIDIA (best Khmer support) |
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
| Input sanitization | All user input sanitized |
| Sensitive data | `user_id`, `booking_id`, `payment_intent_id` never logged in plain text |
| Booking cap | $5,000 USD per transaction |

---

## Error Handling & Resilience

| Scenario | Behavior |
|----------|----------|
| Model API timeout (90s) | Retry once with exponential backoff → user-friendly error with cause |
| Tool call timeout (15s) | Return error response → continue conversation |
| Redis connection failure | Log error → attempt reconnection with backoff |
| Backend unavailable | Circuit breaker (open after 5 failures, half-open after 30s) |
| WebSocket disconnect | Save session → remove from active connections |
| Streaming failure | Fall back to non-streaming (graceful degradation) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NVIDIA_API_KEY` | yes | NVIDIA NIM API key |
| `MODEL_LLM` | no | Default: `openai/gpt-oss-120b` |
| `MODEL_TIMEOUT_S` | no | Default: 90 (gpt-oss-120b is slow on free tier) |
| `BACKEND_URL` | yes | NestJS backend base URL |
| `AI_SERVICE_KEY` | yes | 32+ char secret for backend auth |
| `REDIS_URL` | yes | Redis connection string |
| `JWT_SECRET` | no | Must equal backend JWT_ACCESS_SECRET for signed-in chat |
| `ALLOWED_WS_ORIGINS` | no | Comma-separated WebSocket origins |

---

## Development Workflow

### Local
```bash
cd vibe-booking
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
env -u NVIDIA_API_KEY uvicorn main:app --host 0.0.0.0 --port 8001
```

> **Run without `--reload`** — the reloader hangs on slow in-flight LLM calls.
> **Unset NVIDIA_API_KEY** — a shell-exported key shadows `.env` and causes 403s.

### Running tests
```bash
pytest                          # All tests
pytest tests/unit/              # Unit only
pytest --cov=agent --cov-report=html  # With coverage
```

---

## Integration Points

### With Frontend (Next.js)
- **Protocol:** WebSocket at `/ws/chat`
- **Auth:** JWT Bearer token in connection header
- **Message format:** JSON with `type` field
- **Auto-render:** AI sends `content_payloads`; frontend routes to renderer
- **Markdown:** AI sends Markdown in `text`; frontend renders with react-markdown

### With Backend (NestJS)
- **Protocol:** HTTP (`httpx.AsyncClient`)
- **Base URL:** `{BACKEND_URL}/v1/ai-tools/{endpoint}`
- **Auth:** `X-Service-Key: {AI_SERVICE_KEY}`
- **Language:** `Accept-Language: {preferred_language}`
- **Timeout:** 15 seconds

### With Redis
- **Session store:** Key-value with 7-day TTL
- **Pub/Sub:** `payment_events:{user_id}` channel for payment notifications

---

## Agent Conventions

1. **Never invent data.** All facts come from backend tool calls.
2. **Always confirm before booking.** `create_booking_hold` only after explicit user confirmation.
3. **Khmer = NVIDIA.** When `preferred_language == "KM"`, always use NvidiaClient.
4. **JSON only to frontend.** Never send HTML/JSX. Send structured `content_payload`.
5. **Parallel tools.** Execute multiple tool calls concurrently with `asyncio.gather`.
6. **Limit context window.** Pass last 20 messages to model; max 5 tool call loops.
7. **Sanitize errors.** Never expose stack traces or internal details to users.
8. **Log structured.** Use `structlog` for JSON logs; include token counts and latency.
9. **Test everything.** 80%+ coverage; mock all external dependencies.
