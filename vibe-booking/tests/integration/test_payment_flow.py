import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agent.session.state import ConversationState, AgentState


@pytest.mark.asyncio
async def test_payment_handoff_flow():
    """create_booking_hold → requires_payment response."""
    session = ConversationState(session_id="s1", user_id="u1")

    booking_result = {
        "success": True,
        "data": {
            "booking_id": "b-123",
            "reference": "DL-001",
            "hold_expires_at": "2026-05-16T12:00:00",
            "total_price_usd": 245.0,
        }
    }

    mock_client = AsyncMock()
    from agent.models.client import ModelResponse, ContentBlock
    # First call: LLM returns tool_use for create_booking_hold
    mock_client.create_message.return_value = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="tc1", name="create_booking_hold", input={"user_id": "u1", "items": []})]
    )

    with patch("agent.core.get_model_client", return_value=mock_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=booking_result)):
        from agent.core import run_agent
        response = await run_agent(session, "Book the Angkor tour")

    assert response["type"] == "requires_payment"
    assert response["booking_id"] == "b-123"
    assert response["amount_usd"] == 245.0
    assert session.booking_id == "b-123"


@pytest.mark.asyncio
async def test_state_machine_discovery_to_suggestion():
    """Agent in DISCOVERY state calls search_trips and transitions."""
    session = ConversationState(session_id="s2", user_id="u2", state=AgentState.DISCOVERY)

    search_result = {"success": True, "data": [{"id": "t1", "name": "Angkor Tour"}]}

    mock_client = AsyncMock()
    from agent.models.client import ModelResponse, ContentBlock
    mock_client.create_message.side_effect = [
        ModelResponse(
            stop_reason="tool_use",
            content=[ContentBlock(type="tool_use", id="tc1", name="search_trips", input={"query": "temple", "locale": "en"})]
        ),
        ModelResponse(
            stop_reason="end_turn",
            content=[ContentBlock(type="text", text="I found 1 trip for you.")]
        ),
    ]

    with patch("agent.core.get_model_client", return_value=mock_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=search_result)):
        from agent.core import run_agent
        response = await run_agent(session, "I want a 3-day temple tour")

    assert response.get("type") in ("trip_cards", "text")
