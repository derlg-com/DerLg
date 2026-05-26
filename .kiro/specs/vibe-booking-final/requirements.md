# Requirements: Vibe Booking — AI Travel Concierge

> **Source of truth:** `.kiro/specs/vibe-booking-final/`  
> **Feature IDs:** F10–F16  
> **Scope:** MVP  
> **Services:** AI Agent (`vibe-booking/`), Frontend Stream Mode (`frontend/app/(app)/vibe-booking/`)

---

## Introduction

Vibe Booking is DerLg's conversational AI travel concierge. It consists of two tightly coupled subsystems:

1. **AI Agent Service** — Python FastAPI microservice running LangGraph + gpt-oss-120b. Communicates with the frontend via WebSocket and calls NestJS backend tool endpoints (`/v1/ai-tools/*`).
2. **Frontend Stream Mode** — Next.js split-screen interface. Chat panel on the left drives rich, interactive content on the right (Content Stage). Content streams in real-time as AI tools return results.

The agent **never writes to the database directly** and **never executes payments**. All mutations go through backend tool endpoints authenticated with `X-Service-Key`. Payment is handled by the frontend after the agent sends a `requires_payment` message.

---

## Glossary

| Term | Definition |
|------|-----------|
| **AI Agent** | Python FastAPI service in `vibe-booking/` |
| **LangGraph** | State machine framework orchestrating conversation flow |
| **ConversationState** | Pydantic model holding the full session context |
| **Tool** | A function the agent calls via HTTP to the NestJS backend |
| **Service Key** | `X-Service-Key` header authenticating agent → backend calls |
| **Booking Hold** | 15-minute `RESERVED` status created by `create_booking_hold` tool |
| **requires_payment** | Structured WS message telling the frontend to render payment UI |
| **payment_completed** | WS message sent by frontend after successful payment |
| **Chat Panel** | Draggable, resizable chat interface (left pane) |
| **Content Stage** | Right-side viewport rendering rich content from AI tool results |
| **Stream Mode** | Real-time behavior where content appears as tool results arrive |
| **Content Item** | A single rendered unit on the Content Stage |
| **Content Type** | The `type` field in an AI response that determines which renderer to use |

---

## Requirements

### Requirement 1: AI Agent — FastAPI Foundation

**User Story:** As a developer, I want a properly configured FastAPI application with WebSocket support so that I can build a real-time conversational AI service.

#### Acceptance Criteria

1. The AI Agent SHALL use Python 3.11+.
2. The AI Agent SHALL use FastAPI for HTTP and WebSocket endpoints.
3. The AI Agent SHALL expose a WebSocket endpoint at `/ws/chat`.
4. The AI Agent SHALL expose a health check at `GET /health`.
5. The AI Agent SHALL allow CORS from `https://derlg.com` and `https://www.derlg.com` for HTTP endpoints.
6. The AI Agent SHALL use Pydantic BaseSettings for all configuration.
7. The AI Agent SHALL use async/await for all I/O operations.
8. The AI Agent SHALL be located in the `vibe-booking/` directory.
9. The AI Agent SHALL listen on port `8000` in development and production.

---

### Requirement 2: WebSocket Protocol (Unified)

**User Story:** As a traveler, I want to chat with the AI in real-time so that I can plan and book my trip conversationally.

#### Acceptance Criteria

1. The WebSocket endpoint SHALL be `wss://ai.derlg.com/ws/chat` (prod) / `ws://localhost:8000/ws/chat` (dev).
2. The client SHALL authenticate via Bearer JWT in the connection `Authorization` header or query param.
3. The AI Agent SHALL reject connections with invalid JWTs (close code 1008).
4. The first message after connection MAY be an `auth` message with `userId`, `sessionId`, `preferredLanguage`, and `token` for clients that cannot send headers.
5. Client → Server messages SHALL support:
   - `user_message` — `{ "type": "user_message", "conversation_id": "...", "content": "..." }`
   - `user_action` — `{ "type": "user_action", "actionType": "...", "itemId": "...", "data": {...} }` (button clicks from Content Stage)
   - `payment_completed` — `{ "type": "payment_completed", "booking_id": "..." }`
   - `location` — `{ "type": "location", "lat": ..., "lng": ... }` (shared location)
   - `ping` — heartbeat
6. Server → Client messages SHALL support:
   - `agent_message` — text response with optional `content_payload` for Content Stage
   - `typing_start` / `typing_end` — processing indicators
   - `tool_call` — informational: tool being executed
   - `requires_payment` — `{ "type": "requires_payment", "booking_id": "...", "amount_usd": ..., "methods": ["stripe","bakong"] }`
   - `payment_status` — pushed status update `{ "type": "payment_status", "booking_id": "...", "status": "PENDING|SUCCEEDED|FAILED" }`
   - `booking_hold_expiry` — `{ "type": "booking_hold_expiry", "booking_id": "...", "secondsRemaining": ... }`
   - `agent_stream_chunk` — incremental content update during parallel tool execution
   - `agent_tool_status` — `{ "type": "agent_tool_status", "tool_name": "...", "status": "started|completed|failed" }`
   - `pong` — heartbeat response
   - `error` — error notification
7. The AI Agent SHALL support `ping` / `pong` heartbeat messages (every 30s).
8. The AI Agent SHALL queue messages sent while offline and flush on reconnect.

---

### Requirement 3: LangGraph State Machine

**User Story:** As a developer, I want a state machine that manages conversation flow so that the AI progresses through the booking journey systematically.

#### Acceptance Criteria

1. The AI Agent SHALL use LangGraph `StateGraph` to define conversation flow.
2. The state machine SHALL have the following stages: `GREETING → DISCOVERY → RECOMMEND → BOOKING → PAYMENT → CONFIRMED`.
3. The AI Agent SHALL define three nodes: `call_llm`, `execute_tools`, `format_response`.
4. WHEN `call_llm` returns `stop_reason = "tool_use"`, the next node SHALL be `execute_tools`.
5. WHEN `call_llm` returns `stop_reason = "end_turn"`, the next node SHALL be `format_response`.
6. WHEN `execute_tools` completes, the next node SHALL be `call_llm` (loop).
7. The AI Agent SHALL enforce a maximum of 5 tool-call iterations per turn to prevent infinite loops.
8. The AI Agent SHALL use `RedisSaver` as the LangGraph checkpointer.

---

### Requirement 4: Conversation State Management

**User Story:** As a developer, I want a comprehensive state model so that all conversation context is tracked and persisted.

#### Acceptance Criteria

1. `ConversationState` SHALL be a Pydantic model with fields:
   - `messages: list[Message]` — full conversation history
   - `user_id: str` — DerLg user ID
   - `conversation_id: str` — unique conversation identifier
   - `intent: str | None` — detected intent (`plan`, `book`, `ask`, `emergency`, `hotel_search`, `trip_search`, `transport_search`, `guide_search`, `budget_estimate`)
   - `pending_tool_calls: list[dict]`
   - `last_action: str | None`
   - `last_tool_call: str | None` — prevent duplicate tool calls
   - `context: dict` — arbitrary session context (dates, budget, selected_trip_id, selected_hotel_id, active_booking_id, user_location, search_filters)
   - `preferred_language: str` — `en`, `zh`, or `km`
   - `booking_id: str | None`
2. `ConversationState` SHALL serialize to/from JSON for Redis storage.
3. The AI Agent SHALL support `preferred_language` and respond in that language.

---

### Requirement 5: Session Persistence

**User Story:** As a traveler, I want my conversation to persist across disconnections so that I can resume where I left off.

#### Acceptance Criteria

1. Active sessions SHALL be stored in Redis with key `ai:conv:{user_id}` and 7-day TTL.
2. WHEN a WebSocket disconnects, the final conversation state SHALL be flushed to PostgreSQL (`conversations` and `messages` tables).
3. WHEN a user reconnects within 7 days, the Redis state SHALL be restored.
4. WHEN a user reconnects after the Redis TTL expires, a new session SHALL start; archived history from PostgreSQL MAY be loaded as a summary.
5. On successful connection, the AI Agent SHALL send `conversation_resumed` if a prior session exists, otherwise `conversation_started`.

---

### Requirement 6: Tool Calling — Available Tools (Unified)

**User Story:** As a developer, I want all agent tools defined so that gpt-oss-120b knows what functions it can call.

#### Acceptance Criteria

The AI Agent SHALL define the following tools, each calling the corresponding backend endpoint with `X-Service-Key` header:

| Tool | Method | Backend Path | Purpose |
|------|--------|-------------|---------|
| `search_hotels` | GET | `/v1/ai-tools/hotels` | Find hotels by city, date, price range, amenities |
| `search_trips` | GET | `/v1/ai-tools/trips` | Find trip packages by destination, duration, budget |
| `search_guides` | GET | `/v1/ai-tools/guides` | Find tour guides by location and language |
| `search_transport` | GET | `/v1/ai-tools/transport` | Find transport options (van, bus, tuk-tuk) by origin/destination |
| `check_availability` | GET | `/v1/ai-tools/availability` | Check inventory for a specific item and date |
| `create_booking_hold` | POST | `/v1/ai-tools/booking-holds` | Create a `RESERVED` booking (15-min hold) |
| `get_weather` | GET | `/v1/ai-tools/weather` | Current weather and 5-day forecast for a location |
| `get_emergency_contacts` | GET | `/v1/ai-tools/emergency-contacts` | Nearby emergency services |
| `send_sos_alert` | POST | `/v1/ai-tools/sos` | Trigger an emergency alert |
| `get_user_loyalty` | GET | `/v1/ai-tools/loyalty` | Read user's current points and tier |
| `estimate_budget` | POST | `/v1/ai-tools/budget/estimate` | Estimate trip cost breakdown by category |
| `check_payment_status` | GET | `/v1/ai-tools/payments/{payment_intent_id}/status` | Check payment status for a booking |

**Tool Filtering Rules:**
- `hotel_search` intent → ONLY `search_hotels`, `check_availability`
- `trip_search` intent → ONLY `search_trips`, `search_guides`, `search_transport`
- `create_booking_hold` is ONLY called after explicit user confirmation ("yes, book it").
- `send_sos_alert` is ONLY available when intent is `emergency`.

---

### Requirement 7: Tool Execution

**User Story:** As a developer, I want a tool executor that calls backend endpoints so that the AI can fetch real data and perform actions.

#### Acceptance Criteria

1. The AI Agent SHALL execute multiple tool calls in parallel using `asyncio.gather`.
2. All backend requests SHALL include `X-Service-Key: <AI_SERVICE_KEY>` header.
3. All backend requests SHALL include `Accept-Language: <locale>` header.
4. Tool HTTP requests SHALL have a 15-second timeout.
5. WHEN a tool call succeeds, it SHALL return `{"success": true, "data": {...}}`.
6. WHEN a tool call fails, it SHALL return `{"success": false, "error": {"code": "...", "message": "..."}}`.
7. Tool execution errors SHALL not crash the WebSocket connection.

---

### Requirement 8: Payment Flow (Human-in-the-Loop)

**User Story:** As a traveler, I want to pay securely without the AI having access to my payment details so that my financial information is protected.

#### Acceptance Criteria

1. The AI Agent SHALL **never** execute payments or create Stripe charges.
2. WHEN a conversation reaches the payment stage, the AI Agent SHALL:
   a. Call `create_booking_hold` to create a `RESERVED` booking (15-min hold).
   b. Send a structured message: `{ "type": "requires_payment", "booking_id": "...", "amount_usd": ..., "methods": ["stripe", "bakong"] }`.
3. The frontend SHALL render the native payment UI (Stripe Elements or Bakong QR) on the Content Stage.
4. The frontend MAY poll `GET /v1/bookings/{booking_id}` or listen to WebSocket `payment_status` messages for real-time updates.
5. WHEN payment completes, the frontend SHALL send: `{ "type": "payment_completed", "booking_id": "..." }`.
6. The AI Agent SHALL resume the conversation with booking confirmation details after receiving `payment_completed`.
7. The Content Stage SHALL display a 15-minute countdown timer during `HOLDING` state.
8. WHEN the Booking Hold expires (15 minutes pass without payment), the Content Stage SHALL show an expiry notice with a "Restart Booking" button.

---

### Requirement 9: AI Capability Boundaries

**User Story:** As a system operator, I want clear boundaries on what the AI can and cannot do so that the system remains secure and predictable.

#### Acceptance Criteria

The AI Agent **CAN**:
1. Search and read data via `/v1/ai-tools/*` endpoints.
2. Create booking holds (`RESERVED` status) for the user to confirm.
3. Suggest payment methods and guide the user to checkout.
4. Answer questions about Cambodia travel, culture, and safety.
5. Call `estimate_budget` to provide cost breakdowns.

The AI Agent **CANNOT**:
1. Access the database directly.
2. Execute payments or create Stripe charges.
3. Modify confirmed bookings without explicit user confirmation.
4. Access admin-only data or other users' private information.

---

### Requirement 10: Multi-Language Support

**User Story:** As a traveler, I want to chat in my preferred language so that I can communicate naturally.

#### Acceptance Criteria

1. The AI Agent SHALL support English (`en`), Chinese (`zh`), and Khmer (`km`).
2. The locale SHALL be passed in the WebSocket `auth` message, `Authorization` header, or first `user_message`.
3. The AI Agent SHALL pass `Accept-Language` to all backend tool calls.
4. WHEN locale is `km`, the AI Agent SHALL always use the NVIDIA gpt-oss-120b client (best Khmer support).
5. The AI Agent SHALL respond in the user's preferred language.
6. The Frontend SHALL translate ALL Content Stage UI labels, buttons, placeholders via `next-intl`.
7. Currency formatting SHALL be locale-aware: USD `$189.00`, KHR `៛189,000`, CNY `¥189`.
8. Date formats SHALL be locale-aware: EN `May 10, 2026`, ZH `2026年5月10日`, KM `១០ ឧសភា ២០២៦`.
9. Khmer text SHALL render with proper font fallback (system Khmer fonts or Google Noto Sans Khmer) and correct line height.

---

### Requirement 11: Error Handling and Resilience

**User Story:** As a traveler, I want the AI to handle errors gracefully so that I can continue my conversation even when issues occur.

#### Acceptance Criteria

1. The AI Agent SHALL catch all exceptions in the WebSocket message handler.
2. WHEN an exception occurs, the AI Agent SHALL send a user-friendly error message.
3. The AI Agent SHALL implement 60-second timeout for model API calls.
4. The AI Agent SHALL implement 15-second timeout for backend tool calls.
5. The AI Agent SHALL retry model API calls once before returning an error.
6. The AI Agent SHALL implement a circuit breaker for backend API calls (open after 5 failures, 60-second cooldown).
7. Error messages SHALL NOT expose internal stack traces or system details.
8. WHEN an AI response contains an unknown or unsupported `content_payload.type`, the Frontend SHALL display a fallback `text_summary` instead of crashing.
9. WHEN a Content Item's Zod validation fails, the Frontend SHALL log the error and display an error card.
10. WHEN the WebSocket disconnects, the Frontend SHALL show a "Reconnecting..." banner with retry countdown.
11. All errors SHALL be recoverable — the user SHALL never need to refresh the page to continue.

---

### Requirement 12: Security

**User Story:** As a developer, I want secure service-to-service communication so that unauthorized access is prevented.

#### Acceptance Criteria

1. The AI Agent SHALL require `AI_SERVICE_KEY` (min 32 chars) for all backend requests.
2. The AI Agent SHALL validate Bearer JWT on every WebSocket connection.
3. The AI Agent SHALL implement rate limiting: 10 messages/minute per session.
4. The AI Agent SHALL sanitize user input before processing.
5. The AI Agent SHALL NOT log sensitive data (payment details, full JWT tokens) in plain text.
6. ALL user input into the chat SHALL be sanitized before rendering (XSS prevention) using DOMPurify.
7. ALL AI-generated HTML content SHALL be sanitized before insertion into the DOM.
8. The `booking_ref` and `payment_intent_id` SHALL never be logged to the browser console or exposed in URLs.
9. WebSocket connections SHALL use `wss://` (TLS) in production.
10. Local storage keys SHALL be prefixed with `derlg:` to avoid collisions.
11. QR code images for payment SHALL include a short expiry watermark or overlay to prevent screenshot reuse.

---

### Requirement 13: Logging and Monitoring

**User Story:** As a developer, I want comprehensive logging so that I can debug issues and track performance.

#### Acceptance Criteria

1. The AI Agent SHALL use `structlog` for structured JSON logging.
2. The AI Agent SHALL log all WebSocket connections, disconnections, and errors.
3. The AI Agent SHALL log all tool executions with name, latency, and success/failure.
4. The AI Agent SHALL expose `GET /metrics` in Prometheus format.
5. The AI Agent SHALL integrate with Sentry for error tracking.
6. Metrics SHALL include:
   - `ai_agent_active_connections`
   - `ai_agent_messages_total{status}`
   - `ai_agent_tool_calls_total{tool_name}`
   - `ai_agent_response_time_seconds{quantile}`

---

### Requirement 14: Deployment

**User Story:** As a developer, I want containerized deployment so that I can run the AI agent consistently across environments.

#### Acceptance Criteria

1. The AI Agent SHALL include a `Dockerfile` (multi-stage, Python 3.11-slim).
2. The AI Agent SHALL include a `Dockerfile.dev` with `uvicorn --reload`.
3. The `docker-compose.yml` SHALL include the `ai-agent` service with context `./vibe-booking`, port `8000:8000`.
4. The AI Agent SHALL include a `HEALTHCHECK` in the production Dockerfile.
5. The AI Agent SHALL support production deployment via Docker on a VPS.

---

### Requirement 15: Frontend — Split-Screen Layout Architecture

**User Story:** As a traveler, I want a two-pane booking interface so I can chat with the AI while simultaneously browsing rich trip content.

#### Acceptance Criteria

1. THE Frontend SHALL render a two-pane layout on desktop (viewport width >= 768px):
   - Left Pane (Chat Panel): default width 420px, contains AI chat.
   - Right Pane (Content Stage): fills remaining width, renders rich content.
2. THE Chat Panel SHALL be collapsible to a Floating Bubble at the bottom-right corner.
3. On mobile (viewport width < 768px), THE layout SHALL be single-pane with an overlay toggle.
4. THE Content Stage SHALL have a minimum width of 400px; if too narrow, Chat Panel auto-collapses.
5. THE entire layout SHALL fill the viewport height (100vh) with no outer page scrolling.
6. THE layout SHALL use CSS Flexbox/Grid with no layout shift (CLS < 0.1).

---

### Requirement 16: Frontend — Draggable and Resizable Chat Panel

**User Story:** As a traveler, I want to move and resize the chat window so it never blocks the content I am viewing.

#### Acceptance Criteria

1. THE Chat Panel SHALL be draggable by its header using mouse and touch events.
2. THE Chat Panel SHALL be resizable via a drag handle on its bottom-right corner.
3. Minimum dimensions: 320px width x 400px height. Maximum: 80% viewport width x 90% viewport height.
4. WHEN dragged within 40px of a screen edge, it SHALL snap to a Dock Position (`left`, `right`, `center`, `floating`).
5. Panel position, size, and dock SHALL persist in `localStorage` under key `derlg:vibe-booking:layout`.
6. Drag and resize SHALL be smooth (target 60fps) using `requestAnimationFrame` and CSS `transform`.
7. Drag SHALL be keyboard-accessible (Arrow keys move 10px; Shift + Arrow resize 10px).

---

### Requirement 17: Frontend — Content Stage Rich Rendering

**User Story:** As a traveler, I want to see beautiful, interactive content when the AI finds options for me.

#### Acceptance Criteria

1. THE Content Stage SHALL render content based on the AI response `content_payload.type` field.
2. THE Frontend SHALL support the following Content Types:
   - `trip_cards` — Grid of trip cards with image, title, price, duration, rating.
   - `hotel_cards` — Hotel listing cards with photo gallery, amenities, price per night.
   - `transport_options` — Comparison table of transportation modes.
   - `itinerary` — Day-by-day timeline with time slots and activities.
   - `map_view` — Interactive Leaflet.js map with markers.
   - `budget_estimate` — Breakdown visualization (stacked bar or pie chart).
   - `qr_payment` — Large QR code with amount, expiry countdown, instructions.
   - `booking_confirmed` — Confirmation card with reference, QR check-in code, itinerary, receipt download.
   - `payment_status` — Status badge with color, method, amount, timestamp.
   - `weather` — Weather forecast widget with 5-day outlook.
   - `image_gallery` — Photo gallery grid with lightbox.
   - `comparison` — Side-by-side comparison table for up to 3 items.
   - `text_summary` — Plain text summary fallback.
   - `booking_summary` — Booking review card with price breakdown before payment.
3. WHEN no content is active, THE Content Stage SHALL display a localized Placeholder State with suggested prompt chips.
4. Each Content Item SHALL transition in with fade + translate-y animation (300ms ease-out).
5. Content data SHALL be validated with Zod schemas before rendering.

---

### Requirement 18: Frontend — Stream Mode Real-Time Updates

**User Story:** As a traveler, I want to see content appear immediately as the AI finds it.

#### Acceptance Criteria

1. WHEN the AI calls a tool, THE Frontend SHALL display a Streaming Indicator on the Content Stage.
2. WHEN tool results arrive via WebSocket, THE Content Item SHALL appear immediately, even if the AI is still composing text.
3. WHEN data streams incrementally, cards SHALL render as soon as the first object arrives.
4. Skeleton loading placeholders SHALL show while data is loading.
5. THE Content Stage SHALL maintain a scrollable Content History.
6. A "Clear All" button SHALL dismiss all Content Items.

---

### Requirement 19: Frontend — Booking Through Chat (Closed Loop)

**User Story:** As a traveler, I want to book trips, hotels, and transport directly through chat.

#### Acceptance Criteria

1. WHEN the user says "book this" or clicks "Book Now", THE AI SHALL call `create_booking_hold`.
2. THE Content Stage SHALL display a Booking Summary Card with trip details, dates, guests, price breakdown, cancellation policy.
3. A "Confirm Booking" button SHALL trigger the `requires_payment` flow.
4. THE Content Stage SHALL display Payment Options: Stripe Card Form and Bakong QR Code.
5. WHEN payment succeeds, THE Content Stage SHALL show Booking Confirmed with reference `DLG-YYYY-NNNN`, QR check-in code, download receipt, add-to-calendar, share buttons.
6. WHEN payment fails, THE Content Stage SHALL show retry/cancel options.
7. The chat SHALL display a brief text summary of the booking outcome.

---

### Requirement 20: Frontend — Chat-Content Synchronization

**User Story:** As a traveler, I want the chat and content to feel connected.

#### Acceptance Criteria

1. WHEN the user clicks a card on the Content Stage, THE chat MAY auto-send a follow-up or show a quick info snippet.
2. Each chat message that triggered a Content Item SHALL have a "Jump to Content" button.
3. WHEN Content Stage scrolls to an item, the corresponding chat message SHALL highlight briefly.

---

### Requirement 21: Frontend — Accessibility

**User Story:** As a traveler with disabilities, I want to use Vibe Booking with keyboard and screen readers.

#### Acceptance Criteria

1. Drag operations SHALL be keyboard-accessible.
2. THE Chat Panel header SHALL have `role="dialog"` and proper `aria-label` when floating.
3. All Content Items SHALL have proper ARIA roles and focus rings.
4. Focus trapping SHALL work when Chat Panel is open in floating mode.
5. `prefers-reduced-motion` SHALL disable all animations.
6. Color contrast SHALL meet WCAG AA (4.5:1 normal text, 3:1 large text).
7. Status badges SHALL include text labels and icons (not color alone).

---

### Requirement 22: Frontend — Performance

**User Story:** As a traveler on a slow Cambodian mobile network, I want fast loading and smooth interaction.

#### Acceptance Criteria

1. THE Content Stage SHALL use `React.memo` on all renderer components.
2. WHEN Content History exceeds 50 items, virtual scrolling SHALL maintain 60fps.
3. Map tiles SHALL lazy-load with offline fallback.
4. Images SHALL use Next.js `<Image>` with `loading="lazy"` and responsive `sizes`.
5. CLS SHALL be < 0.1 during initial load and content updates.
6. Drag/resize SHALL not trigger React re-renders during operation.
7. Initial page load SHALL complete in under 2 seconds on simulated 3G (Lighthouse > 90).
8. The vibe-booking route bundle SHALL be < 150KB gzipped.

---

## Message Types Summary

| Type | Direction | Description |
|------|-----------|-------------|
| `auth` | Client → Server | Initial auth with userId, sessionId, preferredLanguage, token |
| `user_message` | Client → Server | User's chat input |
| `user_action` | Client → Server | Button click from Content Stage |
| `location` | Client → Server | Shared GPS coordinates |
| `payment_completed` | Client → Server | Frontend confirms payment success |
| `agent_message` | Server → Client | AI response with optional `content_payload` |
| `agent_stream_chunk` | Server → Client | Incremental content update |
| `agent_tool_status` | Server → Client | Tool execution progress |
| `tool_call` | Server → Client | Informational: tool being executed |
| `requires_payment` | Server → Client | Instructs frontend to render payment UI |
| `payment_status` | Server → Client | Real-time payment status push |
| `booking_hold_expiry` | Server → Client | Countdown warning for booking hold |
| `typing_start` / `typing_end` | Server → Client | AI processing indicators |
| `ping` / `pong` | Both | Heartbeat |
| `error` | Server → Client | Error notification |

---

## Error Codes

| Code | HTTP / WS | Scenario |
|------|-----------|----------|
| `CHAT_001` | 400 | Invalid message format |
| `CHAT_002` | 403 | Service key missing or invalid |
| `CHAT_003` | 429 | Rate limit exceeded (10 messages/min) |
| `CHAT_004` | 503 | AI service unavailable |
| `CHAT_005` | 1008 | Invalid JWT on WebSocket connect |
| `CHAT_006` | 400 | Booking confirmation failed |
| `CHAT_007` | 400 | Unknown content type received |
| `CHAT_008` | 400 | Content payload validation failed |

---

*Reference: `docs/product/prd.md`, `docs/product/feature-decisions.md`, `docs/platform/architecture/system-overview.md`*
