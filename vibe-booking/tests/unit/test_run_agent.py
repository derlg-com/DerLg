"""Unit tests for agent.core.run_agent (non-streaming)."""
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from agent.core import run_agent
from agent.session.state import ConversationState
from agent.models.client import ContentBlock, ModelResponse


@pytest.fixture
def session():
    return ConversationState(session_id="s1", user_id="u1", preferred_language="EN")


@pytest.mark.asyncio
async def test_run_agent_returns_text_on_end_turn(session):
    """When the model finishes with end_turn, run_agent returns plain text."""
    fake_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Hello traveler")],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(return_value=fake_response)

    with patch("agent.core.get_model_client", return_value=fake_client):
        result = await run_agent(session, "Hi")

    assert isinstance(result, str)
    assert "Hello" in result
    assert any(m.get("role") == "user" and m.get("content") == "Hi" for m in session.messages)


@pytest.mark.asyncio
async def test_run_agent_returns_fallback_after_max_loops(session):
    """If model keeps requesting tool calls, run_agent eventually returns fallback text."""
    tool_use_response = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="tu1", name="search_hotels", input={})],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(return_value=tool_use_response)

    benign_result = {"success": True, "data": {"hotels": []}}
    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=benign_result)):
        result = await run_agent(session, "search forever")

    assert isinstance(result, str)
    assert "trouble" in result.lower()


@pytest.mark.asyncio
async def test_run_agent_calls_tool_and_follows_up(session):
    """After tool execution, agent continues to end_turn."""
    tool_response = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="t1", name="search_trips", input={"query": "temples"})],
    )
    final_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Found 3 temple tours")],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(side_effect=[tool_response, final_response])
    tool_result = {"success": True, "data": {"trips": []}}

    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=tool_result)):
        result = await run_agent(session, "Find temple trips")

    assert isinstance(result, str)
    assert "temple" in result.lower()
