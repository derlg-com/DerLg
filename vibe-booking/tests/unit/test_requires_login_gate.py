"""Tests for the deferred-auth requires_login gate (Task 5)."""
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from agent.core import run_agent_streaming
from agent.session.state import ConversationState
from agent.models.client import ContentBlock, ModelResponse


async def _drain(aiter):
    return [ev async for ev in aiter]


def _booking_response():
    return ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="b1", name="create_booking_hold", input={})],
    )


@pytest.mark.asyncio
async def test_guest_booking_attempt_emits_requires_login_and_skips_tool():
    session = ConversationState(session_id="s1", user_id="guest-1", is_authenticated=False)
    fake_client = MagicMock(spec=["create_message"])
    fake_client.create_message = AsyncMock(return_value=_booking_response())
    exec_mock = AsyncMock()

    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=exec_mock):
        events = await _drain(run_agent_streaming(session, "book it"))

    assert any(e["type"] == "requires_login" for e in events)
    exec_mock.assert_not_called()


@pytest.mark.asyncio
async def test_authenticated_user_booking_proceeds():
    session = ConversationState(session_id="s2", user_id="real-uuid", is_authenticated=True)
    final_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Booked!")],
    )
    fake_client = MagicMock(spec=["create_message"])
    fake_client.create_message = AsyncMock(side_effect=[_booking_response(), final_response])

    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value={"success": True, "data": {"booking_id": "x"}})):
        events = await _drain(run_agent_streaming(session, "book it"))

    assert not any(e["type"] == "requires_login" for e in events)
    assert any(e["type"] == "final" for e in events)
