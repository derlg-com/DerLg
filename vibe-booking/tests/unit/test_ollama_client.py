"""Unit tests for agent.models.ollama (Task 18.1.12 — coverage)."""
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from agent.models.ollama import OllamaClient


@pytest.fixture
def client():
    with patch("httpx.AsyncClient", autospec=True):
        return OllamaClient()


def test_convert_tools_maps_to_openai_format(client):
    tools = [
        {"name": "search_trips", "description": "Search trips", "input_schema": {"type": "object"}},
    ]
    result = client._convert_tools(tools)
    assert len(result) == 1
    assert result[0]["type"] == "function"
    assert result[0]["function"]["name"] == "search_trips"
    assert result[0]["function"]["parameters"] == {"type": "object"}


def test_parse_text_only_response(client):
    data = {"message": {"content": "Hello traveler", "tool_calls": []}}
    response = client._parse(data)
    assert response.stop_reason == "end_turn"
    assert len(response.content) == 1
    assert response.content[0].type == "text"
    assert response.content[0].text == "Hello traveler"


def test_parse_tool_use_response(client):
    data = {
        "message": {
            "content": "",
            "tool_calls": [
                {
                    "id": "call_1",
                    "function": {"name": "search_trips", "arguments": {"province": "Siem Reap"}},
                },
            ],
        },
    }
    response = client._parse(data)
    assert response.stop_reason == "tool_use"
    tool_blocks = [b for b in response.content if b.type == "tool_use"]
    assert len(tool_blocks) == 1
    assert tool_blocks[0].name == "search_trips"
    assert tool_blocks[0].input == {"province": "Siem Reap"}


def test_parse_tool_use_with_string_arguments(client):
    """Ollama may serialize tool args as a JSON string; parser must handle both."""
    data = {
        "message": {
            "content": None,
            "tool_calls": [
                {
                    "id": "call_2",
                    "function": {
                        "name": "search_trips",
                        "arguments": json.dumps({"q": "beach"}),
                    },
                },
            ],
        },
    }
    response = client._parse(data)
    tool_block = next(b for b in response.content if b.type == "tool_use")
    assert tool_block.input == {"q": "beach"}


@pytest.mark.asyncio
async def test_create_message_posts_to_ollama_chat_endpoint():
    """create_message posts the right shape and parses the response."""
    fake_resp = MagicMock()
    fake_resp.raise_for_status = MagicMock()
    fake_resp.json = MagicMock(return_value={"message": {"content": "ok", "tool_calls": []}})

    with patch("httpx.AsyncClient") as mock_async_client_cls:
        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=fake_resp)
        mock_async_client_cls.return_value = mock_client

        client = OllamaClient()
        result = await client.create_message(
            system="You are helpful",
            messages=[{"role": "user", "content": "Hi"}],
            tools=[],
        )

    mock_client.post.assert_awaited_once()
    args, kwargs = mock_client.post.call_args
    assert args[0] == "/api/chat"
    payload = kwargs["json"]
    assert payload["stream"] is False
    assert payload["messages"][0]["role"] == "system"
    assert result.content[0].text == "ok"


@pytest.mark.asyncio
async def test_aclose_closes_underlying_client():
    with patch("httpx.AsyncClient") as mock_async_client_cls:
        mock_client = MagicMock()
        mock_client.aclose = AsyncMock()
        mock_async_client_cls.return_value = mock_client
        client = OllamaClient()
        await client.aclose()
    mock_client.aclose.assert_awaited_once()
