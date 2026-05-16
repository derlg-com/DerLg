import pytest
from hypothesis import given, settings as h_settings
from hypothesis import strategies as st
from agent.session.state import ConversationState, AgentState


@given(
    session_id=st.text(min_size=1, max_size=50),
    user_id=st.text(min_size=0, max_size=50),
    preferred_language=st.sampled_from(["EN", "KH", "ZH"]),
    state=st.sampled_from(list(AgentState)),
    suggested_trip_ids=st.lists(st.text(min_size=1, max_size=20), max_size=5),
    booking_id=st.text(min_size=0, max_size=50),
    payment_status=st.text(min_size=0, max_size=20),
)
@h_settings(max_examples=50)
def test_conversation_state_roundtrip(
    session_id, user_id, preferred_language, state,
    suggested_trip_ids, booking_id, payment_status
):
    """parse(format(x)) == x for ConversationState."""
    original = ConversationState(
        session_id=session_id,
        user_id=user_id,
        preferred_language=preferred_language,
        state=state,
        suggested_trip_ids=suggested_trip_ids,
        booking_id=booking_id,
        payment_status=payment_status,
    )
    restored = ConversationState.from_json(original.to_json())
    assert restored.session_id == original.session_id
    assert restored.state == original.state
    assert restored.preferred_language == original.preferred_language
    assert restored.suggested_trip_ids == original.suggested_trip_ids
    assert restored.booking_id == original.booking_id
    assert restored.payment_status == original.payment_status
