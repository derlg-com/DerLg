import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from agent.session.state import ConversationState, AgentState
from agent.tools.executor import execute_tools_parallel, _apply_session_side_effects


@pytest.fixture
def session():
    return ConversationState(session_id="int-test", user_id="u1")


@pytest.mark.asyncio
async def test_execute_tools_parallel_success(session):
    tool_calls = [
        {"id": "tc1", "name": "getTripSuggestions", "input": {"query": "temple", "locale": "en"}},
    ]
    mock_result = {"success": True, "data": {"trips": [{"id": "t1"}]}}

    with patch("agent.tools.handlers.trips.get_trip_suggestions", new=AsyncMock(return_value=mock_result)):
        with patch("agent.tools.executor._call_backend", new=AsyncMock(return_value=mock_result)):
            results = await execute_tools_parallel(tool_calls, session)

    assert len(results) == 1
    assert results[0]["type"] == "tool_result"
    assert results[0]["tool_use_id"] == "tc1"


@pytest.mark.asyncio
async def test_execute_tools_parallel_error_handled(session):
    tool_calls = [{"id": "tc1", "name": "unknownTool", "input": {}}]
    results = await execute_tools_parallel(tool_calls, session)
    assert len(results) == 1
    content = json.loads(results[0]["content"])
    assert content["success"] is False


def test_side_effects_create_booking_sets_payment_state(session):
    result = {
        "success": True,
        "data": {"booking_id": "b1", "reference": "DL-001", "hold_expires_at": "2026-05-16T12:00:00"}
    }
    _apply_session_side_effects("createBooking", result, session)
    assert session.state == AgentState.PAYMENT
    assert session.booking_id == "b1"
    assert session.booking_ref == "DL-001"


def test_side_effects_failed_result_no_change(session):
    original_state = session.state
    _apply_session_side_effects("createBooking", {"success": False}, session)
    assert session.state == original_state
