from hypothesis import given, settings as h_settings
from hypothesis import strategies as st
from agent.session.state import ConversationState


@given(
    session_id=st.text(min_size=1, max_size=50),
    user_id=st.text(min_size=0, max_size=50),
    preferred_language=st.sampled_from(["EN", "KH", "ZH"]),
)
@h_settings(max_examples=50)
def test_conversation_state_roundtrip(session_id, user_id, preferred_language):
    """parse(format(x)) == x for ConversationState."""
    original = ConversationState(
        session_id=session_id,
        user_id=user_id,
        preferred_language=preferred_language,
    )
    restored = ConversationState.from_json(original.to_json())
    assert restored.session_id == original.session_id
    assert restored.user_id == original.user_id
    assert restored.preferred_language == original.preferred_language
