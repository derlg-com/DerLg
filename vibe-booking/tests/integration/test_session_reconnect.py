"""Task 11.2.4 — Session persistence: save, load, reconnect (R5)."""
import json
import pytest
from unittest.mock import AsyncMock, patch
from agent.session.state import ConversationState, AgentState
from agent.session.manager import SessionManager

SESSION_TTL = 604800  # 7 days


@pytest.fixture
def session():
    s = ConversationState(session_id="reconnect-test", user_id="user-42")
    s.messages = [{"role": "user", "content": "I want to visit Angkor Wat"}]
    s.preferred_language = "EN"
    return s


@pytest.mark.asyncio
async def test_session_saved_with_7day_ttl(session):
    """R5.1 — Sessions stored with 7-day TTL."""
    mock_redis = AsyncMock()

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        await manager.save(session)

        call_args = mock_redis.setex.call_args
        key, ttl, _ = call_args[0]
        assert key == f"session:{session.session_id}"
        assert ttl == SESSION_TTL


@pytest.mark.asyncio
async def test_session_restored_on_reconnect(session):
    """R5.3 — Redis state restored on reconnect within 7 days."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = session.to_json()

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        loaded = await manager.load(session.session_id)

        assert loaded is not None
        assert loaded.session_id == session.session_id
        assert loaded.user_id == session.user_id
        assert len(loaded.messages) == 1
        assert loaded.messages[0]["content"] == "I want to visit Angkor Wat"


@pytest.mark.asyncio
async def test_new_session_started_when_redis_expired():
    """R5.4 — New session when Redis TTL expired (key missing)."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        result = await manager.load("expired-session-id")
        assert result is None


@pytest.mark.asyncio
async def test_conversation_resumed_message_sent_on_reconnect():
    """R5.5 — conversation_resumed sent when prior session exists."""
    from fastapi.testclient import TestClient

    existing_session = ConversationState(session_id="existing-sess", user_id="user-99")
    existing_session.messages = [{"role": "user", "content": "previous message"}]

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._flush_to_postgres", new_callable=AsyncMock), \
         patch("api.websocket._verify_jwt", return_value="user-99"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=existing_session)
        mock_sm.save = AsyncMock()

        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(json.dumps({
                    "type": "auth",
                    "user_id": "user-99",
                    "session_id": "existing-sess",
                    "preferred_language": "EN",
                }))
                init_msg = ws.receive_json()
                assert init_msg["type"] == "conversation_resumed"


@pytest.mark.asyncio
async def test_session_state_preserved_across_messages(session):
    """Session state (stage, booking_id) survives save/load cycle."""
    session.state = AgentState.BOOKING
    session.booking_id = "booking-xyz"

    mock_redis = AsyncMock()
    mock_redis.get.return_value = session.to_json()

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        await manager.save(session)
        loaded = await manager.load(session.session_id)

        assert loaded.state == AgentState.BOOKING
        assert loaded.booking_id == "booking-xyz"
