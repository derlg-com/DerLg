# Implementation Drift Annotations

> **Source:** `.kiro/specs/vibe-booking/tasks.md` (original backend spec)
> **Consolidated into:** `.kiro/specs/vibe-booking-final/tasks.md`
> **Note:** These drift annotations were present in the original but dropped during consolidation. They document real gaps between the spec and the running codebase.

---

## Phase 1: Project Foundation

### Task 1.1: Project Structure and Dependencies

- **1.1.1** Directory structure was planned as `agent/`, `websocket/`, `services/`, `models/` but was actually implemented as a flat layout: `agent/`, `api/`, `config/`, `utils/`.

---

## Phase 2: Data Models

### Task 2.1: Conversation State

- **2.1.1** `ConversationState` was implemented in `agent/session/state.py`. It is missing the following fields defined in the spec:
  - `intent`
  - `pending_tool_calls`
  - `last_action`
  - `context`
  - `conversation_id`

### Task 2.2: Redis Session Persistence

- **2.2.1** Redis client functions implemented in `utils/redis.py` (not `src/services/redis_client.py`).
- **2.2.2** Session key uses `session:{session_id}` instead of the specified `ai:conv:{user_id}`. TTL of 7 days is correct.
- **2.2.5** PostgreSQL flush on WebSocket disconnect is **not implemented**.

---

## Phase 3: LLM Client

### Task 3.1: gpt-oss-120b Client

- **3.1.1** Client implemented in `agent/models/nvidia.py` (not `src/services/gpt-oss-120b_client.py`).
- **3.1.6** Khmer-language routing to `gpt-oss-120bClient` (`preferred_language == "km"`) is implemented correctly.

---

## Phase 4: Tool System

### Task 4.2: Backend HTTP Client

- **4.2.2** Headers (`X-Service-Key`, `Accept-Language`) are implemented inline in `agent/tools/executor.py` rather than in a centralized `BackendClient` class.
- **4.2.4** Circuit breaker cooldown is **30 seconds** in the code; the spec requires **60 seconds**.

### Task 4.3: Parallel Tool Executor

- **4.3.1** Implemented in `agent/tools/executor.py`.

---

## Phase 5: LangGraph State Machine

### Task 5.1: Node Implementations

- **5.1.1** Nodes implemented in `agent/core.py` (not `src/agent/nodes.py`).
- **5.1.2** Max 5 tool-call iterations enforced in `agent/core.py`.

### Task 5.2: State Machine Definition

- **5.2.1** Graph built in `agent/graph.py` (not `src/agent/state_machine.py`).

### Task 5.3: System Prompt Builder

- **5.3.1** Implemented in `agent/prompts/builder.py` + `agent/prompts/templates.py` (not `src/agent/prompts.py`).

---

## Phase 6: WebSocket Handler

### Task 6.1: Connection Management

- **6.1.1** WebSocket endpoint implemented in `api/websocket.py`.
- **6.1.5** On disconnect: session is saved to Redis and removed from `active_connections`, but the PostgreSQL archive flush is **not implemented**.

### Task 6.2: Message Handling

- **6.2.6** Input sanitization is limited to basic `.strip()` only; there is **no injection sanitization** (XSS, prompt injection, etc.).

---

## Phase 9: Error Handling and Resilience

### Task 9.3: Circuit Breaker

- **9.3** Circuit breaker cooldown is **30 seconds** in code; spec requires **60 seconds**.

---

## Phase 10: Security

### Task 10.4: Input Sanitization

- **10.4** Sanitization is basic only (`.strip()`). No structured injection attack prevention.

---

## Phase 11: Testing

### Task 11.1: Unit Tests

- **11.1.1** Tests cover 20 tools, **not the 9 tools defined in this spec**.
- **11.1.6** Code coverage target is **≥ 80%**; current status unknown.

---

## Action Items

1. Add missing `ConversationState` fields (`intent`, `pending_tool_calls`, `last_action`, `context`, `conversation_id`) to `agent/session/state.py`.
2. Change Redis session key prefix from `session:{session_id}` to `ai:conv:{user_id}`.
3. Implement PostgreSQL archive flush on WebSocket disconnect.
4. Increase circuit breaker cooldown from 30s to 60s.
5. Add structured input sanitization (XSS / injection prevention).
6. Align tested tools with the 9 tools defined in the spec (or expand the spec to match the 20 tested tools).
