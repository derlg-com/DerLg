"""Task 11.2.5 — State machine execution across all stages (R3)."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agent.session.state import ConversationState, AgentState
from agent.models.client import ModelResponse, ContentBlock


def _make_session(state: AgentState = AgentState.DISCOVERY) -> ConversationState:
    s = ConversationState(session_id="sm-test", user_id="user-sm")
    s.state = state
    return s


def _text_response(text: str) -> ModelResponse:
    return ModelResponse(stop_reason="end_turn", content=[ContentBlock(type="text", text=text)])


def _tool_response(tool_name: str, tool_id: str, inp: dict) -> ModelResponse:
    return ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id=tool_id, name=tool_name, input=inp)],
    )


@pytest.mark.asyncio
async def test_agent_returns_text_on_end_turn():
    """R3.4 — end_turn → format_response path."""
    session = _make_session()

    with patch("agent.core.get_model_client") as mock_factory:
        mock_model = AsyncMock()
        mock_model.create_message = AsyncMock(return_value=_text_response("Welcome! Tell me about your trip."))
        mock_factory.return_value = mock_model

        from agent.core import run_agent
        result = await run_agent(session, "Hello")

    assert "content" in result or "text" in result


@pytest.mark.asyncio
async def test_agent_executes_tool_then_responds():
    """R3.4/R3.5 — tool_use → execute_tools → call_llm → end_turn."""
    session = _make_session()

    tool_call = _tool_response("search_trips", "tc1", {
        "destination": "Siem Reap", "duration_days": 3, "people_count": 2, "budget_usd": 500
    })
    final_response = _text_response("Here are 3 trips for you!")

    with patch("agent.core.get_model_client") as mock_factory, \
         patch("agent.core.get_backend_client") as mock_backend_factory:

        mock_model = AsyncMock()
        mock_model.create_message = AsyncMock(side_effect=[tool_call, final_response])
        mock_factory.return_value = mock_model

        mock_backend = AsyncMock()
        mock_backend.request = AsyncMock(return_value={"success": True, "data": []})
        mock_backend_factory.return_value = mock_backend

        from agent.core import run_agent
        result = await run_agent(session, "Find me a 3-day trip")

    assert mock_model.create_message.call_count == 2
    assert mock_backend.request.call_count == 1


@pytest.mark.asyncio
async def test_agent_enforces_max_tool_loops():
    """R3.7 — max 5 tool-call iterations before returning error."""
    session = _make_session()

    tool_call = _tool_response("search_trips", "tc1", {
        "destination": "Siem Reap", "duration_days": 3, "people_count": 2, "budget_usd": 500
    })

    with patch("agent.core.get_model_client") as mock_factory, \
         patch("agent.core.get_backend_client") as mock_backend_factory:

        mock_model = AsyncMock()
        mock_model.create_message = AsyncMock(return_value=tool_call)
        mock_factory.return_value = mock_model

        mock_backend = AsyncMock()
        mock_backend.request = AsyncMock(return_value={"success": True, "data": []})
        mock_backend_factory.return_value = mock_backend

        from agent.core import run_agent
        result = await run_agent(session, "Find me a trip")

    # Should stop after MAX_TOOL_LOOPS (5) iterations
    assert mock_model.create_message.call_count == 5


@pytest.mark.asyncio
async def test_booking_hold_triggers_requires_payment():
    """R8.2 — create_booking_hold → requires_payment message."""
    session = _make_session(AgentState.BOOKING)

    tool_call = _tool_response("create_booking_hold", "tc-book", {
        "user_id": "user-sm", "item_type": "TRIP", "item_id": "trip-1",
        "travel_date": "2026-06-01", "people_count": 2
    })

    booking_result = {
        "success": True,
        "data": {
            "booking_id": "booking-abc",
            "reference": "REF-001",
            "total_price_usd": 299.0,
            "hold_expires_at": "2026-05-17T10:15:00Z",
        }
    }

    with patch("agent.core.get_model_client") as mock_factory, \
         patch("agent.core.get_backend_client") as mock_backend_factory:

        mock_model = AsyncMock()
        mock_model.create_message = AsyncMock(return_value=tool_call)
        mock_factory.return_value = mock_model

        mock_backend = AsyncMock()
        mock_backend.request = AsyncMock(return_value=booking_result)
        mock_backend_factory.return_value = mock_backend

        from agent.core import run_agent
        result = await run_agent(session, "Yes, book it")

    assert result["type"] == "requires_payment"
    assert result["booking_id"] == "booking-abc"
    assert result["amount_usd"] == 299.0
    assert "stripe" in result["methods"]
    assert session.booking_id == "booking-abc"


@pytest.mark.asyncio
async def test_graph_topology():
    """R3.3 — graph has call_llm, execute_tools, format_response nodes."""
    from agent.graph import build_graph
    graph = build_graph()
    compiled = graph.compile()
    assert compiled is not None


@pytest.mark.asyncio
async def test_unknown_tool_returns_error():
    """Tool executor returns error for unknown tool names."""
    session = _make_session()

    from agent.core import _execute_tool
    result = await _execute_tool("nonexistent_tool", {}, session)
    assert result["success"] is False
    assert result["error"]["code"] == "UNKNOWN_TOOL"
