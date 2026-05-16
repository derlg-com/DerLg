# Implementation Tasks: Vibe Booking — AI Travel Concierge (AI Agent Service)

> **Service directory:** `vibe-booking/`
> **Reference:** `docs/modules/vibe-booking/`, `docs/platform/architecture/realtime-and-ai.md`

---

## Phase 1: Project Foundation

### Task 1.1: Project Structure and Dependencies

- [ ] 1.1.1 Create `vibe-booking/src/` directory structure matching `structure.md` (`agent/`, `websocket/`, `services/`, `models/`)
- [ ] 1.1.2 Create `requirements.txt` with pinned versions (FastAPI, LangGraph, anthropic, redis, httpx, pydantic-settings, structlog, sentry-sdk)
- [ ] 1.1.3 Create `.env.example` with all required variables (`ANTHROPIC_API_KEY`, `BACKEND_URL`, `AI_SERVICE_KEY`, `REDIS_URL`)
- [ ] 1.1.4 Create `src/main.py` with FastAPI app, CORS middleware, lifespan (Redis init/close), and router registration
- [ ] 1.1.5 Create `src/config/settings.py` with Pydantic `BaseSettings`; validate `AI_SERVICE_KEY` ≥ 32 chars on startup
- [ ] 1.1.6 Create `Dockerfile` (multi-stage, Python 3.11-slim, `HEALTHCHECK`, 2 uvicorn workers)
- [ ] 1.1.7 Create `Dockerfile.dev` (Python 3.11-slim, `uvicorn --reload`)
- [ ] 1.1.8 Add `ai-agent` service to root `docker-compose.yml` with context `./vibe-booking`, port `8000:8000`, depends on `redis` + `backend`
- [ ] 1.1.9 Create `railway.json` for production deployment

### Task 1.2: Logging and Monitoring

- [ ] 1.2.1 Configure `structlog` for structured JSON logging in `src/utils/logging.py`
- [ ] 1.2.2 Create `GET /health` endpoint returning `{ status, uptime_seconds, timestamp }`
- [ ] 1.2.3 Create `GET /metrics` endpoint in Prometheus text format
- [ ] 1.2.4 Integrate Sentry via `SENTRY_DSN` environment variable
- [ ] 1.2.5 Track metrics: `active_connections`, `messages_total`, `tool_calls_total`, `response_time_seconds`

---

## Phase 2: Data Models

### Task 2.1: Conversation State

- [ ] 2.1.1 Create `src/models/conversation.py` with `ConversationState` Pydantic model (fields: `messages`, `user_id`, `intent`, `pending_tool_calls`, `last_action`, `context`, `preferred_language`, `booking_id`, `conversation_id`)
- [ ] 2.1.2 Create `src/models/messages.py` with WS message schemas (`UserMessage`, `AgentMessage`, `ToolCallMessage`, `RequiresPaymentMessage`, `PaymentCompletedMessage`, `ErrorMessage`)
- [ ] 2.1.3 Add JSON serialization/deserialization to `ConversationState`
- [ ] 2.1.4 Write property-based tests (Hypothesis) for `ConversationState` round-trip serialization

### Task 2.2: Redis Session Persistence

- [ ] 2.2.1 Create `src/services/redis_client.py` with `init_redis`, `close_redis`, `get_redis_client`
- [ ] 2.2.2 Implement `save_session(user_id, state)` — key `ai:conv:{user_id}`, TTL 7 days
- [ ] 2.2.3 Implement `load_session(user_id)` — returns `ConversationState | None`
- [ ] 2.2.4 Implement `delete_session(user_id)`
- [ ] 2.2.5 On WebSocket disconnect, flush final state to PostgreSQL (`conversations` + `messages` tables) via backend API
- [ ] 2.2.6 Write unit tests for session save/load/delete with `fakeredis`

---

## Phase 3: LLM Client

### Task 3.1: Claude Client

- [ ] 3.1.1 Create `src/services/claude_client.py` with `ClaudeClient` using `anthropic.AsyncAnthropic`
- [ ] 3.1.2 Implement `create_message(system, messages, tools, max_tokens=2048)` calling `claude-sonnet-4-5-20251001`
- [ ] 3.1.3 Return unified `ModelResponse(stop_reason, content: list[ContentBlock])`
- [ ] 3.1.4 Implement 60-second timeout and single retry on failure
- [ ] 3.1.5 Log token usage and latency per call
- [ ] 3.1.6 WHEN `preferred_language == "km"`, always use `ClaudeClient` regardless of any config

---

## Phase 4: Tool System

### Task 4.1: Tool Schema Definitions

- [ ] 4.1.1 Create `src/agent/tools.py` with all 9 tool schemas in Anthropic format:
  - `search_hotels` (city, check_in, check_out, price_range)
  - `search_trips` (destination, duration_days, people_count, budget_usd)
  - `search_guides` (location, language, date)
  - `check_availability` (item_type, item_id, date)
  - `create_booking_hold` (user_id, item_type, item_id, travel_date, people_count)
  - `get_weather` (location, date)
  - `get_emergency_contacts` (location)
  - `send_sos_alert` (user_id, location, message)
  - `get_user_loyalty` (user_id)
- [ ] 4.1.2 Export `ALL_TOOLS` list for use in `call_llm` node
- [ ] 4.1.3 Define `TOOL_DISPATCH` mapping tool names to `(method, path)` tuples

### Task 4.2: Backend HTTP Client

- [ ] 4.2.1 Create `src/services/backend_client.py` with `BackendClient` using `httpx.AsyncClient`
- [ ] 4.2.2 All requests include `X-Service-Key` and `Accept-Language` headers
- [ ] 4.2.3 Implement 15-second timeout per request
- [ ] 4.2.4 Implement circuit breaker: open after 5 consecutive failures, retry after 60s
- [ ] 4.2.5 Return `{"success": true, "data": {...}}` or `{"success": false, "error": {...}}`

### Task 4.3: Parallel Tool Executor

- [ ] 4.3.1 Create `execute_tools_parallel(tool_calls, session)` in `src/agent/nodes.py`
- [ ] 4.3.2 Execute all tool calls concurrently with `asyncio.gather`
- [ ] 4.3.3 Convert results to Anthropic `tool_result` message format
- [ ] 4.3.4 Write integration tests with mocked backend responses

---

## Phase 5: LangGraph State Machine

### Task 5.1: Node Implementations

- [ ] 5.1.1 Create `src/agent/nodes.py` with three nodes:
  - `call_llm(state)` — build system prompt, call Claude, return `model_response`
  - `execute_tools(state)` — extract tool_use blocks, run parallel, append tool_results to messages
  - `format_response(state)` — convert AI text + tool results to typed WS message
- [ ] 5.1.2 Enforce max 5 tool-call iterations; return error message if exceeded

### Task 5.2: State Machine Definition

- [ ] 5.2.1 Create `src/agent/state_machine.py` with `build_graph(redis_saver)` function
- [ ] 5.2.2 Add nodes: `call_llm`, `execute_tools`, `format_response`
- [ ] 5.2.3 Set `call_llm` as entry point
- [ ] 5.2.4 Add conditional edge: `call_llm` → `execute_tools` (tool_use) or `format_response` (end_turn)
- [ ] 5.2.5 Add edge: `execute_tools` → `call_llm`
- [ ] 5.2.6 Add edge: `format_response` → `END`
- [ ] 5.2.7 Compile graph with `RedisSaver` checkpointer
- [ ] 5.2.8 Write integration tests for state machine execution

### Task 5.3: System Prompt Builder

- [ ] 5.3.1 Create `src/agent/prompts.py` with `build_system_prompt(state: ConversationState) -> str`
- [ ] 5.3.2 Include: base identity, current stage, session context (user_id, booking_id, intent), language instructions, absolute rules (never invent data, never execute payments)
- [ ] 5.3.3 Write unit tests for prompt generation across all stages and languages

---

## Phase 6: WebSocket Handler

### Task 6.1: Connection Management

- [ ] 6.1.1 Create `src/websocket/chat_handler.py` with WebSocket endpoint at `/ws/chat`
- [ ] 6.1.2 Verify Bearer JWT on connect; close with code 1008 if invalid
- [ ] 6.1.3 Load session from Redis on connect; send `conversation_resumed` or `conversation_started`
- [ ] 6.1.4 Maintain `active_connections: dict[str, WebSocket]`
- [ ] 6.1.5 On disconnect: save session to Redis, flush to PostgreSQL via backend, remove from `active_connections`

### Task 6.2: Message Handling

- [ ] 6.2.1 Listen for `user_message` type messages
- [ ] 6.2.2 Send `typing_start` before processing, `typing_end` after
- [ ] 6.2.3 Call `run_agent(session, content)` and send formatted response
- [ ] 6.2.4 Handle `payment_completed` message: resume conversation with confirmation
- [ ] 6.2.5 Implement rate limiting: 10 messages/minute per session (Redis counter)
- [ ] 6.2.6 Sanitize user input before processing
- [ ] 6.2.7 Catch all exceptions; send `{ type: "error", message: "..." }` (no internal details)
- [ ] 6.2.8 Write integration tests for full WebSocket message flow

### Task 6.3: Heartbeat

- [ ] 6.3.1 Handle `ping` messages; respond with `{ type: "pong", timestamp: "..." }`

---

## Phase 7: Payment Flow

### Task 7.1: Booking Hold and Payment Handoff

- [ ] 7.1.1 WHEN agent reaches payment stage, call `create_booking_hold` tool
- [ ] 7.1.2 Send `{ type: "requires_payment", booking_id, amount_usd, methods: ["stripe","bakong"] }` to frontend
- [ ] 7.1.3 Store `booking_id` in `ConversationState.booking_id`
- [ ] 7.1.4 WHEN `payment_completed` received, resume conversation with confirmation message
- [ ] 7.1.5 Write integration tests for payment handoff flow

---

## Phase 8: Multi-Language Support

- [ ] 8.1 Accept `preferred_language` (`en` | `zh` | `km`) from first message or connection param
- [ ] 8.2 Pass `Accept-Language` header to all backend tool calls
- [ ] 8.3 Include language-specific instructions in system prompt
- [ ] 8.4 WHEN `preferred_language == "km"`, always use `ClaudeClient` (best Khmer support)
- [ ] 8.5 Write integration tests for all three languages

---

## Phase 9: Error Handling and Resilience

- [ ] 9.1 Implement 60-second timeout for Claude API calls with single retry
- [ ] 9.2 Implement 15-second timeout for backend tool calls
- [ ] 9.3 Implement circuit breaker in `BackendClient` (5 failures → open, 60s cooldown)
- [ ] 9.4 Handle Redis connection failures gracefully (log + attempt reconnect)
- [ ] 9.5 Sanitize all error messages before sending to WebSocket clients
- [ ] 9.6 Write unit tests for timeout and circuit breaker scenarios

---

## Phase 10: Security

- [ ] 10.1 Validate `AI_SERVICE_KEY` ≥ 32 chars on startup; fail fast if missing
- [ ] 10.2 Validate Bearer JWT on every WebSocket connection
- [ ] 10.3 Implement rate limiting: 10 messages/minute per session using Redis
- [ ] 10.4 Sanitize user input to prevent injection attacks
- [ ] 10.5 Do NOT log sensitive data (JWT tokens, payment details) in plain text
- [ ] 10.6 Write unit tests for rate limiting and input sanitization

---

## Phase 11: Testing

### Task 11.1: Unit Tests

- [ ] 11.1.1 Tool handler functions (all 9 tools, mocked backend)
- [ ] 11.1.2 System prompt builder (all stages, all languages)
- [ ] 11.1.3 Response formatter (all message types)
- [ ] 11.1.4 Session side effects (booking_id stored, state transitions)
- [ ] 11.1.5 Rate limiting logic
- [ ] 11.1.6 Achieve ≥ 80% code coverage

### Task 11.2: Integration Tests

- [ ] 11.2.1 Full WebSocket flow (connect → auth → message → response → disconnect)
- [ ] 11.2.2 Tool execution with mocked backend
- [ ] 11.2.3 Payment handoff flow (requires_payment → payment_completed → confirmation)
- [ ] 11.2.4 Session persistence (save, load, reconnect)
- [ ] 11.2.5 State machine execution (all stages)

### Task 11.3: Property-Based Tests (Hypothesis)

- [ ] 11.3.1 `ConversationState` serialization round-trip
- [ ] 11.3.2 Tool schema validation (all 9 tools)
- [ ] 11.3.3 Parallel tool execution order preservation

---

## Phase 12: Integration with Backend and Frontend

- [ ] 12.1 Verify all 9 `/v1/ai-tools/*` backend endpoints are implemented and accept `X-Service-Key`
- [ ] 12.2 Test each tool end-to-end with the running backend
- [ ] 12.3 Verify frontend can connect to `ws://localhost:8000/ws/chat`
- [ ] 12.4 Test `requires_payment` → frontend payment UI → `payment_completed` → confirmation flow
- [ ] 12.5 Test auto-reconnect from frontend (kill agent, restart, verify session resumes)
- [ ] 12.6 Test offline message queue (disconnect frontend, send messages, reconnect, verify delivery)

---

## Phase 13: Production Readiness

- [ ] 13.1 Verify all environment variables documented in `.env.example`
- [ ] 13.2 Verify `HEALTHCHECK` in Dockerfile responds correctly
- [ ] 13.3 Verify `GET /metrics` returns valid Prometheus format
- [ ] 13.4 Verify Sentry error tracking captures exceptions
- [ ] 13.5 Verify CORS allows `https://derlg.com` and `https://www.derlg.com`
- [ ] 13.6 Verify rate limiting is active in production config
- [ ] 13.7 Deploy to Railway and verify `GET /health` responds
- [ ] 13.8 Run load test with 50 concurrent WebSocket connections

---

## Success Criteria

- All 9 tools implemented and tested end-to-end
- 6-stage conversation flow (GREETING → DISCOVERY → RECOMMEND → BOOKING → PAYMENT → CONFIRMED) working
- WebSocket at `/ws/chat` stable with auto-reconnect
- Payment handoff (requires_payment / payment_completed) working with frontend
- Multi-language support (en, zh, km) functional
- Session persistence: Redis active + PostgreSQL archive on disconnect
- ≥ 80% test coverage
- Production deployment on Railway with health check passing

---

*Reference: `docs/modules/vibe-booking/`, `docs/modules/ai-chat/`, `docs/platform/architecture/realtime-and-ai.md`, `.kiro/steering/structure.md`*
