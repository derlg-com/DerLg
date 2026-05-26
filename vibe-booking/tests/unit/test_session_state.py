import pytest
from agent.session.state import ConversationState


def test_state_serialization_roundtrip():
    state = ConversationState(
        session_id="test-123",
        user_id="user-456",
        preferred_language="EN",
    )
    state.messages = [{"role": "user", "content": "hello"}]
    json_str = state.to_json()
    restored = ConversationState.from_json(json_str)
    assert restored.session_id == state.session_id
    assert restored.messages == state.messages
    assert restored.preferred_language == "EN"


def test_invalid_language_raises():
    with pytest.raises(Exception):
        ConversationState(session_id="x", preferred_language="FR")


def test_default_language_is_en():
    state = ConversationState(session_id="x")
    assert state.preferred_language == "EN"
