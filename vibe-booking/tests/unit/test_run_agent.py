"""Unit tests for agent.core.run_agent (non-streaming) (Task 18.1.12)."""
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
    """When the model finishes with end_turn, run_agent returns formatted text."""
    fake_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Hello traveler")],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(return_value=fake_response)

    with patch("agent.core.get_model_client", return_value=fake_client):
        result = await run_agent(session, "Hi")

    assert result["type"] in ("text", "agent_message")
    if result["type"] == "text":
        assert "Hello" in result["text"]
    else:
        assert "Hello" in result.get("text", "")
    # User message and assistant reply both appended
    assert any(m.get("role") == "user" and m.get("content") == "Hi" for m in session.messages)


@pytest.mark.asyncio
async def test_run_agent_emits_requires_payment_on_create_booking_hold(session):
    """create_booking_hold success short-circuits and returns requires_payment."""
    tool_use_response = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="tu1", name="create_booking_hold", input={"trip_id": "t1"})],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(return_value=tool_use_response)
    backend_result = {
        "success": True,
        "data": {
            "booking_id": "B-100",
            "reference": "REF-100",
            "total_price_usd": 250,
            "hold_expires_at": "2026-05-25T12:00:00Z",
        },
    }
    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=backend_result)):
        result = await run_agent(session, "book trip t1")

    assert result["type"] == "requires_payment"
    assert result["booking_id"] == "B-100"
    assert result["amount_usd"] == 250
    assert "stripe" in result["methods"]
    assert "bakong" in result["methods"]
    assert session.booking_id == "B-100"
    assert session.booking_ref == "REF-100"


@pytest.mark.asyncio
async def test_run_agent_returns_fallback_after_max_loops(session):
    """If model keeps requesting tool calls, run_agent eventually returns fallback."""
    tool_use_response = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="tu1", name="search_hotels", input={})],
    )
    fake_client = MagicMock()
    fake_client.create_message = AsyncMock(return_value=tool_use_response)

    # Backend always returns success=True for search_hotels (no booking hold)
    benign_result = {"success": True, "data": {"hotels": []}}
    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=benign_result)):
        result = await run_agent(session, "search forever")

    assert result["type"] == "text"
    assert "trouble" in result["text"].lower()
