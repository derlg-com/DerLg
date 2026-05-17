# Design: Vibe Booking — AI Travel Concierge (AI Agent Service)

> **Source of truth:** `.kiro/specs/vibe-booking/design.md` (this file)
> **Service directory:** `vibe-booking/`

---

## Overview

The AI Agent is a Python FastAPI microservice that powers DerLg's "Vibe Booking" feature. It orchestrates a LangGraph + NVIDIA gpt-oss-120b conversation, communicates with the frontend via WebSocket, and calls the NestJS backend via HTTP tool endpoints.

### Core Design Principles

1. **Tool-First Data Access** — The agent never invents facts. All data (prices, availability, hotel names) comes from backend tool calls.
2. **No Direct DB Access** — All mutations go through `/v1/ai-tools/*` endpoints authenticated with `X-Service-Key`.
3. **Human-in-the-Loop Payment** — The agent never executes payments. It sends `requires_payment` to the frontend, which handles the payment UI.
4. **Stateful Sessions** — Active sessions live in Redis (`ai:conv:{user_id}`, 7-day TTL). On disconnect, state is archived to PostgreSQL.
5. **Resilient Messaging** — Exponential backoff reconnection + offline message queue for spotty Cambodian mobile networks.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────┐  │
│  │ Chat UI     │  │ Message     │  │ Offline Queue                   │  │
│  │ (Full-Screen)│  │ Renderer    │  │ (localStorage)                  │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────────────┘  │
│         └────────────────┘                                               │
│                          │                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ WebSocket Manager (connect, reconnect, heartbeat, queue)         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ WebSocket (wss://ai.derlg.com/ws/chat)
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI Agent Service (vibe-booking/)               │
│                         Python FastAPI + LangGraph                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ LangGraph Agent                                                  │   │
│  │ GREETING → DISCOVERY → RECOMMEND → BOOKING → PAYMENT → CONFIRMED │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         ┌────────────────┬────────────────┐                            │
│         ▼                ▼                ▼                            │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                       │
│  │ gpt-oss-120b   │     │ Tool     │     │ Session  │                       │
│  │ (LLM)    │     │ Executor │     │ Store    │                       │
│  └──────────┘     └────┬─────┘     └──────────┘                       │
│                        │ HTTP + X-Service-Key                          │
└────────────────────────┼────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend (NestJS) — /v1/ai-tools/*               │
│  search_hotels  search_trips  search_guides  check_availability         │
│  create_booking_hold  get_weather  get_emergency_contacts               │
│  send_sos_alert  get_user_loyalty                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Module Organization

```
vibe-booking/
├── src/
│   ├── main.py                    # FastAPI app entry point
│   ├── agent/
│   │   ├── state_machine.py       # LangGraph StateGraph definition
│   │   ├── tools.py               # Tool schema definitions + TOOL_DISPATCH
│   │   ├── prompts.py             # System prompt builder (state-aware)
│   │   └── nodes.py               # call_llm, execute_tools, format_response
│   ├── websocket/
│   │   └── chat_handler.py        # WebSocket endpoint + connection manager
│   ├── services/
│   │   ├── gpt-oss-120b_client.py       # NVIDIA API client (ModelClient impl)
│   │   ├── redis_client.py        # Redis connection + session persistence
│   │   └── backend_client.py      # httpx client for /v1/ai-tools/* calls
│   └── models/
│       ├── conversation.py        # ConversationState Pydantic model
│       └── messages.py            # Message type schemas (WS protocol)
└── tests/
    ├── unit/
    ├── integration/
    └── property/
```

---

## WebSocket Protocol

### Connection

```
Client ──wss://ai.derlg.com/ws/chat──▶ AI Agent
Headers:
  Authorization: Bearer <user_jwt>
  X-Session-Id: <session_uuid>   (optional, for multi-session support)
```

### Message Format

```json
// Client → AI
{
  "type": "user_message",
  "conversation_id": "conv_abc123",
  "content": "I want a 3-day temple tour near Siem Reap"
}

// AI → Client (text response)
{
  "type": "agent_message",
  "conversation_id": "conv_abc123",
  "content": "Here are some great options!",
  "suggestions": [
    { "type": "trip", "id": "trip_001", "name": "Angkor Wonder 3-Day", "price_usd": 299 }
  ]
}

// AI → Client (tool execution info)
{
  "type": "tool_call",
  "tool": "search_trips",
  "params": { "destination": "Siem Reap", "duration_days": 3 }
}

// AI → Client (payment handoff)
{
  "type": "requires_payment",
  "booking_id": "booking_456",
  "amount_usd": 299,
  "methods": ["stripe", "bakong"]
}

// Client → AI (after payment)
{
  "type": "payment_completed",
  "booking_id": "booking_456"
}
```

### Heartbeat

```json
// Client → AI (every 30s)
{ "type": "ping" }

// AI → Client
{ "type": "pong", "timestamp": "2026-05-16T09:45:00Z" }
```

---

## LangGraph State Machine

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
| `format_response` | Convert AI text + tool results into typed WS message |

### Edge Conditions

```python
def should_execute_tools(state) -> str:
    if state["model_response"].stop_reason == "tool_use":
        return "execute_tools"
    return "format_response"
```

---

## Conversation State Model

```python
# src/models/conversation.py

from pydantic import BaseModel
from typing import Any

class Message(BaseModel):
    role: str          # "user" | "assistant" | "tool_result"
    content: str | list

class ConversationState(BaseModel):
    messages: list[Message] = []
    user_id: str
    intent: str | None = None          # plan | book | ask | emergency
    pending_tool_calls: list[dict] = []
    last_action: str | None = None
    context: dict[str, Any] = {}       # dates, budget, selected_trip_id, etc.
    preferred_language: str = "en"     # en | zh | km
    booking_id: str | None = None
    conversation_id: str
```

---

## Session Persistence

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
AI Agent ──► Frontend: agent_message

Frontend ──WS close──►
AI Agent ──SET ai:conv:user_123 (TTL 7d)──► Redis
AI Agent ──INSERT conversation + messages──► PostgreSQL
```

---

## Tool Execution

### Available Tools

All tools call `{BACKEND_URL}/v1/ai-tools/*` with:
- `X-Service-Key: <AI_SERVICE_KEY>`
- `Accept-Language: <locale>`

```python
TOOL_DISPATCH = {
    "search_hotels":          ("GET",  "/v1/ai-tools/hotels"),
    "search_trips":           ("GET",  "/v1/ai-tools/trips"),
    "search_guides":          ("GET",  "/v1/ai-tools/guides"),
    "check_availability":     ("GET",  "/v1/ai-tools/availability"),
    "create_booking_hold":    ("POST", "/v1/ai-tools/booking-holds"),
    "get_weather":            ("GET",  "/v1/ai-tools/weather"),
    "get_emergency_contacts": ("GET",  "/v1/ai-tools/emergency-contacts"),
    "send_sos_alert":         ("POST", "/v1/ai-tools/sos"),
    "get_user_loyalty":       ("GET",  "/v1/ai-tools/loyalty"),
}
```

### Tool Call Flow

```
AI Agent ──send conversation + tools──► gpt-oss-120b API
gpt-oss-120b ──► tool_use: search_trips(params)
AI Agent ──GET /v1/ai-tools/trips?...──► Backend (X-Service-Key)
Backend ──► 200 OK { trips: [...] }
AI Agent ──tool_result: trips──► gpt-oss-120b
gpt-oss-120b ──► Natural-language response
```

### Parallel Execution

```python
async def execute_tools_parallel(tool_calls, session):
    tasks = [execute_single_tool(tc, session) for tc in tool_calls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

---

## Payment Flow (Human-in-the-Loop)

```
AI Agent ──create_booking_hold──► Backend → booking_id (RESERVED, 15-min hold)
AI Agent ──► Frontend: { type: "requires_payment", booking_id, methods: ["stripe","bakong"] }
Frontend ──renders Stripe Elements / Bakong QR──►
Frontend ──completes payment──► Backend
Backend ──► Frontend: payment confirmed
Frontend ──► AI Agent: { type: "payment_completed", booking_id }
AI Agent ──► Frontend: "Your booking is confirmed! Here is your receipt..."
```

---

## Auto-Reconnect Logic (Frontend)

```typescript
class WebSocketManager {
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private messageQueue: Message[] = [];

  connect() {
    this.ws = new WebSocket("wss://ai.derlg.com/ws/chat");
    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.flushQueue();
    };
    this.ws.onclose = () => this.scheduleReconnect();
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
  }

  scheduleReconnect() {
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
  }

  send(message: Message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
      localStorage.setItem("ws_queue", JSON.stringify(this.messageQueue));
    }
  }
}
```

---

## Configuration

```python
# src/config/settings.py (via Pydantic BaseSettings)

class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"

    # LLM
    NVIDIA_API_KEY: str
    NVIDIA_MODEL: str = "gpt-oss-120b"

    # Backend
    BACKEND_URL: str                  # e.g. http://backend:3001
    AI_SERVICE_KEY: str               # min 32 chars

    # Redis
    REDIS_URL: str                    # e.g. redis://redis:6379/0

    # Monitoring
    SENTRY_DSN: str | None = None

    class Config:
        env_file = ".env"
```

---

## Docker / Deployment

### docker-compose.yml (ai-agent service)

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

### Production Dockerfile

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

## AI Capability Boundaries

| The AI Agent CAN | The AI Agent CANNOT |
|-----------------|---------------------|
| Search and read data via `/v1/ai-tools/*` | Access the database directly |
| Create booking holds (`RESERVED` status) | Execute payments or create Stripe charges |
| Suggest payment methods and guide to checkout | Modify confirmed bookings without user confirmation |
| Answer Cambodia travel, culture, and safety questions | Access admin-only data or other users' private info |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid JWT on connect | Close WebSocket with code 1008 |
| Tool call timeout (>15s) | Return error result, continue conversation |
| Model API timeout (>60s) | Retry once, then send user-friendly error |
| Backend circuit open (5+ failures) | Inform user, suggest retry later |
| Redis unavailable | Log error, attempt reconnect; degrade gracefully |
| Unhandled exception | Log with stack trace, send sanitized error to client |

---

## Monitoring

- **Health check:** `GET /health` → `{ status: "healthy", uptime_seconds: N }`
- **Metrics:** `GET /metrics` (Prometheus format)
  - `ai_agent_active_connections`
  - `ai_agent_messages_total{status}`
  - `ai_agent_tool_calls_total{tool_name}`
  - `ai_agent_response_time_seconds{quantile}`
- **Logging:** structlog JSON to stdout
- **Error tracking:** Sentry (via `SENTRY_DSN`)

---

*Reference: `docs/platform/architecture/realtime-and-ai.md`, `docs/product/prd.md`*
