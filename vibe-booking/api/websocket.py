import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
from agent.session.state import ConversationState
from agent.session.manager import SessionManager
from agent.core import run_agent
from utils.logging import logger
from utils.redis import check_rate_limit

active_connections: dict[str, WebSocket] = {}
session_manager = SessionManager()

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
    text = text.strip()[:_MAX_CONTENT_LENGTH]
    if _INJECTION_PATTERNS.search(text):
        return ""
    return text


def _verify_jwt(token: str) -> str | None:
    try:
        import jwt as pyjwt
        from config.settings import settings
        secret = getattr(settings, "jwt_secret", None)
        if not secret:
            payload = pyjwt.decode(token, options={"verify_signature": False})
        else:
            payload = pyjwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("sub") or payload.get("user_id")
    except Exception:
        return None


async def websocket_endpoint(websocket: WebSocket) -> None:
    auth_header = websocket.headers.get("authorization", "")
    token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    user_id_from_jwt: str | None = None
    if token:
        user_id_from_jwt = _verify_jwt(token)
        if not user_id_from_jwt:
            await websocket.close(code=1008)
            return

    await websocket.accept()

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

                if not await check_rate_limit(session_id):
                    await websocket.send_json({"type": "error", "message": "Too many messages. Please wait."})
                    continue

                await websocket.send_json({"type": "typing_start"})
                try:
                    text = await run_agent(session, content)
                    await session_manager.save(session)
                    await websocket.send_json({"type": "typing_end"})
                    await websocket.send_json({"type": "agent_message", "text": text})
                except Exception as exc:
                    logger.error("agent_error", session_id=session_id, error=str(exc))
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
