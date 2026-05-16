import asyncio
import json
import uuid
from fastapi import WebSocket, WebSocketDisconnect
from agent.session.state import ConversationState
from agent.session.manager import SessionManager
from agent.core import run_agent
from utils.logging import logger
from utils.redis import get_redis

active_connections: dict[str, WebSocket] = {}
session_manager = SessionManager()

WELCOME_MESSAGES = {
    "EN": "Welcome to DerLg! I'm your Cambodia travel concierge. Tell me about your dream trip — where would you like to go?",
    "KH": "សូមស្វាគមន៍មកកាន់ DerLg! ខ្ញុំជាអ្នកណែនាំការធ្វើដំណើររបស់អ្នក។ សូមប្រាប់ខ្ញុំអំពីការធ្វើដំណើរដែលអ្នកbermimpi។",
    "ZH": "欢迎来到DerLg！我是您的柬埔寨旅行顾问。告诉我您梦想中的旅行——您想去哪里？",
}

RESUME_MESSAGES = {
    "EN": "Welcome back! I remember your previous conversation. How can I continue helping you?",
    "KH": "សូមស្វាគមន៍ត្រឡប់មកវិញ! ខ្ញុំចងចាំការសន្ទនាមុនរបស់អ្នក។",
    "ZH": "欢迎回来！我记得您之前的对话。我可以继续帮助您吗？",
}


async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    # Validate UUID format
    try:
        uuid.UUID(session_id)
    except ValueError:
        await websocket.close(code=4000)
        return

    await websocket.accept()
    active_connections[session_id] = websocket

    session = await session_manager.load(session_id)
    is_new = session is None
    if is_new:
        session = ConversationState(session_id=session_id)

    payment_task = None

    try:
        # Auth message
        raw = await websocket.receive_text()
        auth = json.loads(raw)
        if auth.get("type") != "auth" or not auth.get("user_id"):
            await websocket.send_json({"type": "error", "payload": {"message": "Auth required"}})
            return

        session.user_id = auth["user_id"]
        lang = auth.get("preferred_language", "EN")
        if lang in ("EN", "KH", "ZH"):
            session.preferred_language = lang

        welcome_text = WELCOME_MESSAGES[session.preferred_language] if is_new else RESUME_MESSAGES[session.preferred_language]
        await websocket.send_json({"type": "agent_message", "text": welcome_text, "state": session.state.value})

        payment_task = asyncio.create_task(
            _listen_for_payment_events(session, websocket)
        )

        # Message loop
        async for raw_msg in websocket.iter_text():
            msg = json.loads(raw_msg)
            if msg.get("type") != "user_message":
                continue

            content = msg.get("content", "").strip()
            if not content:
                continue

            # Rate limiting: 10 messages per minute per session (Req 16.7)
            from utils.redis import check_rate_limit
            if not await check_rate_limit(session_id):
                await websocket.send_json({"type": "error", "payload": {"message": "Too many messages. Please wait a moment."}})
                continue

            await websocket.send_json({"type": "typing_start"})
            try:
                response = await run_agent(session, content)
                await session_manager.save(session)
            except Exception as exc:
                logger.error("agent_error", session_id=session_id, error=str(exc))
                response = {"type": "text", "text": "Something went wrong. Please try again."}

            await websocket.send_json({"type": "typing_end"})
            await websocket.send_json({"type": "agent_message", "state": session.state.value, **response})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("websocket_error", session_id=session_id, error=str(exc))
    finally:
        if payment_task:
            payment_task.cancel()
        active_connections.pop(session_id, None)
        if session:
            await session_manager.save(session)


async def _listen_for_payment_events(session: ConversationState, websocket: WebSocket) -> None:
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
                response = await run_agent(session, "Payment confirmed. Please provide booking confirmation.")
                await websocket.send_json({"type": "agent_message", "state": session.state.value, **response})
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        logger.error("payment_listener_error", error=str(exc))
