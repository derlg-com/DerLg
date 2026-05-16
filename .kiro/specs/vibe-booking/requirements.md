# Requirements: Vibe Booking — AI Travel Concierge (AI Agent Service)

> **Source of truth:** `docs/modules/vibe-booking/`, `docs/modules/ai-chat/`, `docs/platform/architecture/realtime-and-ai.md`
> **Feature IDs:** F10–F16
> **Scope:** MVP
> **Service directory:** `vibe-booking/`

---

## Introduction

The Vibe Booking AI Agent is a Python FastAPI microservice that powers DerLg's conversational booking experience. It runs a LangGraph + NVIDIA gpt-oss-120b agent, communicates with the Next.js frontend via WebSocket, and calls the NestJS backend via HTTP tool endpoints (`/v1/ai-tools/*`).

The agent **never writes to the database directly** and **never executes payments**. All mutations go through backend tool endpoints authenticated with `X-Service-Key`. Payment is handled by the frontend after the agent sends a `requires_payment` message.

---

## Glossary

| Term | Definition |
|------|-----------|
| **AI Agent** | The Python FastAPI service in `vibe-booking/` |
| **LangGraph** | State machine framework orchestrating conversation flow |
| **ConversationState** | Pydantic model holding the full session context |
| **Tool** | A function the agent calls via HTTP to the NestJS backend |
| **Service Key** | `X-Service-Key` header authenticating agent → backend calls |
| **Booking Hold** | 15-minute `RESERVED` status created by `create_booking_hold` tool |
| **requires_payment** | Structured WS message telling the frontend to render payment UI |
| **payment_completed** | WS message sent by frontend after successful payment |

---

## Requirements

### Requirement 1: FastAPI Application Foundation

**User Story:** As a developer, I want a properly configured FastAPI application with WebSocket support so that I can build a real-time conversational AI service.

#### Acceptance Criteria

1. The AI Agent SHALL use Python 3.11+
2. The AI Agent SHALL use FastAPI for HTTP and WebSocket endpoints
3. The AI Agent SHALL expose a WebSocket endpoint at `/ws/chat`
4. The AI Agent SHALL expose a health check at `GET /health`
5. The AI Agent SHALL allow CORS from `https://derlg.com` and `https://www.derlg.com`
6. The AI Agent SHALL use Pydantic BaseSettings for all configuration
7. The AI Agent SHALL use async/await for all I/O operations
8. The AI Agent SHALL be located in the `vibe-booking/` directory

---

### Requirement 2: WebSocket Protocol

**User Story:** As a traveler, I want to chat with the AI in real-time so that I can plan and book my trip conversationally.

#### Acceptance Criteria

1. The WebSocket endpoint SHALL be `wss://ai.derlg.com/ws/chat` (prod) / `ws://localhost:8000/ws/chat` (dev)
2. The client SHALL authenticate via Bearer JWT in the connection header or query param
3. The AI Agent SHALL reject connections with invalid JWTs (close code 1008)
4. Client → Server messages SHALL use the format:
   ```json
   { "type": "user_message", "conversation_id": "conv_abc123", "content": "..." }
   ```
5. Server → Client messages SHALL use the format:
   ```json
   { "type": "agent_message", "conversation_id": "conv_abc123", "content": "...", "suggestions": [] }
   ```
6. The AI Agent SHALL support `ping` / `pong` heartbeat messages (every 30s)
7. The AI Agent SHALL send `typing_start` and `typing_end` indicators during processing
8. The AI Agent SHALL queue messages sent while offline and flush on reconnect

---

### Requirement 3: LangGraph State Machine

**User Story:** As a developer, I want a state machine that manages conversation flow so that the AI progresses through the booking journey systematically.

#### Acceptance Criteria

1. The AI Agent SHALL use LangGraph `StateGraph` to define conversation flow
2. The state machine SHALL have the following stages: `GREETING → DISCOVERY → RECOMMEND → BOOKING → PAYMENT → CONFIRMED`
3. The AI Agent SHALL define three nodes: `call_llm`, `execute_tools`, `format_response`
4. WHEN `call_llm` returns `stop_reason = "tool_use"`, the next node SHALL be `execute_tools`
5. WHEN `call_llm` returns `stop_reason = "end_turn"`, the next node SHALL be `format_response`
6. WHEN `execute_tools` completes, the next node SHALL be `call_llm` (loop)
7. The AI Agent SHALL enforce a maximum of 5 tool-call iterations per turn to prevent infinite loops
8. The AI Agent SHALL use `RedisSaver` as the LangGraph checkpointer

---

### Requirement 4: Conversation State Management

**User Story:** As a developer, I want a comprehensive state model so that all conversation context is tracked and persisted.

#### Acceptance Criteria

1. `ConversationState` SHALL be a Pydantic model with fields:
   - `messages: list[Message]` — full conversation history
   - `user_id: str` — DerLg user ID
   - `intent: str | None` — detected intent (plan, book, ask, emergency)
   - `pending_tool_calls: list[dict]`
   - `last_action: str | None`
   - `context: dict` — arbitrary session context (dates, budget, etc.)
2. `ConversationState` SHALL serialize to/from JSON for Redis storage
3. The AI Agent SHALL support the `preferred_language` field (`en`, `zh`, `km`)

---

### Requirement 5: Session Persistence

**User Story:** As a traveler, I want my conversation to persist across disconnections so that I can resume where I left off.

#### Acceptance Criteria

1. Active sessions SHALL be stored in Redis with key `ai:conv:{user_id}` and 7-day TTL
2. WHEN a WebSocket disconnects, the final conversation state SHALL be flushed to PostgreSQL (`conversations` and `messages` tables)
3. WHEN a user reconnects within 7 days, the Redis state SHALL be restored
4. WHEN a user reconnects after the Redis TTL expires, a new session SHALL start; archived history from PostgreSQL MAY be loaded as a summary
5. On successful connection, the AI Agent SHALL send `conversation_resumed` if a prior session exists

---

### Requirement 6: Tool Calling — Available Tools

**User Story:** As a developer, I want all agent tools defined so that NVIDIA gpt-oss-120b knows what functions it can call.

#### Acceptance Criteria

The AI Agent SHALL define the following tools, each calling the corresponding backend endpoint with `X-Service-Key` header:

| Tool | Method | Backend Path | Purpose |
|------|--------|-------------|---------|
| `search_hotels` | GET | `/v1/ai-tools/hotels` | Find hotels by city, date, price range |
| `search_trips` | GET | `/v1/ai-tools/trips` | Find trip packages |
| `search_guides` | GET | `/v1/ai-tools/guides` | Find tour guides by location and language |
| `check_availability` | GET | `/v1/ai-tools/availability` | Check inventory for a specific item and date |
| `create_booking_hold` | POST | `/v1/ai-tools/booking-holds` | Create a `RESERVED` booking (15-min hold) |
| `get_weather` | GET | `/v1/ai-tools/weather` | Current weather for a location |
| `get_emergency_contacts` | GET | `/v1/ai-tools/emergency-contacts` | Nearby emergency services |
| `send_sos_alert` | POST | `/v1/ai-tools/sos` | Trigger an emergency alert |
| `get_user_loyalty` | GET | `/v1/ai-tools/loyalty` | Read user's current points and tier |

---

### Requirement 7: Tool Execution

**User Story:** As a developer, I want a tool executor that calls backend endpoints so that the AI can fetch real data and perform actions.

#### Acceptance Criteria

1. The AI Agent SHALL execute multiple tool calls in parallel using `asyncio.gather`
2. All backend requests SHALL include `X-Service-Key: <AI_SERVICE_KEY>` header
3. All backend requests SHALL include `Accept-Language: <locale>` header
4. Tool HTTP requests SHALL have a 15-second timeout
5. WHEN a tool call succeeds, it SHALL return `{"success": true, "data": {...}}`
6. WHEN a tool call fails, it SHALL return `{"success": false, "error": {"code": "...", "message": "..."}}`
7. Tool execution errors SHALL not crash the WebSocket connection

---

### Requirement 8: Payment Flow (Human-in-the-Loop)

**User Story:** As a traveler, I want to pay securely without the AI having access to my payment details so that my financial information is protected.

#### Acceptance Criteria

1. The AI Agent SHALL **never** execute payments or create Stripe charges
2. WHEN a conversation reaches the payment stage, the AI Agent SHALL:
   a. Call `create_booking_hold` to create a `RESERVED` booking
   b. Send a structured message: `{ "type": "requires_payment", "booking_id": "...", "methods": ["stripe", "bakong"] }`
3. The frontend SHALL render the native payment UI (Stripe Elements or Bakong QR)
4. WHEN payment completes, the frontend SHALL send: `{ "type": "payment_completed", "booking_id": "..." }`
5. The AI Agent SHALL resume the conversation with booking confirmation details after receiving `payment_completed`

---

### Requirement 9: AI Capability Boundaries

**User Story:** As a system operator, I want clear boundaries on what the AI can and cannot do so that the system remains secure and predictable.

#### Acceptance Criteria

The AI Agent **CAN**:
1. Search and read data via `/v1/ai-tools/*` endpoints
2. Create booking holds (`RESERVED` status) for the user to confirm
3. Suggest payment methods and guide the user to checkout
4. Answer questions about Cambodia travel, culture, and safety

The AI Agent **CANNOT**:
1. Access the database directly
2. Execute payments or create Stripe charges
3. Modify confirmed bookings without explicit user confirmation
4. Access admin-only data or other users' private information

---

### Requirement 10: Multi-Language Support

**User Story:** As a traveler, I want to chat in my preferred language so that I can communicate naturally.

#### Acceptance Criteria

1. The AI Agent SHALL support English (`en`), Chinese (`zh`), and Khmer (`km`)
2. The locale SHALL be passed in the WebSocket connection or first message
3. The AI Agent SHALL pass `Accept-Language` to all backend tool calls
4. WHEN locale is `km`, the AI Agent SHALL always use the NVIDIA client (best Khmer support)
5. The AI Agent SHALL respond in the user's preferred language

---

### Requirement 11: Error Handling and Resilience

**User Story:** As a traveler, I want the AI to handle errors gracefully so that I can continue my conversation even when issues occur.

#### Acceptance Criteria

1. The AI Agent SHALL catch all exceptions in the WebSocket message handler
2. WHEN an exception occurs, the AI Agent SHALL send a user-friendly error message
3. The AI Agent SHALL implement 60-second timeout for model API calls
4. The AI Agent SHALL implement 15-second timeout for backend tool calls
5. The AI Agent SHALL retry model API calls once before returning an error
6. The AI Agent SHALL implement a circuit breaker for backend API calls (open after 5 failures)
7. Error messages SHALL NOT expose internal stack traces or system details

---

### Requirement 12: Security

**User Story:** As a developer, I want secure service-to-service communication so that unauthorized access is prevented.

#### Acceptance Criteria

1. The AI Agent SHALL require `AI_SERVICE_KEY` (min 32 chars) for all backend requests
2. The AI Agent SHALL validate Bearer JWT on every WebSocket connection
3. The AI Agent SHALL implement rate limiting: 10 messages/minute per session
4. The AI Agent SHALL sanitize user input before processing
5. The AI Agent SHALL NOT log sensitive data (payment details, full JWT tokens) in plain text

---

### Requirement 13: Logging and Monitoring

**User Story:** As a developer, I want comprehensive logging so that I can debug issues and track performance.

#### Acceptance Criteria

1. The AI Agent SHALL use `structlog` for structured JSON logging
2. The AI Agent SHALL log all WebSocket connections, disconnections, and errors
3. The AI Agent SHALL log all tool executions with name, latency, and success/failure
4. The AI Agent SHALL expose `GET /metrics` in Prometheus format
5. The AI Agent SHALL integrate with Sentry for error tracking

---

### Requirement 14: Deployment

**User Story:** As a developer, I want containerized deployment so that I can run the AI agent consistently across environments.

#### Acceptance Criteria

1. The AI Agent SHALL include a `Dockerfile` (multi-stage, Python 3.11-slim)
2. The AI Agent SHALL include a `Dockerfile.dev` with `uvicorn --reload`
3. The `docker-compose.yml` SHALL include the `ai-agent` service with context `./vibe-booking`
4. The AI Agent SHALL expose port `8000`
5. The AI Agent SHALL include a `HEALTHCHECK` in the production Dockerfile
6. The AI Agent SHALL support production deployment via Docker on a VPS

---

## Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `user_message` | Client → Server | User's chat input |
| `agent_message` | Server → Client | AI response with optional suggestions |
| `tool_call` | Server → Client | Informational: tool being executed |
| `requires_payment` | Server → Client | Instructs frontend to render payment UI |
| `payment_completed` | Client → Server | Frontend confirms payment success |
| `typing_start` | Server → Client | AI is processing |
| `typing_end` | Server → Client | AI finished processing |
| `ping` / `pong` | Both | Heartbeat |
| `error` | Server → Client | Error notification |

---

## Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `CHAT_001` | 400 | Invalid message format |
| `CHAT_002` | 403 | Service key missing or invalid |
| `CHAT_003` | 429 | Rate limit exceeded (10 messages/min) |
| `CHAT_004` | 503 | AI service unavailable |
| `CHAT_005` | 1008 | Invalid JWT on WebSocket connect |

---

*Reference: `docs/modules/vibe-booking/requirements.md`, `docs/modules/ai-chat/requirements.md`, `docs/platform/architecture/realtime-and-ai.md`*
