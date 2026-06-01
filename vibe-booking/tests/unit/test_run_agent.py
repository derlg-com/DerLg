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
    """When the model finishes with end_turn, run_agent returns (text, payload)."""
    fake_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Hello traveler")],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(return_value=fake_response)

    with patch("agent.core.get_model_client", return_value=fake_client):
        text, payload = await run_agent(session, "Hi")

    assert isinstance(text, str)
    assert "Hello" in text
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
        text, payload = await run_agent(session, "search forever")

    assert isinstance(text, str)
    assert "trouble" in text.lower()


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
        text, payload = await run_agent(session, "Find temple trips")

    assert isinstance(text, str)
    assert "temple" in text.lower()


@pytest.mark.asyncio
async def test_run_agent_returns_trip_cards_payload_from_tool_results(session):
    """When search_trips tool returns trips, content_payload is trip_cards."""
    tool_response = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="t1", name="search_trips", input={"query": "temples"})],
    )
    final_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Here are some temple tours.")],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(side_effect=[tool_response, final_response])
    tool_result = {"success": True, "data": {"trips": [{"id": "t1", "name": "Angkor Wat Tour", "priceUsd": 89}]}}

    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=tool_result)):
        text, payload = await run_agent(session, "Find temple trips")

    assert isinstance(text, str)
    assert payload is not None
    assert payload["type"] == "trip_cards"
    assert len(payload["data"]["trips"]) == 1


@pytest.mark.asyncio
async def test_run_agent_returns_none_payload_when_no_tools_called(session):
    """When no tools are called, content_payload is None."""
    fake_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Hello! How can I help you plan your Cambodia trip?")],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(return_value=fake_response)

    with patch("agent.core.get_model_client", return_value=fake_client):
        text, payload = await run_agent(session, "Hi")

    assert "Hello" in text
    assert payload is None
