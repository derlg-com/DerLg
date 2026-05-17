# Implementation Tasks: Vibe Booking — AI Travel Concierge

> **Source of truth:** `.kiro/specs/vibe-booking-final/`  
> **Services:** AI Agent (`vibe-booking/`), Frontend Stream Mode (`frontend/app/(app)/vibe-booking/`)

---

## Phase 1: AI Agent — Project Foundation

### Task 1.1: Project Structure and Dependencies

- [ ] 1.1.1 Create `vibe-booking/src/` directory structure: `agent/`, `websocket/`, `services/`, `models/`, `config/`
- [ ] 1.1.2 Create `requirements.txt` with pinned versions (FastAPI, uvicorn, LangGraph, langchain-nvidia, redis, httpx, pydantic-settings, structlog, sentry-sdk, prometheus-client)
- [ ] 1.1.3 Create `.env.example` with all required variables (`NVIDIA_API_KEY`, `BACKEND_URL`, `AI_SERVICE_KEY`, `REDIS_URL`, `SENTRY_DSN`)
- [ ] 1.1.4 Create `src/main.py` with FastAPI app, CORS middleware, lifespan (Redis init/close), router registration
- [ ] 1.1.5 Create `src/config/settings.py` with Pydantic `BaseSettings`; validate `AI_SERVICE_KEY` ≥ 32 chars on startup
- [ ] 1.1.6 Create `Dockerfile` (multi-stage, Python 3.11-slim, `HEALTHCHECK`, 2 uvicorn workers)
- [ ] 1.1.7 Create `Dockerfile.dev` (Python 3.11-slim, `uvicorn --reload`)
- [ ] 1.1.8 Add `ai-agent` service to root `docker-compose.yml` with context `./vibe-booking`, port `8000:8000`, depends on `redis` + `backend`
- [ ] 1.1.9 Create `docker-compose.prod.yml` for production Docker deployment on VPS

### Task 1.2: Logging and Monitoring

- [ ] 1.2.1 Configure `structlog` for structured JSON logging in `src/config/logging.py`
- [ ] 1.2.2 Create `GET /health` endpoint returning `{ status, uptime_seconds, timestamp }`
- [ ] 1.2.3 Create `GET /metrics` endpoint in Prometheus text format
- [ ] 1.2.4 Integrate Sentry via `SENTRY_DSN` environment variable
- [ ] 1.2.5 Track metrics: `active_connections`, `messages_total`, `tool_calls_total`, `response_time_seconds`

---

## Phase 2: AI Agent — Data Models

### Task 2.1: Conversation State

- [ ] 2.1.1 Create `src/models/conversation.py` with `ConversationState` Pydantic model:
  - Fields: `messages`, `user_id`, `conversation_id`, `intent`, `pending_tool_calls`, `last_action`, `last_tool_call`, `context`, `preferred_language`, `booking_id`
- [ ] 2.1.2 Create `src/models/messages.py` with WS message schemas:
  - `UserMessage`, `AgentMessage`, `AuthMessage`, `UserActionMessage`, `RequiresPaymentMessage`, `PaymentCompletedMessage`, `PaymentStatusMessage`, `BookingHoldExpiryMessage`, `AgentStreamChunkMessage`, `AgentToolStatusMessage`, `ErrorMessage`
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

## Phase 3: AI Agent — LLM Client

### Task 3.1: gpt-oss-120b Client

- [ ] 3.1.1 Create `src/services/nvidia_client.py` with `NvidiaClient` using NVIDIA NIM API
- [ ] 3.1.2 Implement `create_message(system, messages, tools, max_tokens=2048)` calling `openai/gpt-oss-120b`
- [ ] 3.1.3 Return unified `ModelResponse(stop_reason, content: list[ContentBlock])`
- [ ] 3.1.4 Implement 60-second timeout and single retry on failure
- [ ] 3.1.5 Log token usage and latency per call
- [ ] 3.1.6 WHEN `preferred_language == "km"`, always use `NvidiaClient` regardless of any config

---

## Phase 4: AI Agent — Tool System

### Task 4.1: Tool Schema Definitions

- [ ] 4.1.1 Create `src/agent/tools.py` with all 12 tool schemas in NVIDIA function-calling format:
  - `search_hotels` (city, check_in, check_out, price_range, amenities)
  - `search_trips` (destination, duration_days, people_count, budget_usd)
  - `search_guides` (location, language, date)
  - `search_transport` (origin, destination, date, passengers)
  - `check_availability` (item_type, item_id, date)
  - `create_booking_hold` (user_id, item_type, item_id, travel_date, people_count)
  - `get_weather` (location, date)
  - `get_emergency_contacts` (location)
  - `send_sos_alert` (user_id, location, message)
  - `get_user_loyalty` (user_id)
  - `estimate_budget` (destination, duration_days, people_count, budget_tier)
  - `check_payment_status` (payment_intent_id)
- [ ] 4.1.2 Export `ALL_TOOLS` list for use in `call_llm` node
- [ ] 4.1.3 Define `TOOL_DISPATCH` mapping tool names to `(method, path)` tuples

### Task 4.2: Backend HTTP Client

- [ ] 4.2.1 Create `src/services/backend_client.py` with `BackendClient` using `httpx.AsyncClient`
- [ ] 4.2.2 All requests include `X-Service-Key` and `Accept-Language` headers
- [ ] 4.2.3 Implement 15-second timeout per request
- [ ] 4.2.4 Implement circuit breaker: open after 5 consecutive failures, 60-second cooldown
- [ ] 4.2.5 Return `{"success": true, "data": {...}}` or `{"success": false, "error": {...}}`

### Task 4.3: Parallel Tool Executor

- [ ] 4.3.1 Create `execute_tools_parallel(tool_calls, session)`
- [ ] 4.3.2 Execute all tool calls concurrently with `asyncio.gather`
- [ ] 4.3.3 Convert results to tool_result message format
- [ ] 4.3.4 Write integration tests with mocked backend responses

---

## Phase 5: AI Agent — LangGraph State Machine

### Task 5.1: Node Implementations

- [ ] 5.1.1 Create `src/agent/nodes.py` with three nodes:
  - `call_llm(state)` — build system prompt, call gpt-oss-120b, return `model_response`
  - `execute_tools(state)` — extract tool_use blocks, run parallel, append tool_results to messages
  - `format_response(state)` — convert AI text + tool results to typed WS message with `content_payload`
- [ ] 5.1.2 Enforce max 5 tool-call iterations; return error message if exceeded

### Task 5.2: State Machine Definition

- [ ] 5.2.1 Create `src/agent/state_machine.py` with `build_graph()` function
- [ ] 5.2.2 Add nodes: `call_llm`, `execute_tools`, `format_response`
- [ ] 5.2.3 Set `call_llm` as entry point
- [ ] 5.2.4 Add conditional edge: `call_llm` → `execute_tools` (tool_use) or `format_response` (end_turn)
- [ ] 5.2.5 Add edge: `execute_tools` → `call_llm`
- [ ] 5.2.6 Add edge: `format_response` → `END`
- [ ] 5.2.7 Compile graph with `RedisSaver` checkpointer
- [ ] 5.2.8 Write integration tests for state machine execution

### Task 5.3: System Prompt Builder

- [ ] 5.3.1 Create `src/agent/prompts.py` with `build_system_prompt(state)`
- [ ] 5.3.2 Include: base identity, current stage, session context, language instructions, absolute rules, intent-specific tool filtering
- [ ] 5.3.3 Write unit tests for prompt generation across all stages and languages

---

## Phase 6: AI Agent — WebSocket Handler

### Task 6.1: Connection Management

- [ ] 6.1.1 Create WebSocket endpoint at `/ws/chat`
- [ ] 6.1.2 Verify Bearer JWT on connect; close with code 1008 if invalid
- [ ] 6.1.3 Support `auth` message as fallback for clients that cannot send headers
- [ ] 6.1.4 Load session from Redis on connect; send `conversation_resumed` or `conversation_started`
- [ ] 6.1.5 Maintain `active_connections: dict[str, WebSocket]`
- [ ] 6.1.6 On disconnect: save session to Redis, remove from `active_connections`, flush to PostgreSQL

### Task 6.2: Message Handling

- [ ] 6.2.1 Listen for `user_message`, `user_action`, `payment_completed`, `location` types
- [ ] 6.2.2 Send `typing_start` before processing, `typing_end` after
- [ ] 6.2.3 Call `run_agent(session, content)` and send formatted `agent_message` with optional `content_payload`
- [ ] 6.2.4 Handle `payment_completed` message: resume conversation with confirmation
- [ ] 6.2.5 Handle `user_action` message: route to appropriate tool or state transition
- [ ] 6.2.6 Implement rate limiting: 10 messages/minute per session (Redis counter)
- [ ] 6.2.7 Sanitize user input before processing (strip + basic XSS filter)
- [ ] 6.2.8 Catch all exceptions; send `{ type: "error", code: "...", message: "...", recoverable: true }`
- [ ] 6.2.9 Write integration tests for full WebSocket message flow

### Task 6.3: Heartbeat and Streaming

- [ ] 6.3.1 Handle `ping` messages; respond with `{ type: "pong", timestamp: "..." }`
- [ ] 6.3.2 Send `agent_tool_status` messages during parallel tool execution
- [ ] 6.3.3 Support `agent_stream_chunk` for incremental content updates

---

## Phase 7: AI Agent — Payment Flow

### Task 7.1: Booking Hold and Payment Handoff

- [ ] 7.1.1 WHEN agent reaches payment stage, call `create_booking_hold` tool
- [ ] 7.1.2 Send `{ type: "requires_payment", booking_id, amount_usd, methods: ["stripe","bakong"] }` to frontend
- [ ] 7.1.3 Store `booking_id` in `ConversationState.booking_id`
- [ ] 7.1.4 Send `booking_hold_expiry` messages with countdown (every 60s, then every 10s under 2 min)
- [ ] 7.1.5 WHEN `payment_completed` received, resume conversation with confirmation message
- [ ] 7.1.6 Write integration tests for payment handoff flow

---

## Phase 8: AI Agent — Multi-Language Support

- [ ] 8.1 Accept `preferred_language` (`en` | `zh` | `km`) from auth message, header, or first user_message
- [ ] 8.2 Pass `Accept-Language` header to all backend tool calls
- [ ] 8.3 Include language-specific instructions in system prompt
- [ ] 8.4 WHEN `preferred_language == "km"`, always use `NvidiaClient` (best Khmer support)
- [ ] 8.5 Write integration tests for all three languages

---

## Phase 9: AI Agent — Error Handling and Resilience

- [ ] 9.1 Implement 60-second timeout for gpt-oss-120b API calls with single retry
- [ ] 9.2 Implement 15-second timeout for backend tool calls
- [ ] 9.3 Implement circuit breaker in `BackendClient` (5 failures → open, 60s cooldown)
- [ ] 9.4 Handle Redis connection failures gracefully (log + attempt reconnect)
- [ ] 9.5 Sanitize all error messages before sending to WebSocket clients
- [ ] 9.6 Write unit tests for timeout and circuit breaker scenarios

---

## Phase 10: AI Agent — Security

- [ ] 10.1 Validate `AI_SERVICE_KEY` ≥ 32 chars on startup; fail fast if missing
- [ ] 10.2 Validate Bearer JWT on every WebSocket connection
- [ ] 10.3 Implement rate limiting: 10 messages/minute per session using Redis
- [ ] 10.4 Sanitize user input to prevent injection attacks
- [ ] 10.5 Do NOT log sensitive data (JWT tokens, payment details) in plain text
- [ ] 10.6 Write unit tests for rate limiting and input sanitization

---

## Phase 11: Frontend — Project Foundation

### Task 11.1: Route and Layout

- [ ] 11.1.1 Create `frontend/app/(app)/vibe-booking/page.tsx` (Server Component)
- [ ] 11.1.2 Create `frontend/app/(app)/vibe-booking/layout.tsx`
- [ ] 11.1.3 Create `SplitScreenLayout` component with CSS Grid/Flexbox
- [ ] 11.1.4 Implement responsive behavior: two-pane desktop, single-pane mobile overlay

### Task 11.2: Zustand Store

- [ ] 11.2.1 Create `frontend/stores/vibe-booking.store.ts` with Immer + persist middleware
- [ ] 11.2.2 Implement Chat slice: `messages`, `isTyping`, `isStreaming`, `connectionStatus`
- [ ] 11.2.3 Implement Content slice: `contentItems`, `activeContentId`, add/update/remove/clear
- [ ] 11.2.4 Implement Layout slice: `layout` (dock, x, y, width, height, collapsed), reset
- [ ] 11.2.5 Implement Booking slice: `booking` state machine (idle → holding → paying → confirmed/failed)
- [ ] 11.2.6 Persist layout and last-50 messages to localStorage (`derlg:vibe-booking:store`)

---

## Phase 12: Frontend — Chat Panel

### Task 12.1: Draggable Resizable Panel

- [ ] 12.1.1 Create `useDraggableResizable` hook with refs + RAF (no re-renders during drag)
- [ ] 12.1.2 Implement mouse and touch event handlers for drag and resize
- [ ] 12.1.3 Implement snap-to-dock (left, right, center, floating) within 40px of edge
- [ ] 12.1.4 Implement keyboard accessibility (Arrow keys move, Shift+Arrow resize)
- [ ] 12.1.5 Persist position/size/dock to `localStorage`
- [ ] 12.1.6 Add "Reset Layout" button to restore defaults

### Task 12.2: Chat UI Components

- [ ] 12.2.1 Create `ChatHeader` with drag handle, connection status badge, collapse/reset buttons
- [ ] 12.2.2 Create `MessageList` with auto-scroll and virtual scrolling for >50 messages
- [ ] 12.2.3 Create `ChatMessage` component with user/assistant/system variants, linked content jump button
- [ ] 12.2.4 Create `ChatInput` with send button, auto-resize textarea, rate-limit UI feedback
- [ ] 12.2.5 Create `TypingIndicator` with pulsing dots
- [ ] 12.2.6 Create `ResizeHandle` with proper cursor and ARIA labels

---

## Phase 13: Frontend — Content Stage

### Task 13.1: Content Stage Shell

- [ ] 13.1.1 Create `ContentStage` component with dual rendering modes (discovery vs booking flow)
- [ ] 13.1.2 Create `ContentStageHeader` with title, streaming indicator, clear-all button
- [ ] 13.1.3 Create `ContentHistory` scrollable container
- [ ] 13.1.4 Create `ContentItem` wrapper with per-item `ErrorBoundary`
- [ ] 13.1.5 Create `ContentPlaceholder` with localized welcome message and suggested prompt chips
- [ ] 13.1.6 Create `StreamingIndicator` with pulsing dot + localized text

### Task 13.2: Content Renderers

- [ ] 13.2.1 Create `TripCardsRenderer` with image, title, price, duration, rating, "Book Now" action
- [ ] 13.2.2 Create `HotelCardsRenderer` with gallery, amenities, price/night, map thumbnail
- [ ] 13.2.3 Create `TransportOptionsRenderer` with comparison table (van, bus, tuk-tuk)
- [ ] 13.2.4 Create `ItineraryRenderer` with day-by-day timeline
- [ ] 13.2.5 Create `MapViewRenderer` with Leaflet.js, markers, auto-center
- [ ] 13.2.6 Create `BudgetEstimateRenderer` with stacked bar or pie chart
- [ ] 13.2.7 Create `QRPaymentRenderer` with large QR, amount, expiry countdown
- [ ] 13.2.8 Create `BookingConfirmedRenderer` with reference, QR check-in, receipt download, calendar, share
- [ ] 13.2.9 Create `PaymentStatusRenderer` with colored badge, method, amount, retry/view buttons
- [ ] 13.2.10 Create `WeatherRenderer` with 5-day forecast
- [ ] 13.2.11 Create `ComparisonRenderer` with side-by-side feature matrix
- [ ] 13.2.12 Create `ImageGalleryRenderer` with grid and lightbox
- [ ] 13.2.13 Create `TextSummaryRenderer` fallback
- [ ] 13.2.14 Create `BookingSummaryRenderer` with price breakdown, cancellation policy, confirm button

### Task 13.3: Content Registry and Pipeline

- [ ] 13.3.1 Create Zod schemas for all 14 Content Types
- [ ] 13.3.2 Create `CONTENT_REGISTRY` mapping types to lazy-loaded renderers + schemas
- [ ] 13.3.3 Create `createContentRenderer()` factory with ingestion-time Zod validation
- [ ] 13.3.4 Create `useContentRenderer()` hook

---

## Phase 14: Frontend — WebSocket and Data Flow

### Task 14.1: WebSocket Hook

- [ ] 14.1.1 Create `useWebSocket` hook with auto-reconnect (exponential backoff: 1s→2s→4s→8s→max 30s)
- [ ] 14.1.2 Implement message queue for offline messages (persist to localStorage, max 100)
- [ ] 14.1.3 Implement heartbeat ping/pong (every 30s)
- [ ] 14.1.4 Send `auth` message on connect with userId, sessionId, preferredLanguage, token

### Task 14.2: Content Router

- [ ] 14.2.1 Create `useContentRouter` hook
- [ ] 14.2.2 Handle `typing_start` / `typing_end` → update store flags
- [ ] 14.2.3 Handle `agent_message` → add chat message + route `content_payload` to Content Stage
- [ ] 14.2.4 Handle `agent_stream_chunk` → create/update ContentItem with streaming status
- [ ] 14.2.5 Handle `payment_status` → render/update PaymentStatus card
- [ ] 14.2.6 Handle `booking_hold_expiry` → update countdown, show expiry notice at 0
- [ ] 14.2.7 Handle `error` → add error message to chat

### Task 14.3: Action Handling

- [ ] 14.3.1 Implement action round-trip: user clicks button → send `user_action` WS message → AI processes → new content arrives
- [ ] 14.3.2 Implement optimistic UI for action buttons (loading state while awaiting AI response)

---

## Phase 15: Frontend — Payment Flow UI

- [ ] 15.1 Create Booking Summary Card with trip details, dates, guests, price breakdown, cancellation policy
- [ ] 15.2 Implement "Confirm Booking" button → triggers `requires_payment` flow
- [ ] 15.3 Create 15-minute countdown timer with amber pulse under 2 minutes
- [ ] 15.4 Create Stripe Card Form with card number, expiry, CVC, 3D Secure
- [ ] 15.5 Create Bakong/ABA QR Code display with expiry watermark
- [ ] 15.6 Implement payment processing state with loading spinner
- [ ] 15.7 Poll `GET /v1/bookings/{booking_id}` or listen to WS `payment_status` for updates
- [ ] 15.8 Create Booking Confirmed view with success animation, reference `DLG-YYYY-NNNN`, QR check-in
- [ ] 15.9 Add "Download Receipt (PDF)", "Add to Calendar (iCal)", "Share Booking" buttons
- [ ] 15.10 Create payment failure view with "Retry Payment" and "Cancel Booking" buttons
- [ ] 15.11 Create booking expiry view with "Restart Booking" button

---

## Phase 16: Frontend — Multi-Language and Accessibility

- [ ] 16.1 Set up `next-intl` for all Content Stage UI labels, buttons, placeholders
- [ ] 16.2 Translate Placeholder State welcome message for EN, ZH, KM
- [ ] 16.3 Implement locale-aware currency formatting (USD `$`, KHR `៛`, CNY `¥`)
- [ ] 16.4 Implement locale-aware date formatting
- [ ] 16.5 Configure Khmer font fallback (Noto Sans Khmer) and line height
- [ ] 16.6 Ensure drag operations are keyboard-accessible
- [ ] 16.7 Add proper ARIA roles (`role="dialog"`, `aria-label`, `role="article"`)
- [ ] 16.8 Implement focus trapping in floating Chat Panel
- [ ] 16.9 Respect `prefers-reduced-motion` (disable animations)
- [ ] 16.10 Ensure WCAG AA color contrast (4.5:1 normal, 3:1 large)
- [ ] 16.11 Status badges include text + icon (not color alone)

---

## Phase 17: Frontend — Performance

- [ ] 17.1 Wrap all renderer components with `React.memo`
- [ ] 17.2 Implement virtual scrolling for Content History >50 items
- [ ] 17.3 Lazy-load map tiles with offline fallback
- [ ] 17.4 Use Next.js `Image` with `loading="lazy"` and responsive `sizes`
- [ ] 17.5 Lazy-load all renderer components via `dynamic()` or React `lazy()`
- [ ] 17.6 Ensure drag/resize does not trigger React re-renders during operation
- [ ] 17.7 Verify CLS < 0.1 on Lighthouse
- [ ] 17.8 Verify bundle size < 150KB gzipped for `/vibe-booking` route

---

## Phase 18: Integration Testing

### Task 18.1: AI Agent Tests

- [ ] 18.1.1 Unit tests: Tool handler functions (all 12 tools, mocked backend)
- [ ] 18.1.2 Unit tests: System prompt builder (all stages, all languages)
- [ ] 18.1.3 Unit tests: Response formatter (all message types)
- [ ] 18.1.4 Unit tests: Session side effects (booking_id stored, state transitions)
- [ ] 18.1.5 Unit tests: Rate limiting logic
- [ ] 18.1.6 Unit tests: Input sanitization
- [ ] 18.1.7 Integration tests: Full WebSocket flow (connect → auth → message → response → disconnect)
- [ ] 18.1.8 Integration tests: Tool execution with mocked backend
- [ ] 18.1.9 Integration tests: Payment handoff flow
- [ ] 18.1.10 Property tests: `ConversationState` serialization round-trip
- [ ] 18.1.11 Property tests: Tool schema validation (all 12 tools)
- [ ] 18.1.12 Achieve ≥ 80% code coverage

### Task 18.2: Frontend Tests

- [ ] 18.2.1 Unit tests: `useDraggableResizable` (drag, snap, resize, keyboard)
- [ ] 18.2.2 Unit tests: `vibeBookingStore` (persist, message limits, layout reset)
- [ ] 18.2.3 Unit tests: Content renderers (valid data, invalid data fallback, action clicks)
- [ ] 18.2.4 Unit tests: `useContentRouter` (all message types)
- [ ] 18.2.5 Unit tests: Zod schema validation for all 14 Content Types
- [ ] 18.2.6 Integration tests: WebSocket content routing (mock WS server)
- [ ] 18.2.7 Integration tests: Booking flow (booking_summary → qr_payment → booking_confirmed)
- [ ] 18.2.8 E2E tests (Playwright): Complete booking flow
- [ ] 18.2.9 E2E tests: Auto-reconnect and message queue
- [ ] 18.2.10 E2E tests: Multi-language rendering

---

## Phase 19: End-to-End Integration

- [ ] 19.1 Verify all 12 `/v1/ai-tools/*` backend endpoints are implemented and accept `X-Service-Key`
- [ ] 19.2 Test each tool end-to-end with the running backend
- [ ] 19.3 Verify frontend can connect to `ws://localhost:8000/ws/chat`
- [ ] 19.4 Test `requires_payment` → frontend payment UI → `payment_completed` → confirmation flow
- [ ] 19.5 Test auto-reconnect from frontend (kill agent, restart, verify session resumes)
- [ ] 19.6 Test offline message queue (disconnect frontend, send messages, reconnect, verify delivery)
- [ ] 19.7 Test multi-language conversations (EN, ZH, KM)
- [ ] 19.8 Test emergency flow (`send_sos_alert`, `get_emergency_contacts`)

---

## Phase 20: Production Readiness

- [ ] 20.1 Verify all environment variables documented in `.env.example` (both frontend and backend)
- [ ] 20.2 Verify `HEALTHCHECK` in Dockerfile responds correctly
- [ ] 20.3 Verify `GET /metrics` returns valid Prometheus format
- [ ] 20.4 Verify Sentry error tracking captures exceptions
- [ ] 20.5 Verify CORS allows `https://derlg.com` and `https://www.derlg.com`
- [ ] 20.6 Verify rate limiting is active in production config
- [ ] 20.7 Deploy Docker containers to VPS and verify `GET /health` responds
- [ ] 20.8 Run load test with 50 concurrent WebSocket connections
- [ ] 20.9 Run Lighthouse audit on `/vibe-booking` (target: Performance > 90, CLS < 0.1)
- [ ] 20.10 Run accessibility audit (axe-core or Lighthouse, target: 0 violations)

---

## Success Criteria

- All 12 tools implemented and tested end-to-end
- 6-stage conversation flow (GREETING → DISCOVERY → RECOMMEND → BOOKING → PAYMENT → CONFIRMED) working
- WebSocket at `/ws/chat` stable with auto-reconnect
- Payment handoff (`requires_payment` / `payment_completed`) working with frontend
- Multi-language support (en, zh, km) functional
- Session persistence: Redis active + PostgreSQL archive on disconnect
- Split-screen Stream Mode rendering all 14 Content Types
- Chat Panel draggable, resizable, snap-to-dock, keyboard accessible
- ≥ 80% test coverage (both frontend and backend)
- Production Docker deployment on VPS with health check passing
- Lighthouse Performance > 90, CLS < 0.1, Accessibility 0 violations

---

*Reference: `.kiro/specs/vibe-booking-final/requirements.md`, `.kiro/specs/vibe-booking-final/design.md`*
