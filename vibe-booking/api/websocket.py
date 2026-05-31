import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from agent.session.state import ConversationState
from agent.session.manager import SessionManager
from agent.core import run_agent_streaming
from agent.backend_client import get_backend_client
from utils.logging import logger
from utils.redis import check_rate_limit

active_connections: dict[str, WebSocket] = {}
session_manager = SessionManager()


async def _safe_close(websocket: WebSocket, code: int = 1000) -> None:
    """Close only if still connected — prevents the ASGI double-close
    RuntimeError under React StrictMode double-mount churn (Issue 11)."""
    if websocket.application_state != WebSocketState.DISCONNECTED:
        try:
            await websocket.close(code=code)
        except RuntimeError:
            pass

_INJECTION_PATTERNS = re.compile(
    r"(<script|javascript:|on\w+=|</?\w+\s*>|"
    r"ignore previous|disregard.*instructions|you are now|"
    r"system prompt|forget.*rules)",
    re.IGNORECASE,
)
_MAX_CONTENT_LENGTH = 2000

WELCOME = {
    "EN": "Welcome to DerLg! I'm your Cambodia travel concierge. Tell me about your dream trip.",
    "KH": "សូមស្វាគមន៍មកកាន់ DerLg! ខ្ញុំជាអ្នកណែនាំការធ្វើដំណើររបស់អ្នក។",
    "ZH": "欢迎来到DerLg！我是您的柬埔寨旅行顾问。告诉我您梦想中的旅行。",
}
RESUME = {
    "EN": "Welcome back! How can I help you continue planning your Cambodia trip?",
    "KH": "សូមស្វាគមន៍ត្រឡប់មកវិញ! ខ្ញុំអាចជួយអ្នកបន្តការធ្វើដំណើរទៅកម្ពុជាបានទេ?",
    "ZH": "欢迎回来！我可以继续帮您规划柬埔寨之旅吗？",
}


def _sanitize_input(text: str) -> str:
    """Trim to max length and strip injection-like tokens, preserving the rest
    of the message instead of silently discarding it (M2)."""
    text = text.strip()[:_MAX_CONTENT_LENGTH]
    return _INJECTION_PATTERNS.sub("", text).strip()


def _verify_jwt(token: str) -> str | None:
    """Verify an HS256 token signed by the backend (JWT_ACCESS_SECRET).

    Fails closed: if no secret is configured, or the signature/expiry is
    invalid, returns None so the caller treats the request as unauthenticated.
    """
    try:
        import jwt as pyjwt
    except ImportError:
        logger.error("pyjwt_not_installed")
        return None
    from config.settings import settings
    if not settings.jwt_secret:
        logger.error("jwt_secret_not_configured")
        return None
    try:
        payload = pyjwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"], "verify_exp": True, "verify_signature": True},
        )
        return payload.get("sub") or payload.get("user_id")
    except pyjwt.InvalidTokenError:
        return None


def _origin_allowed(origin: str | None) -> bool:
    """Allow when no Origin header is present (non-browser clients), else the
    Origin must be in the configured allowlist (CSWSH guard, H4)."""
    if not origin:
        return True
    from config.settings import settings
    allowed = {o.strip() for o in settings.allowed_ws_origins.split(",") if o.strip()}
    return origin in allowed


async def websocket_endpoint(websocket: WebSocket) -> None:
    if not _origin_allowed(websocket.headers.get("origin")):
        await _safe_close(websocket, code=4403)
        return

    auth_header = websocket.headers.get("authorization", "")
    token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    user_id_from_jwt: str | None = None
    if token:
        user_id_from_jwt = _verify_jwt(token)
        if not user_id_from_jwt:
            await _safe_close(websocket, code=1008)
            return

    await websocket.accept()

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        auth = json.loads(raw)
    except Exception:
        await _safe_close(websocket, code=4000)
        return

    if auth.get("type") != "auth" or not auth.get("user_id"):
        await websocket.send_json({"type": "error", "message": "Auth required"})
        await _safe_close(websocket, code=4001)
        return

    user_id: str = user_id_from_jwt or auth["user_id"]
    session_id: str = auth.get("session_id") or str(uuid.uuid4())
    try:
        uuid.UUID(session_id)
    except ValueError:
        session_id = str(uuid.uuid4())

    active_connections[session_id] = websocket

    session = await session_manager.load(session_id)
    is_new = session is None
    if is_new:
        session = ConversationState(session_id=session_id)

    # Deferred auth: a token may arrive in the initial header OR inside the auth
    # message (browsers can't set WS headers). A verified token re-binds the
    # session to the real user UUID and unlocks booking; otherwise stay a guest.
    msg_token = str(auth.get("token", "")).strip()
    verified_id = user_id_from_jwt or (_verify_jwt(msg_token) if msg_token else None)
    if verified_id:
        session.user_id = verified_id
        session.is_authenticated = True
    else:
        session.user_id = user_id
        session.is_authenticated = False

    # Rate-limit on a key the client cannot freely rotate: the verified user id
    # when authenticated, else the client IP for guests (H2). Never the
    # client-supplied session_id.
    client_ip = websocket.client.host if websocket.client else "unknown"
    rate_limit_key = session.user_id if session.is_authenticated else f"ip:{client_ip}"
    # Accept both old uppercase (EN/ZH/KH) and new lowercase (en/zh/km) — normalize to uppercase for session
    raw_lang = str(auth.get("preferred_language", "EN")).upper()
    # Map KH → KH (Khmer), also accept KM as alias
    lang_map = {"EN": "EN", "ZH": "ZH", "KH": "KH", "KM": "KH", "ZH-CN": "ZH"}
    lang = lang_map.get(raw_lang, "EN")
    session.preferred_language = lang

    welcome_text = WELCOME[session.preferred_language] if is_new else RESUME[session.preferred_language]
    await websocket.send_json({
        "type": "conversation_started" if is_new else "conversation_resumed",
        "text": welcome_text,
        "session_id": session_id,
    })

    try:
        async for raw_msg in websocket.iter_text():
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                continue

            if msg.get("type") == "user_message":
                content = _sanitize_input(str(msg.get("content", "")))
                if not content:
                    continue

                if not await check_rate_limit(rate_limit_key):
                    await websocket.send_json({"type": "error", "message": "Too many messages. Please wait."})
                    continue

                await websocket.send_json({"type": "typing_start"})
                try:
                    async for event in run_agent_streaming(session, content):
                        if event["type"] in ("agent_stream_chunk", "agent_reasoning_chunk", "agent_tool_status"):
                            await websocket.send_json(event)
                        elif event["type"] == "requires_login":
                            await session_manager.save(session)
                            await websocket.send_json({"type": "typing_end"})
                            await websocket.send_json(event)
                        elif event["type"] == "final":
                            await session_manager.save(session)
                            await websocket.send_json({"type": "typing_end"})
                            if event.get("requires_payment"):
                                await websocket.send_json({"type": "requires_payment", **event["requires_payment"]})
                            agent_msg: dict = {"type": "agent_message", "text": event["text"]}
                            if event.get("content_payload"):
                                agent_msg["content_payload"] = event["content_payload"]
                            await websocket.send_json(agent_msg)
                except Exception as exc:
                    logger.error("agent_error", session_id=session_id, error=str(exc))
                    await websocket.send_json({"type": "typing_end"})
                    await websocket.send_json({"type": "error", "message": "Something went wrong. Please try again."})

            elif msg.get("type") == "user_action":
                action_type = str(msg.get("action_type", ""))
                payload = msg.get("payload") or {}
                # Synthesize a user message so the agent can respond to the action
                action_text = f"[Action: {action_type}] {json.dumps(payload)}" if payload else f"[Action: {action_type}]"
                content = _sanitize_input(action_text)
                if not content:
                    continue
                await websocket.send_json({"type": "typing_start"})
                try:
                    async for event in run_agent_streaming(session, content):
                        if event["type"] in ("agent_stream_chunk", "agent_reasoning_chunk", "agent_tool_status"):
                            await websocket.send_json(event)
                        elif event["type"] == "requires_login":
                            await session_manager.save(session)
                            await websocket.send_json({"type": "typing_end"})
                            await websocket.send_json(event)
                        elif event["type"] == "final":
                            await session_manager.save(session)
                            await websocket.send_json({"type": "typing_end"})
                            if event.get("requires_payment"):
                                await websocket.send_json({"type": "requires_payment", **event["requires_payment"]})
                            agent_msg = {"type": "agent_message", "text": event["text"]}
                            if event.get("content_payload"):
                                agent_msg["content_payload"] = event["content_payload"]
                            await websocket.send_json(agent_msg)
                except Exception as exc:
                    logger.error("user_action_error", session_id=session_id, error=str(exc))
                    await websocket.send_json({"type": "typing_end"})
                    await websocket.send_json({"type": "error", "message": "Something went wrong. Please try again."})

            elif msg.get("type") == "payment_completed":
                booking_id = str(msg.get("booking_id", ""))
                # Never trust the client's claim of payment. Require an
                # authenticated session and confirm with the backend that the
                # payment actually succeeded before continuing (H3).
                if not session.is_authenticated or not booking_id:
                    await websocket.send_json({"type": "error", "message": "Cannot verify payment."})
                    continue
                status_resp = await get_backend_client().request(
                    "GET", "ai-tools/payments/status",
                    language=session.preferred_language.lower(),
                    params={"booking_id": booking_id},
                )
                pay_status = str((status_resp.get("data") or {}).get("status", "")).lower()
                if not status_resp.get("success") or pay_status != "succeeded":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Payment not confirmed yet. Please complete payment first.",
                    })
                    continue
                confirm_text = f"Payment confirmed for booking {booking_id}. Please confirm the booking and provide next steps."
                await websocket.send_json({"type": "typing_start"})
                try:
                    async for event in run_agent_streaming(session, confirm_text):
                        if event["type"] in ("agent_stream_chunk", "agent_reasoning_chunk", "agent_tool_status"):
                            await websocket.send_json(event)
                        elif event["type"] == "requires_login":
                            await session_manager.save(session)
                            await websocket.send_json({"type": "typing_end"})
                            await websocket.send_json(event)
                        elif event["type"] == "final":
                            await session_manager.save(session)
                            await websocket.send_json({"type": "typing_end"})
                            if event.get("requires_payment"):
                                await websocket.send_json({"type": "requires_payment", **event["requires_payment"]})
                            agent_msg = {"type": "agent_message", "text": event["text"]}
                            if event.get("content_payload"):
                                agent_msg["content_payload"] = event["content_payload"]
                            await websocket.send_json(agent_msg)
                except Exception as exc:
                    logger.error("payment_completed_error", session_id=session_id, error=str(exc))
                    await websocket.send_json({"type": "typing_end"})
                    await websocket.send_json({"type": "error", "message": "Something went wrong. Please try again."})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("websocket_error", session_id=session_id, error=str(exc))
    finally:
        active_connections.pop(session_id, None)
        if session:
            await session_manager.save(session)
