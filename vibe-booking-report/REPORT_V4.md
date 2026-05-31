# Vibe Booking — Security & Quality Code Review (v4)

**Date:** 2026-05-31
**Scope:** `vibe-booking/` Python AI agent only (agent, api, config, utils, models, tools, session)
**Method:** Static source review of all Python modules, cross-referenced against `graphify-out/` (commit `5624990d`, 8424 nodes / 9444 edges) and project steering rules.
**Verdict:** ❌ **REQUEST CHANGES / BLOCK** — 2 CRITICAL and 4 HIGH findings. Auth on the WebSocket can be bypassed in the current configuration, and a live API credential is sitting in plaintext.

> Note on prior reports: V2/V3 and `VIBE_BOOKING_TEST_REPORT.md` are **functional E2E test reports** (does the feature render cards, etc.). This report (V4) is a **security & code-quality review** and intentionally covers different ground — findings here are mostly orthogonal to the functional bugs already fixed.

---

## Severity Summary

| Severity | Count | IDs |
|----------|-------|-----|
| 🔴 CRITICAL | 2 | C1, C2 |
| 🟠 HIGH | 4 | H1, H2, H3, H4 |
| 🟡 MEDIUM | 6 | M1–M6 |
| 🟢 LOW | 5 | L1–L5 |

---

## 🔴 CRITICAL

### C1 — Live secret + weak service key in `.env`
**Files:** `vibe-booking/.env` (lines 2, 6), `config/settings.py:21-32`

```
NVIDIA_API_KEY=
AI_SERVICE_KEY=dev-service-key-must-be-at-least-32-chars-long
```

Two problems in one file:

1. **A real, live `nvapi-...` NVIDIA key is committed to disk in plaintext.** `.env` *is* gitignored (verified with `git check-ignore`), so it is not in git history — but it is a live billable credential sitting unencrypted in the working tree, and it directly violates the global steering rule "Never hardcode secrets." Anyone with read access to the host (or a leaked backup/container layer) gets a working key.
2. **`AI_SERVICE_KEY` is a guessable placeholder string.** Per `README.md` and `AGENTS.md`, this key is the *entire* security boundary protecting the backend `/v1/ai-tools/*` mutation endpoints (create booking, send SOS, payments). The `field_validator` only checks `len(v) >= 32` — `"dev-service-key-must-be-at-least-32-chars-long"` passes the length check but has near-zero entropy. If this value reaches any shared/staging/prod backend, the AI-agent security boundary is effectively open.

**Impact:** Credential compromise (billable LLM key); trivial forgery of the backend service identity → unauthorized bookings/SOS/payments.

**Fix:**
- **Rotate the NVIDIA key now** (assume it is burned) and the service key.
- Load both only from the environment/secret manager; never persist real values in a tree file. Keep `.env.example` with empty values (already correct).
- Strengthen the validator to reject low-entropy/known-placeholder values, e.g.:
```python
import math
from collections import Counter

@field_validator("ai_service_key")
@classmethod
def validate_service_key(cls, v: str) -> str:
    if len(v) < 32:
        raise ValueError("AI_SERVICE_KEY must be at least 32 characters")
    if "dev-service-key" in v or "must-be-at-least" in v:
        raise ValueError("AI_SERVICE_KEY looks like a placeholder; use a random secret")
    # Shannon entropy guard against repetitive/dictionary keys
    counts = Counter(v)
    entropy = -sum((c/len(v)) * math.log2(c/len(v)) for c in counts.values())
    if entropy < 3.5:
        raise ValueError("AI_SERVICE_KEY has insufficient entropy")
    return v
```

---

### C2 — WebSocket JWT signature verification is DISABLED in the current config
**File:** `api/websocket.py:54-66` (`_verify_jwt`)

```python
def _verify_jwt(token: str) -> str | None:
    try:
        import jwt as pyjwt
        from config.settings import settings
        secret = getattr(settings, "jwt_secret", None)
        if not secret:
            payload = pyjwt.decode(token, options={"verify_signature": False})   # ← no verification
        else:
            payload = pyjwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("sub") or payload.get("user_id")
    except Exception:
        return None
```

`settings.jwt_secret` defaults to `""` (`config/settings.py:30`) and the active `vibe-booking/.env` **does not set `JWT_SECRET` at all**. So the `if not secret:` branch is live: any token is decoded **without signature verification**. An attacker connects with `Authorization: Bearer <forged>` (or sends `token` in the auth message) where the payload is simply `{"sub": "<any-victim-user-uuid>"}`. `websocket_endpoint` (lines 105-115) then sets `session.user_id = verified_id` and `session.is_authenticated = True`, which:
- unlocks `create_booking_hold` and `send_sos_alert` as that victim (the deferred-auth gate at `core.py` keys off `session.is_authenticated`), and
- because `_execute_tool` server-injects `session.user_id` into user-scoped tools (`core.py:240-244`), the **forged id is treated as fully trusted** for the rest of the conversation.

Secondary issue: even when a secret *is* set, there is **no expiry validation** — `tech.md` mandates "JWT tokens expire after 15 minutes," but `options` never sets `verify_exp`, and `pyjwt` won't enforce `exp` unless it's present and checked.

**Impact:** Complete authentication bypass / user impersonation in the current configuration. This is the highest-impact finding in the service.

**Fix:**
- Make `jwt_secret` **required** (no insecure fallback). Fail closed: if no secret is configured, reject the connection rather than decoding without verification.
- Verify signature **and** expiry, and pin the algorithm to prevent `alg=none`:
```python
def _verify_jwt(token: str) -> str | None:
    import jwt as pyjwt
    from config.settings import settings
    if not settings.jwt_secret:
        logger.error("jwt_secret_not_configured")
        return None  # fail closed
    try:
        payload = pyjwt.decode(
            token, settings.jwt_secret, algorithms=["HS256"],
            options={"require": ["exp", "sub"], "verify_exp": True, "verify_signature": True},
        )
        return payload.get("sub") or payload.get("user_id")
    except pyjwt.InvalidTokenError:
        return None
```
- Add `jwt_secret` to startup validation in `main.py:_validate_startup()` so the service refuses to boot without it.

---

## 🟠 HIGH

### H1 — IDOR: model-supplied `user_id` / `booking_id` on non-scoped tools
**Files:** `agent/core.py:18` (`_USER_SCOPED_TOOLS`), `agent/tools/_defs.py:200-213` (`get_user_loyalty`), `:111-122` (`check_payment_status`), `:186-201` (`generate_payment_qr`)

`_execute_tool` only overrides `user_id` from the verified session for the two tools in `_USER_SCOPED_TOOLS = ("create_booking_hold", "send_sos_alert")`. But `get_user_loyalty` accepts a **model-supplied `user_id`** (`_defs.py:200-214`, `required: ["user_id"]` at line 211) and is *not* in that set. Whatever id the LLM puts in the arguments is sent straight to the backend with the all-powerful `X-Service-Key`. Likewise `check_payment_status` and `generate_payment_qr` take an arbitrary `booking_id` with no ownership binding to the session user.

Because the agent authenticates to the backend as a trusted service, the backend likely does *not* re-check per-user ownership on these reads → a user (or a prompt-injected conversation) can read **another user's loyalty balance / payment status** or generate a QR for **someone else's booking**.

**Impact:** Horizontal privilege escalation / data disclosure across users (PII + payment metadata).

**Fix:**
- Remove `user_id` from the `get_user_loyalty` tool schema entirely and inject it server-side; add it to `_USER_SCOPED_TOOLS`:
```python
_USER_SCOPED_TOOLS = ("create_booking_hold", "send_sos_alert", "get_user_loyalty")
```
- For `check_payment_status` / `generate_payment_qr`, have the backend verify the booking belongs to `session.user_id` (pass the verified user id alongside `booking_id` and enforce ownership server-side). Do not rely on the LLM to scope these.

### H2 — Rate limit is keyed on a client-controlled `session_id`
**Files:** `api/websocket.py:151` → `utils/redis.py:37-44`; `session_id` chosen at `websocket.py:94`

```python
session_id: str = auth.get("session_id") or str(uuid.uuid4())   # client supplies it
...
if not await check_rate_limit(session_id):                      # key = rate:{session_id}
```

The 10-messages/60s limiter (the only DoS / LLM-cost guard) is keyed entirely on the `session_id` the client sends in the auth frame. A client that wants to bypass it just sends a fresh random UUID per message — each one is a brand-new bucket. There is no IP-based or user-based fallback limit.

**Impact:** Trivial bypass of the abuse/cost control → unbounded LLM spend (the NVIDIA key is billable) and backend amplification.

**Fix:** Key the limiter on the authenticated `user_id` when present, and fall back to the client IP for guests — not on a value the client freely chooses:
```python
rl_key = session.user_id if session.is_authenticated else (websocket.client.host or session_id)
if not await check_rate_limit(rl_key):
    ...
```
Keep a second global per-IP limit at connection-accept time.

### H3 — `payment_completed` is trusted without backend verification
**File:** `api/websocket.py:209-213`

```python
elif msg.get("type") == "payment_completed":
    booking_id = str(msg.get("booking_id", ""))
    confirm_text = f"Payment completed for booking {booking_id}. Please confirm the booking and provide next steps."
    await websocket.send_json({"type": "typing_start"})
    async for event in run_agent_streaming(session, confirm_text):
        ...
```

The handler takes the client's word that payment succeeded and feeds the agent a "Payment completed…" prompt. There is **no call to verify the payment status with the backend/Stripe** before treating the booking as paid. A client can send `{"type":"payment_completed","booking_id":"..."}` for an unpaid (or someone else's) booking and the agent will proceed to "confirm the booking and provide next steps."

**Impact:** Payment-state spoofing — unpaid bookings can be driven into a confirmed/next-steps flow. Financial integrity risk.

**Fix:** Before synthesizing the confirmation, call the backend to verify the payment for `booking_id` is actually `PAID`/`SUCCEEDED` **and** that the booking belongs to `session.user_id`. Only then continue; otherwise return an error. Do not let the LLM be the arbiter of payment truth.

### H4 — No WebSocket Origin check (Cross-Site WebSocket Hijacking)
**Files:** `main.py:42-48` (CORS), `api/websocket.py:68` (`websocket_endpoint`)

`CORSMiddleware` is configured with a tight allow-list (`https://derlg.com`...), but **Starlette's CORS middleware does not apply to WebSocket handshakes** — the `Origin` header is never validated for `/ws/chat`. The endpoint accepts the upgrade from any origin. Combined with **C2** (forgeable/unverified tokens) and **H2** (no real per-user limit), a malicious web page in a victim's browser can open a chat session and drive the agent.

**Impact:** CSWSH — cross-origin pages can establish authenticated-looking agent sessions; amplifies C2/H1/H3.

**Fix:** Validate `Origin` against an allow-list before `await websocket.accept()`:
```python
ALLOWED_WS_ORIGINS = {"https://derlg.com", "https://www.derlg.com"}
origin = websocket.headers.get("origin")
if origin not in ALLOWED_WS_ORIGINS:
    await _safe_close(websocket, code=4403)
    return
```
(Make the set configurable so localhost works in dev.)

---

## 🟡 MEDIUM

### M1 — `datetime.utcnow()` used as a Pydantic field default (shared timestamp + deprecation)
**File:** `agent/session/state.py:11-12`

```python
last_active: datetime = datetime.utcnow()
created_at: datetime = datetime.utcnow()
```

The expression is evaluated **once, at class-definition (import) time**, so every `ConversationState` created during the process shares the *same* `created_at`/`last_active` until explicitly overwritten — not the creation time of each session. `datetime.utcnow()` is also deprecated in Python 3.12+ and returns a naive datetime (the rest of the codebase uses tz-aware `datetime.now(timezone.utc)`, e.g. `session/manager.py`).

**Fix:** Use a `default_factory` with a tz-aware now:
```python
from datetime import datetime, timezone
from pydantic import Field

last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### M2 — Input "sanitizer" both over-blocks and under-blocks
**File:** `api/websocket.py:27-33` (`_INJECTION_PATTERNS`), `:47-52` (`_sanitize_input`)

```python
def _sanitize_input(text: str) -> str:
    text = text.strip()[:_MAX_CONTENT_LENGTH]
    if _INJECTION_PATTERNS.search(text):
        return ""        # silently drop
    return text
```

Two issues:
- **Over-blocking with silent failure:** any message containing `</?\w+\s*>` or phrases like "ignore previous" is replaced with `""`, and the caller (`websocket.py:146-148`, `:200-201`) just `continue`s with **no feedback** to the user. A legitimate message like *"the tour guide said 'disregard the instructions on the old ticket'"* or any text with `<3` style tokens silently vanishes — looks like the app is broken.
- **Under-blocking (false sense of security):** the regex is trivially bypassed ("ig​nore previous", base64, translation) and is Latin-centric — it cannot match prompt-injection written in Khmer or Chinese, which is a primary market for this product. Prompt-injection defense belongs at the system-prompt/tool-authorization layer (it already partly is, via server-side `user_id` injection), not a keyword regex.

**Fix:** Don't silently drop. Length-cap and strip control chars, but rely on the trust boundary (server-injected ids, backend authz) for safety. If you keep a heuristic, return a soft refusal message instead of `""`, and stop treating the regex as a security control.

### M3 — Unbounded session message history persisted to Redis
**Files:** `agent/core.py:253, 309` (`session.messages.append`), `agent/session/manager.py:8-12` (7-day TTL)

`run_agent`/`run_agent_streaming` only send the last `MAX_MESSAGES = 20` to the model, but they **append every turn (plus tool-call and tool-result messages) to `session.messages` forever** and persist the entire list to Redis with a 7-day TTL on every save. Long-lived sessions grow without bound: memory pressure on Redis, ever-larger (de)serialization per turn, and tool-result blobs (which can contain trip/hotel/payment data) accumulate well beyond what's needed.

**Fix:** Cap what is persisted (e.g. keep the last N messages, or summarize older turns):
```python
_PERSIST_CAP = 60
...
session.messages = session.messages[-_PERSIST_CAP:]
await session_manager.save(session)
```

### M4 — Dead, contradictory tool schema file (`schemas.py`) that would re-introduce IDOR
**File:** `agent/tools/schemas.py` (entire file, 270+ lines)

`TOOL_SCHEMAS` in `schemas.py` is **never imported anywhere** (confirmed: the only reference is its own definition). The live definitions are `ALL_TOOLS`/`TOOL_DISPATCH` in `agent/tools/_defs.py`. The dead file is not harmless documentation — it actively contradicts the live contract (Anthropic-style `input_schema` vs OpenAI `function`, different tool names like `createBooking`, `cancelBooking`, `applyDiscountCode` that don't exist in dispatch) and its `createBooking` takes a model-supplied `user_id` — exactly the IDOR pattern that `_defs.py` + `_USER_SCOPED_TOOLS` was written to prevent. A future maintainer wiring this up would silently reopen the hole.

**Fix:** Delete `agent/tools/schemas.py`. If any of those richer tools are roadmap items, move them to a spec/doc, not executable Python that shadows the real contract.

### M5 — Broad `except Exception` swallows errors across the service
**Files:** `agent/backend_client.py:45`, `agent/models/nvidia.py:49`, `api/websocket.py:64, 84, 173, 204, 230`, `agent/core.py:333`

The conventions doc (`.kiro/steering/conventions.md`, "AI Agent (Python)") says: *"Use `try/except` with specific exception types, never bare `except:`"*. The service repeatedly catches `except Exception` (and in `_verify_jwt`, returns `None` on *any* error, masking the difference between "expired token" and "malformed/attack"). This hides programming errors, makes debugging hard, and in `_verify_jwt` weakens the security posture.

**Fix:** Catch specific exceptions (`httpx.HTTPError`, `httpx.TimeoutException`, `json.JSONDecodeError`, `pyjwt.InvalidTokenError`, etc.). Where a broad catch is genuinely needed at a task boundary, log the exception type and re-raise unexpected ones.

### M6 — `/metrics` is unauthenticated **and** the metrics are never recorded
**File:** `api/health.py:9-35`

Two defects in one module:
- `active_connections`, `messages_processed`, `tool_calls_total`, `errors_total`, `response_time` are declared but **never incremented anywhere** in the codebase (grep shows no `.inc()/.observe()/.set()` calls). `/metrics` therefore always reports zeros — dead observability.
- `/metrics` has **no authentication** and is mounted at the app root. In the prod compose the agent port `8000` is published; depending on network exposure, Prometheus internals (and, once wired up, traffic patterns) are world-readable.

**Fix:** Either wire the counters into the WebSocket/agent paths and protect `/metrics` (bind to the internal network only, or require a scrape token), or remove the unused instrumentation to avoid a false sense of monitoring.

---

## 🟢 LOW

### L1 — Stray tracked log file committed to the repo
**File:** `vibe-booking/1`

`git ls-files` confirms `vibe-booking/1` is **tracked**. It's a captured uvicorn/WebSocket log (likely from `uvicorn ... > 1` shell redirection). It doesn't belong in version control.
**Fix:** `git rm --cached vibe-booking/1`, delete the file, and add a `logs/`/`*.log` ignore rule.

### L2 — `print`-based logger factory in production logging
**File:** `utils/logging.py:16` (`structlog.PrintLoggerFactory()`)

Structlog is configured with `PrintLoggerFactory`, which writes via `print()` to stdout. For a service that also initializes Sentry, prefer `structlog.WriteLoggerFactory()`/stdlib integration and ensure correlation IDs (request/session id) are bound — conventions ask for correlation IDs in every log entry.
**Fix:** Use a write-based factory and bind `session_id`/`user_id` via `contextvars` so logs are correlatable.

### L3 — Container runs as root
**File:** `Dockerfile:8-15`

No `USER` directive — the image runs as root, against container-hardening best practice (and the agent is network-exposed on `8000`).
**Fix:** Add a non-root user:
```dockerfile
RUN useradd --create-home --uid 10001 appuser
USER appuser
```

### L4 — Pydantic message models exist but the WebSocket parses raw dicts
**Files:** `agent/messages.py` (all models), `api/websocket.py:133-216`

`messages.py` defines `UserMessage`, `PaymentCompletedMessage`, etc., but the WebSocket handler parses everything with `json.loads` + `msg.get(...)` and never validates against these models. This is a missed-validation gap and contradicts the steering rule "Request/response models MUST use Pydantic `BaseModel`." Validating would have naturally surfaced H3's missing checks.
**Fix:** Parse inbound frames through the Pydantic models (e.g. a discriminated union on `type`) and reject on `ValidationError`.

### L5 — Unused imports / minor dead code
**Files:** `utils/circuit_breaker.py` (the `CircuitBreaker` class + `backend_breaker` singleton are unused — `backend_client.py` re-implements its own breaker inline), `agent/messages.py:2` (`Any` imported, unused).
**Fix:** Either adopt the shared `CircuitBreaker` in `BackendClient` (DRY) or delete the unused module; drop the unused `Any` import.

---

## Cross-reference with `graphify-out`

The knowledge graph (commit `5624990d`) corroborates the structural picture used in this review:
- `run_agent()` / `run_agent_streaming()` and `_execute_tool()` are central hubs (Communities around `agent/core.py`), confirming that the `_USER_SCOPED_TOOLS` injection point in `_execute_tool` is the single choke point for user-id trust — which is exactly why **H1**'s omission of `get_user_loyalty` matters.
- `_verify_jwt()`, `_sanitize_input()`, `websocket_endpoint()` cluster together with `check_rate_limit()` (graph node group at report line ~1910), matching the WebSocket trust-boundary analysis in **C2/H2/H4/M2**.
- No graph edges reference `agent/tools/schemas.py` (consistent with **M4**: it is dead/disconnected), whereas `_defs.py`'s `ALL_TOOLS`/`TOOL_DISPATCH` are on the live path.

The graph did not surface anything that contradicts these findings.

---

## Recommended fix order

1. **C2** (disable the unverified-JWT path; require + verify secret and `exp`) and **C1** (rotate key, strengthen service-key validation) — these are exploitable now.
2. **H1–H4** (IDOR scoping, real rate-limit key, payment verification, Origin check) — same release.
3. **M1, M4** (quick, high-value: timestamp factory bug; delete the IDOR-shaped dead schema).
4. **M2, M3, M5, M6** and the LOW items as follow-ups.

## What looks good

- The deferred-auth booking gate (`core.py:358-365`) and **server-side `user_id` injection** for `create_booking_hold` / `send_sos_alert` (`core.py:242-243`) are the right pattern — H1 is just an incomplete application of it.
- `_safe_close()` (`websocket.py:18-26`) correctly guards the ASGI double-close race.
- Pinned, exact dependency versions in `requirements.txt` (matches the steering "pinned versions" rule).
- Backend calls go through a single `BackendClient` with timeout + circuit breaker, and tools never touch the DB directly — the intended security boundary is structurally in place (it just needs the authz gaps above closed).
