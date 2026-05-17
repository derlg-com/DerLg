"""Task 8.5 — Integration tests for all three languages (R10)."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agent.session.state import ConversationState
from agent.prompts.builder import build_system_prompt


@pytest.fixture
def session_en():
    return ConversationState(session_id="s1", user_id="u1", preferred_language="EN")


@pytest.fixture
def session_zh():
    return ConversationState(session_id="s2", user_id="u2", preferred_language="ZH")


@pytest.fixture
def session_kh():
    return ConversationState(session_id="s3", user_id="u3", preferred_language="KH")


def test_system_prompt_includes_english_instructions(session_en):
    prompt = build_system_prompt(session_en)
    assert "English" in prompt or "english" in prompt.lower()


def test_system_prompt_includes_chinese_instructions(session_zh):
    prompt = build_system_prompt(session_zh)
    assert "Chinese" in prompt or "中文" in prompt


def test_system_prompt_includes_khmer_instructions(session_kh):
    prompt = build_system_prompt(session_kh)
    assert "Khmer" in prompt or "ខ្មែរ" in prompt


@pytest.mark.asyncio
async def test_khmer_always_uses_nvidia_client(session_kh):
    """R10.4 — km locale must always use NvidiaClient."""
    from agent.models.factory import get_model_client
    from agent.models.nvidia import NvidiaClient

    with patch("agent.models.factory.settings") as mock_settings:
        mock_settings.use_ollama = True  # even if ollama is configured
        mock_settings.nvidia_api_key = "key"
        mock_settings.nvidia_base_url = "https://fake"
        mock_settings.model_llm = "gpt-oss-120b"
        client = get_model_client(session_kh)
        assert isinstance(client, NvidiaClient)


@pytest.mark.asyncio
async def test_accept_language_header_passed_to_backend():
    """R10.3 — Accept-Language header sent with locale."""
    from agent.backend_client import BackendClient

    client = BackendClient()
    headers = client._headers("zh")
    assert headers["Accept-Language"] == "zh"

    headers_kh = client._headers("kh")
    assert headers_kh["Accept-Language"] == "kh"


@pytest.mark.asyncio
async def test_run_agent_uses_locale_in_tool_calls():
    """R10.3 — tool calls include Accept-Language from session locale."""
    from agent.session.state import ConversationState, AgentState
    from agent.backend_client import BackendClient

    session = ConversationState(session_id="s4", user_id="u4", preferred_language="ZH")

    captured_language = []

    async def mock_request(method, path, *, language="en", **kwargs):
        captured_language.append(language)
        return {"success": True, "data": []}

    with patch("agent.core.get_backend_client") as mock_get_client, \
         patch("agent.core.get_model_client") as mock_get_model:

        mock_backend = MagicMock()
        mock_backend.request = mock_request
        mock_get_client.return_value = mock_backend

        mock_model = AsyncMock()
        from agent.models.client import ModelResponse, ContentBlock
        mock_model.create_message = AsyncMock(return_value=ModelResponse(
            stop_reason="tool_use",
            content=[ContentBlock(type="tool_use", id="t1", name="search_trips",
                                  input={"destination": "Siem Reap", "duration_days": 3,
                                         "people_count": 2, "budget_usd": 500})],
        ))
        # Second call returns end_turn
        mock_model.create_message.side_effect = [
            ModelResponse(
                stop_reason="tool_use",
                content=[ContentBlock(type="tool_use", id="t1", name="search_trips",
                                      input={"destination": "Siem Reap", "duration_days": 3,
                                             "people_count": 2, "budget_usd": 500})],
            ),
            ModelResponse(
                stop_reason="end_turn",
                content=[ContentBlock(type="text", text="Here are some trips!")],
            ),
        ]
        mock_get_model.return_value = mock_model

        from agent.core import run_agent
        await run_agent(session, "Find me a trip")

    assert all(lang == "zh" for lang in captured_language)
