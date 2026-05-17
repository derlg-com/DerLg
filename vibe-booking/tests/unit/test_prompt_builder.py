import pytest
from agent.session.state import ConversationState, AgentState
from agent.prompts.builder import build_system_prompt


@pytest.mark.parametrize("state", list(AgentState))
def test_prompt_contains_stage_instructions(state):
    session = ConversationState(session_id="x", state=state)
    prompt = build_system_prompt(session)
    assert state.value in prompt
    assert "NEVER invent" in prompt


@pytest.mark.parametrize("lang,expected", [
    ("EN", "English"),
    ("KH", "Khmer"),
    ("ZH", "Chinese"),
])
def test_prompt_language_instruction(lang, expected):
    session = ConversationState(session_id="x", preferred_language=lang)
    prompt = build_system_prompt(session)
    assert expected in prompt
