"""P6a: the WebSocket error path emits a structured, retryable error frame
instead of the old hardcoded 'Something went wrong' catch-all."""
from unittest.mock import AsyncMock, patch

import pytest

from api.websocket import _stream_agent_response
from agent.session.state import ConversationState


class FakeWebSocket:
    """Minimal stand-in for a Starlette WebSocket that records sent frames."""

    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, frame: dict) -> None:
        self.sent.append(frame)


@pytest.fixture
def session():
    return ConversationState(session_id="s1", user_id="u1", preferred_language="EN")


@pytest.mark.asyncio
async def test_agent_failure_emits_structured_error_frame(session):
    ws = FakeWebSocket()

    async def _boom(session, agent_input):
        raise RuntimeError("model call failed")
        yield  # pragma: no cover

    with patch("api.websocket.run_agent_streaming", side_effect=_boom), \
         patch("api.websocket.session_manager.save", new_callable=AsyncMock):
        await _stream_agent_response(ws, session, "hi")

    frames = {f["type"]: f for f in ws.sent}
    assert frames["typing_end"]["type"] == "typing_end"
    error = frames["error"]
    assert error["type"] == "error"
    assert error["code"] == "AGENT_INTERNAL_ERROR"
    assert isinstance(error["message"], str) and error["message"]
    assert error["retryable"] is True


@pytest.mark.asyncio
async def test_error_frame_is_retryable_true_for_transient_failures(session):
    """Timeouts/5xx from the model layer must reach the client as retryable."""
    ws = FakeWebSocket()

    async def _boom(session, agent_input):
        raise TimeoutError("llm timed out")
        yield  # pragma: no cover

    with patch("api.websocket.run_agent_streaming", side_effect=_boom), \
         patch("api.websocket.session_manager.save", new_callable=AsyncMock):
        await _stream_agent_response(ws, session, "hi")

    error = next(f for f in ws.sent if f["type"] == "error")
    assert error["retryable"] is True
    assert error["code"] == "AGENT_INTERNAL_ERROR"
