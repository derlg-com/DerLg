# AI Integration Architecture

> **Phase 7** — Bridge between NestJS backend and Python AI agent. High-level contracts only.

---

## Service Boundary

```
Frontend → Backend (NestJS) → Python AI (FastAPI / LangGraph)
Python AI → Backend /v1/ai-tools/* (tool calls)
```

- **Chat flow:** Frontend calls backend chat endpoint; backend proxies to Python AI with timeout and retry logic.
- **Tool calls:** Python AI never writes directly to the database. It must call backend tool endpoints with a service key.

---

## Authentication

| Direction | Mechanism |
|-----------|-----------|
| Backend → Python AI | `X-Service-Key` header (shared secret) + request signing (optional future enhancement) |
| Python AI → Backend | `X-Service-Key` header validated by dedicated `AiToolsGuard` |

---

## Backend AI Client Module

- `AiClientModule` encapsulates HTTP calls to the Python service.
- Configurable timeout (default 30s), retry count (default 2), and circuit breaker policy.
- Logs all AI requests/responses at `debug` level; redact PII.

---

## Tool Endpoints (`/v1/ai-tools/*`)

These endpoints are **not** public. They are exclusively for the AI agent.

| Tool | Example Purpose |
|------|-----------------|
| `POST /v1/ai-tools/search-hotels` | Semantic / filtered hotel search |
| `POST /v1/ai-tools/create-booking-hold` | Place a temporary hold on inventory |
| `POST /v1/ai-tools/get-user-bookings` | Retrieve current user's trip context |

### Contract

- Input/output schemas defined as DTOs with `class-validator`.
- Rate limiting: separate bucket from public endpoints (e.g., 100 req / min / service key).
- Idempotency: AI client should send `Idempotency-Key` for mutating requests.

---

## Checklist

- [ ] `AiClientModule` created with timeout/retry configuration
- [ ] `AiToolsGuard` validating `X-Service-Key`
- [ ] Tool endpoint list finalized with input/output DTOs
- [ ] Rate limiting applied separately to `/v1/ai-tools/*`
- [ ] Idempotency key handling for mutating tool calls
- [ ] Logging redaction policy for AI traffic
