"""Task 11.2.1 — Full WebSocket flow: connect → auth → message → response → disconnect (R2, R6)."""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket


@pytest.fixture
def app():
    from main import app as _app
    return _app


@pytest.fixture
def mock_agent_response():
    return {"content": "Here are some great trips!", "suggestions": []}


@pytest.fixture
def valid_jwt():
    import jwt
    return jwt.encode({"sub": "user-test-1"}, "test-secret", algorithm="HS256")


def _make_auth_msg(session_id="sess-1", lang="EN"):
    return json.dumps({"type": "auth", "user_id": "user-test-1",
                       "session_id": session_id, "preferred_language": lang})


@pytest.mark.asyncio
async def test_websocket_full_flow(app, mock_agent_response):
    """Connect → auth → user_message → agent_message → disconnect."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.run_agent", new_callable=AsyncMock) as mock_run, \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=True), \
         patch("api.websocket._flush_to_postgres", new_callable=AsyncMock), \
         patch("api.websocket._verify_jwt", return_value="user-test-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()
        mock_run.return_value = mock_agent_response

        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                # Send auth
                ws.send_text(_make_auth_msg())
                init_msg = ws.receive_json()
                assert init_msg["type"] in ("conversation_started", "conversation_resumed")
                assert "session_id" in init_msg

                # Send user message
                ws.send_text(json.dumps({"type": "user_message", "content": "Find me a trip"}))

                typing_start = ws.receive_json()
                assert typing_start["type"] == "typing_start"

                typing_end = ws.receive_json()
                assert typing_end["type"] == "typing_end"

                agent_msg = ws.receive_json()
                assert agent_msg["type"] == "agent_message"
                assert "content" in agent_msg


@pytest.mark.asyncio
async def test_websocket_rejects_invalid_jwt(app):
    """R2.3 — Invalid JWT closes with code 1008."""
    with patch("api.websocket._verify_jwt", return_value=None), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        with TestClient(app) as client:
            with pytest.raises(Exception):
                with client.websocket_connect(
                    "/ws/chat",
                    headers={"Authorization": "Bearer invalid.token.here"}
                ) as ws:
                    ws.receive_json()


@pytest.mark.asyncio
async def test_websocket_ping_pong(app):
    """R2.6 — ping → pong heartbeat."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._flush_to_postgres", new_callable=AsyncMock), \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started

                ws.send_text(json.dumps({"type": "ping"}))
                pong = ws.receive_json()
                assert pong["type"] == "pong"
                assert "timestamp" in pong


@pytest.mark.asyncio
async def test_websocket_rate_limit_blocks(app):
    """R12.3 — Rate limit returns error after 10 messages/min."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=False), \
         patch("api.websocket._flush_to_postgres", new_callable=AsyncMock), \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started

                ws.send_text(json.dumps({"type": "user_message", "content": "hello"}))
                error_msg = ws.receive_json()
                assert error_msg["type"] == "error"
                assert "Too many" in error_msg["message"]
