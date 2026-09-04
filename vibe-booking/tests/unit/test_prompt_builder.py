import pytest
from agent.session.state import ConversationState
from agent.prompts.builder import build_system_prompt


def test_prompt_contains_core_rules():
    session = ConversationState(session_id="x")
    prompt = build_system_prompt(session)
    assert "Cambodia" in prompt
    assert "DerLg" in prompt


def test_prompt_is_action_first_and_does_not_force_budget():
    """Issue 8: the prompt must not tell the model to assume a 300 USD budget."""
    session = ConversationState(session_id="x")
    prompt = build_system_prompt(session)
    assert "300 USD" not in prompt
    assert "Do NOT invent a budget" in prompt


@pytest.mark.parametrize("lang,expected", [
    ("EN", "English"),
    ("KH", "Khmer"),
    ("ZH", "Chinese"),
])
def test_prompt_language_instruction(lang, expected):
    session = ConversationState(session_id="x", preferred_language=lang)
    prompt = build_system_prompt(session)
    assert expected in prompt


def test_prompt_is_info_first_concierge():
    """The concierge must answer general Cambodia travel questions from knowledge,
    but ALWAYS search with tools when the user wants to see or book real options."""
    session = ConversationState(session_id="x")
    prompt = build_system_prompt(session)
    # Identity
    assert "concierge" in prompt.lower()
    # Tool-calling is the default for seeing/booking options
    assert "search tool" in prompt.lower()
    # Covers broad travel topics (mentioned in knowledge-vs-tool guidance)
    for topic in ("visa", "food", "safe", "cultural", "weather"):
        assert topic in prompt.lower(), f"prompt should mention {topic}"
    # Booking is de-emphasized — only on explicit confirmation
    assert "explicit user confirmation" in prompt


def test_welcome_prompts_present_per_language():
    """Curated welcome-state chips must exist for every supported language."""
    from agent.prompts.templates import WELCOME_PROMPTS

    for lang in ("EN", "KH", "ZH"):
        assert lang in WELCOME_PROMPTS
        prompts = WELCOME_PROMPTS[lang]
        assert 2 <= len(prompts) <= 8
        assert all(isinstance(p, str) and p.strip() for p in prompts)
