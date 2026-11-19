"""Session persistence: save, load, reconnect."""
import json
import pytest
from unittest.mock import AsyncMock, patch
from agent.session.state import ConversationState
from agent.session.manager import SessionManager

SESSION_TTL = 604800  # 7 days


@pytest.fixture
def session():
    s = ConversationState(session_id="reconnect-test", user_id="user-42")
    s.messages = [{"role": "user", "content": "I want to visit Angkor Wat"}]
    return s


@pytest.mark.asyncio
async def test_session_saved_with_7day_ttl(session):
    """Sessions stored with 7-day TTL."""
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
    """Redis state restored on reconnect within 7 days."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = session.to_json()
    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        loaded = await manager.load(session.session_id)
        assert loaded is not None
        assert loaded.session_id == session.session_id
        assert loaded.messages[0]["content"] == "I want to visit Angkor Wat"


@pytest.mark.asyncio
async def test_new_session_started_when_redis_expired():
    """New session when Redis TTL expired (key missing)."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        result = await manager.load("expired-session-id")
        assert result is None


@pytest.mark.asyncio
async def test_conversation_resumed_message_sent_on_reconnect():
    """conversation_resumed sent when prior session exists."""
    existing_session = ConversationState(session_id="existing-sess", user_id="user-99")
    existing_session.messages = [{"role": "user", "content": "previous message"}]

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="user-99"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=existing_session)
        mock_sm.save = AsyncMock()

        from main import app
        from fastapi.testclient import TestClient
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
async def test_guest_cannot_hijack_authenticated_session():
    """An unauthenticated guest connecting with an authenticated user's session_id is given a fresh session."""
    existing_session = ConversationState(session_id="auth-sess-1", user_id="victim-user", is_authenticated=True)
    existing_session.messages = [{"role": "user", "content": "secret itinerary details"}]

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value=None), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=existing_session)
        mock_sm.save = AsyncMock()

        from main import app
        from fastapi.testclient import TestClient
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(json.dumps({
                    "type": "auth",
                    "user_id": "attacker-guest",
                    "session_id": "auth-sess-1",
                    "preferred_language": "EN",
                }))
                init_msg = ws.receive_json()
                # Must be conversation_started with a NEW session_id, not resumed!
                assert init_msg["type"] == "conversation_started"
                assert init_msg["session_id"] != "auth-sess-1"


@pytest.mark.asyncio
async def test_different_user_cannot_hijack_authenticated_session():
    """A different authenticated user connecting with another user's session_id is given a fresh session."""
    existing_session = ConversationState(session_id="auth-sess-2", user_id="victim-user", is_authenticated=True)
    existing_session.messages = [{"role": "user", "content": "secret itinerary details"}]

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="attacker-user"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=existing_session)
        mock_sm.save = AsyncMock()

        from main import app
        from fastapi.testclient import TestClient
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(json.dumps({
                    "type": "auth",
                    "user_id": "attacker-user",
                    "session_id": "auth-sess-2",
                    "token": "valid.token.for.attacker",
                    "preferred_language": "EN",
                }))
                init_msg = ws.receive_json()
                # Must be conversation_started with a NEW session_id, not resumed!
                assert init_msg["type"] == "conversation_started"
                assert init_msg["session_id"] != "auth-sess-2"


@pytest.mark.asyncio
async def test_new_authenticated_session_does_not_rebind():
    """A brand-new authenticated session should create_session but NOT rebind_user."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="user-123"), \
         patch("api.websocket.archive.create_session", new_callable=AsyncMock, return_value=True) as mock_create, \
         patch("api.websocket.archive.rebind_user", new_callable=AsyncMock, return_value=True) as mock_rebind, \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        from main import app
        from fastapi.testclient import TestClient
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(json.dumps({
                    "type": "auth",
                    "user_id": "user-123",
                    "session_id": "new-sess-1",
                    "token": "valid.token",
                    "preferred_language": "EN",
                }))
                init_msg = ws.receive_json()
                assert init_msg["type"] == "conversation_started"

        # Give the background task a chance to run
        import asyncio
        await asyncio.sleep(0.05)
        mock_create.assert_awaited_once()
        mock_rebind.assert_not_called()


@pytest.mark.asyncio
async def test_guest_session_promoted_calls_rebind():
    """A previously anonymous guest session that now connects with auth MUST rebind_user."""
    existing_session = ConversationState(session_id="guest-sess-1", user_id="guest-anon-1", is_authenticated=False)

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="user-456"), \
         patch("api.websocket.archive.create_session", new_callable=AsyncMock, return_value=True) as mock_create, \
         patch("api.websocket.archive.rebind_user", new_callable=AsyncMock, return_value=True) as mock_rebind, \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=existing_session)
        mock_sm.save = AsyncMock()

        from main import app
        from fastapi.testclient import TestClient
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(json.dumps({
                    "type": "auth",
                    "user_id": "user-456",
                    "session_id": "guest-sess-1",
                    "token": "valid.token",
                    "preferred_language": "EN",
                }))
                init_msg = ws.receive_json()
                assert init_msg["type"] == "conversation_resumed"

        import asyncio
        await asyncio.sleep(0.05)
        mock_create.assert_awaited_once()
        mock_rebind.assert_awaited_once()


@pytest.mark.asyncio
async def test_disconnect_before_auth_exits_cleanly():
    """Closing websocket before sending auth must not raise ASGI exception."""
    with patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        from main import app
        from fastapi.testclient import TestClient
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.close()


