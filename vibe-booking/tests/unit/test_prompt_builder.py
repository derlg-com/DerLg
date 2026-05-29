import pytest
from agent.session.state import ConversationState
from agent.prompts.builder import build_system_prompt


def test_prompt_contains_core_rules():
    session = ConversationState(session_id="x")
    prompt = build_system_prompt(session)
    assert "Cambodia" in prompt
    assert "DerLg" in prompt


@pytest.mark.parametrize("lang,expected", [
    ("EN", "English"),
    ("KH", "Khmer"),
    ("ZH", "Chinese"),
])
def test_prompt_language_instruction(lang, expected):
    session = ConversationState(session_id="x", preferred_language=lang)
    prompt = build_system_prompt(session)
    assert expected in prompt
