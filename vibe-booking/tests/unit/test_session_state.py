import pytest
from agent.session.state import ConversationState, AgentState


def test_state_serialization_roundtrip():
    state = ConversationState(
        session_id="test-123",
        user_id="user-456",
        state=AgentState.BOOKING,
        preferred_language="EN",
        suggested_trip_ids=["trip-1", "trip-2"],
        booking_id="booking-789",
    )
    json_str = state.to_json()
    restored = ConversationState.from_json(json_str)
    assert restored.session_id == state.session_id
    assert restored.state == state.state
    assert restored.suggested_trip_ids == state.suggested_trip_ids
    assert restored.booking_id == state.booking_id


def test_invalid_language_raises():
    with pytest.raises(Exception):
        ConversationState(session_id="x", preferred_language="FR")


def test_default_state_is_discovery():
    state = ConversationState(session_id="x")
    assert state.state == AgentState.DISCOVERY
