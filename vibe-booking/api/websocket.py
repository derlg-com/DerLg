import asyncio
import json
import uuid
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
from agent.session.state import ConversationState
from agent.session.manager import SessionManager
from agent.core import run_agent
from agent.messages import RequiresPaymentMessage
from utils.logging import logger
from utils.redis import get_redis, check_rate_limit

active_connections: dict[str, WebSocket] = {}
session_manager = SessionManager()

WELCOME = {
    "EN": "Welcome to DerLg! I'm your Cambodia travel concierge. Tell me about your dream trip.",
    "KH": "សូមស្វាគមន៍មកកាន់ DerLg! ខ្ញុំជាអ្នកណែនាំការធ្វើដំណើររបស់អ្នក។",
    "ZH": "欢迎来到DerLg！我是您的柬埔寨旅行顾问。告诉我您梦想中的旅行。",
}
RESUME = {
    "EN": "Welcome back! I remember your previous conversation. How can I help you?",
    "KH": "សូមស្វាគមន៍ត្រឡប់មកវិញ! ខ្ញុំចងចាំការសន្ទនាមុនរបស់អ្នក។",
    "ZH": "欢迎回来！我记得您之前的对话。我可以继续帮助您吗？",
}


def _verify_jwt(token: str) -> str | None:
    """Return user_id from JWT, or None if invalid. Uses PyJWT if available."""
    try:
        import jwt as pyjwt
        from config.settings import settings
        secret = getattr(settings, "jwt_secret", None)
        if not secret:
            # No secret configured — extract sub without verification (dev mode)
            payload = pyjwt.decode(token, options={"verify_signature": False})
        else:
            payload = pyjwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("sub") or payload.get("user_id")
    except Exception:
        return None


async def _flush_to_postgres(session: ConversationState) -> None:
    """Archive session to PostgreSQL via backend API on disconnect."""
    try:
        from agent.backend_client import get_backend_client
        client = get_backend_client()
        await client.request(
            "POST",
            "ai-tools/conversations/archive",
            language=session.preferred_language.lower(),
            json={
                "conversation_id": session.session_id,
                "user_id": session.user_id,
                "messages": session.messages[-100],  # last 100 messages
                "state": session.state.value,
            },
        )
    except Exception as exc:
        logger.warning("postgres_flush_failed", session_id=session.session_id, error=str(exc))


async def websocket_endpoint(websocket: WebSocket) -> None:
    # Check Authorization header for JWT (task 6.1.2 / 10.2)
    auth_header = websocket.headers.get("authorization", "")
    token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    user_id_from_jwt: str | None = None
    if token:
        user_id_from_jwt = _verify_jwt(token)
        if not user_id_from_jwt:
            await websocket.close(code=1008)
            return

    await websocket.accept()

    # Auth message must be first
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        auth = json.loads(raw)
    except Exception:
        await websocket.close(code=4000)
        return

    if auth.get("type") != "auth" or not auth.get("user_id"):
        await websocket.send_json({"type": "error", "message": "Auth required"})
        await websocket.close(code=4001)
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

    session.user_id = user_id
    lang = auth.get("preferred_language", "EN").upper()
    if lang in ("EN", "KH", "ZH"):
        session.preferred_language = lang

    msg_type = "conversation_started" if is_new else "conversation_resumed"
    welcome_text = WELCOME[session.preferred_language] if is_new else RESUME[session.preferred_language]
    await websocket.send_json({
        "type": msg_type,
        "text": welcome_text,
        "state": session.state.value,
        "session_id": session_id,
    })

    payment_task = asyncio.create_task(_listen_payment_events(session, websocket))

    try:
        async for raw_msg in websocket.iter_text():
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            # Heartbeat (task 6.3.1)
            if msg_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                continue

            if msg_type == "user_message":
                content = str(msg.get("content", "")).strip()[:2000]  # sanitize length
                if not content:
                    continue

                if not await check_rate_limit(session_id):
                    await websocket.send_json({"type": "error", "message": "Too many messages. Please wait."})
                    continue

                await websocket.send_json({"type": "typing_start"})
                try:
                    response = await run_agent(session, content)
                    await session_manager.save(session)

                    # Check if agent wants to hand off to payment (task 7.1.1-7.1.3)
                    if response.get("type") == "requires_payment":
                        await websocket.send_json(response)
                    else:
                        await websocket.send_json({"type": "typing_end"})
                        await websocket.send_json({"type": "agent_message", "state": session.state.value, **response})
                except Exception as exc:
                    logger.error("agent_error", session_id=session_id, error=str(exc))
                    await websocket.send_json({"type": "typing_end"})
                    await websocket.send_json({"type": "error", "message": "Something went wrong. Please try again."})

            elif msg_type == "payment_completed":
                booking_id = msg.get("booking_id", session.booking_id)
                session.payment_status = "CONFIRMED"
                await session_manager.save(session)
                response = await run_agent(session, f"Payment completed for booking {booking_id}. Please confirm.")
                await websocket.send_json({"type": "agent_message", "state": session.state.value, **response})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("websocket_error", session_id=session_id, error=str(exc))
    finally:
        payment_task.cancel()
        active_connections.pop(session_id, None)
        if session:
            await session_manager.save(session)
            await _flush_to_postgres(session)


async def _listen_payment_events(session: ConversationState, websocket: WebSocket) -> None:
    try:
        r = get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe(f"payment_events:{session.user_id}")
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                event = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                continue
            if event.get("status") == "SUCCEEDED":
                from agent.session.state import AgentState
                session.state = AgentState.POST_BOOKING
                session.payment_status = "CONFIRMED"
                await session_manager.save(session)
                await websocket.send_json({"type": "payment_status", "payload": event})
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        logger.error("payment_listener_error", error=str(exc))
