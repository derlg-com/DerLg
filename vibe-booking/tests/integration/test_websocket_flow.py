"""Full WebSocket flow: connect → auth → message → response → disconnect."""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


def _make_auth_msg(session_id="sess-1", lang="EN"):
    return json.dumps({"type": "auth", "user_id": "user-test-1",
                       "session_id": session_id, "preferred_language": lang})


async def _fake_streaming(session, content):
    yield {"type": "agent_stream_chunk", "delta": "Here are some "}
    yield {"type": "agent_stream_chunk", "delta": "great trips!"}
    yield {"type": "final", "text": "Here are some great trips!", "content_payload": None}


@pytest.mark.asyncio
async def test_websocket_full_flow():
    """Connect → auth → user_message → stream chunks → agent_message → disconnect."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.run_agent_streaming", side_effect=_fake_streaming), \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=True), \
         patch("api.websocket._verify_jwt", return_value="user-test-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                init_msg = ws.receive_json()
                assert init_msg["type"] in ("conversation_started", "conversation_resumed")
                assert "session_id" in init_msg

                ws.send_text(json.dumps({"type": "user_message", "content": "Find me a trip"}))

                typing_start = ws.receive_json()
                assert typing_start["type"] == "typing_start"

                chunk1 = ws.receive_json()
                assert chunk1["type"] == "agent_stream_chunk"

                chunk2 = ws.receive_json()
                assert chunk2["type"] == "agent_stream_chunk"

                typing_end = ws.receive_json()
                assert typing_end["type"] == "typing_end"

                agent_msg = ws.receive_json()
                assert agent_msg["type"] == "agent_message"
                assert "Here are some great trips!" in agent_msg["text"]


@pytest.mark.asyncio
async def test_websocket_full_flow_with_payload():
    """agent_message includes content_payload when AI returns suggestions/chips."""
    payload = {"suggestions": ["Best time?", "Budget?"], "chips": ["Beach", "Budget"]}

    async def _fake_with_payload(session, content):
        yield {"type": "final", "text": "Great options!", "content_payload": payload}

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.run_agent_streaming", side_effect=_fake_with_payload), \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=True), \
         patch("api.websocket._verify_jwt", return_value="user-test-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started

                ws.send_text(json.dumps({"type": "user_message", "content": "Show trips"}))
                ws.receive_json()  # typing_start
                ws.receive_json()  # typing_end

                agent_msg = ws.receive_json()
                assert agent_msg["type"] == "agent_message"
                assert agent_msg["content_payload"]["suggestions"] == ["Best time?", "Budget?"]
                assert agent_msg["content_payload"]["chips"] == ["Beach", "Budget"]


@pytest.mark.asyncio
async def test_websocket_rejects_invalid_jwt():
    """Invalid JWT closes with code 1008."""
    with patch("api.websocket._verify_jwt", return_value=None), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        from main import app
        with TestClient(app) as client:
            with pytest.raises(Exception):
                with client.websocket_connect(
                    "/ws/chat",
                    headers={"Authorization": "Bearer invalid.token.here"}
                ) as ws:
                    ws.receive_json()


@pytest.mark.asyncio
async def test_websocket_ping_pong():
    """ping → pong heartbeat."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started

                ws.send_text(json.dumps({"type": "ping"}))
                pong = ws.receive_json()
                assert pong["type"] == "pong"
                assert "timestamp" in pong


@pytest.mark.asyncio
async def test_websocket_rate_limit_blocks():
    """Rate limit returns error after threshold."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=False), \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()

                ws.send_text(json.dumps({"type": "user_message", "content": "hello"}))
                error_msg = ws.receive_json()
                assert error_msg["type"] == "error"
                assert "Too many" in error_msg["message"]



@pytest.mark.asyncio
async def test_websocket_rejects_invalid_jwt():
    """Invalid JWT closes with code 1008."""
    with patch("api.websocket._verify_jwt", return_value=None), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        from main import app
        with TestClient(app) as client:
            with pytest.raises(Exception):
                with client.websocket_connect(
                    "/ws/chat",
                    headers={"Authorization": "Bearer invalid.token.here"}
                ) as ws:
                    ws.receive_json()


@pytest.mark.asyncio
async def test_websocket_ping_pong():
    """ping → pong heartbeat."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started

                ws.send_text(json.dumps({"type": "ping"}))
                pong = ws.receive_json()
                assert pong["type"] == "pong"
                assert "timestamp" in pong


@pytest.mark.asyncio
async def test_websocket_rate_limit_blocks():
    """Rate limit returns error after threshold."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=False), \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):

        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()

        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()

                ws.send_text(json.dumps({"type": "user_message", "content": "hello"}))
                error_msg = ws.receive_json()
                assert error_msg["type"] == "error"
                assert "Too many" in error_msg["message"]


# ── Task 4: page context, feedback, suggestions, welcome prompts ─────────────

@pytest.mark.asyncio
async def test_websocket_start_includes_suggested_prompts():
    """conversation_started carries curated welcome-prompt chips."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()
        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                init_msg = ws.receive_json()
                assert isinstance(init_msg.get("suggested_prompts"), list)
                assert len(init_msg["suggested_prompts"]) >= 2


@pytest.mark.asyncio
async def test_websocket_agent_message_includes_suggestions_and_payloads():
    """The final agent_message forwards suggestions + content_payloads (list)."""
    async def _fake(session, content):
        yield {
            "type": "final",
            "text": "Great options!",
            "content_payload": {"type": "trip_cards", "data": {"trips": []}},
            "content_payloads": [
                {"type": "trip_cards", "data": {"trips": []}},
                {"type": "map_view", "data": {"center": {"lat": 13.0, "lng": 103.0}, "markers": []}},
            ],
            "suggestions": ["Find hotels nearby", "Best time to visit?"],
        }

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.run_agent_streaming", side_effect=_fake), \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=True), \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()
        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started
                ws.send_text(json.dumps({"type": "user_message", "content": "Show trips"}))
                ws.receive_json()  # typing_start
                ws.receive_json()  # typing_end
                agent_msg = ws.receive_json()
                assert agent_msg["type"] == "agent_message"
                assert agent_msg["suggestions"] == ["Find hotels nearby", "Best time to visit?"]
                assert len(agent_msg["content_payloads"]) == 2
                assert agent_msg["content_payloads"][1]["type"] == "map_view"


@pytest.mark.asyncio
async def test_websocket_user_message_prepends_page_context():
    """A user_message with `context` is prefixed with [Context: viewing X]."""
    captured: dict = {}

    async def _capture(session, content):
        captured["content"] = content
        yield {"type": "final", "text": "ok", "content_payload": None}

    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket.run_agent_streaming", side_effect=_capture), \
         patch("api.websocket.check_rate_limit", new_callable=AsyncMock, return_value=True), \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()
        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started
                ws.send_text(json.dumps({
                    "type": "user_message", "content": "best food?", "context": "Home",
                }))
                ws.receive_json()  # typing_start
                ws.receive_json()  # typing_end
                ws.receive_json()  # agent_message
    assert captured["content"].startswith("[Context: viewing Home]")
    assert "best food?" in captured["content"]


@pytest.mark.asyncio
async def test_websocket_feedback_keeps_socket_alive():
    """A feedback frame is accepted (logged) and does not break the connection."""
    with patch("api.websocket.session_manager") as mock_sm, \
         patch("api.websocket._verify_jwt", return_value="user-1"), \
         patch("main.init_redis", new_callable=AsyncMock), \
         patch("main.close_redis", new_callable=AsyncMock):
        mock_sm.load = AsyncMock(return_value=None)
        mock_sm.save = AsyncMock()
        from main import app
        with TestClient(app) as client:
            with client.websocket_connect("/ws/chat") as ws:
                ws.send_text(_make_auth_msg())
                ws.receive_json()  # conversation_started
                ws.send_text(json.dumps({"type": "feedback", "message_id": "m1", "helpful": False}))
                # No response expected for feedback; socket must stay usable.
                ws.send_text(json.dumps({"type": "ping"}))
                pong = ws.receive_json()
                assert pong["type"] == "pong"
