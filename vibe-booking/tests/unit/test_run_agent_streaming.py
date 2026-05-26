"""Unit tests for agent.core.run_agent_streaming."""
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from agent.core import run_agent_streaming
from agent.session.state import ConversationState
from agent.models.client import ContentBlock, ModelResponse


@pytest.fixture
def session():
    return ConversationState(session_id="s1", user_id="u1", preferred_language="EN")


async def _drain(aiter):
    out = []
    async for ev in aiter:
        out.append(ev)
    return out


@pytest.mark.asyncio
async def test_streaming_yields_final_event_with_text(session):
    """Non-streaming client path → final event contains plain text."""
    fake_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Hello again")],
    )
    fake_client = MagicMock(spec=["create_message"])
    fake_client.create_message = AsyncMock(return_value=fake_response)

    with patch("agent.core.get_model_client", return_value=fake_client):
        events = await _drain(run_agent_streaming(session, "Hi"))

    final = next((e for e in events if e["type"] == "final"), None)
    assert final is not None
    assert "text" in final
    assert "Hello" in final["text"]


@pytest.mark.asyncio
async def test_streaming_yields_chunks_when_client_supports_stream_message(session):
    """If client.stream_message is available, deltas should be yielded as chunks."""
    fake_client = MagicMock()

    async def fake_stream_iter(*args, **kwargs):
        yield {"delta": "Hello "}
        yield {"delta": "world"}
        yield {"final": ModelResponse(
            stop_reason="end_turn",
            content=[ContentBlock(type="text", text="Hello world")],
        )}

    fake_client.stream_message = fake_stream_iter

    with patch("agent.core.get_model_client", return_value=fake_client):
        events = await _drain(run_agent_streaming(session, "Hi"))

    chunks = [e for e in events if e["type"] == "agent_stream_chunk"]
    assert len(chunks) == 2
    assert chunks[0]["delta"] == "Hello "
    assert chunks[1]["delta"] == "world"

    final = next((e for e in events if e["type"] == "final"), None)
    assert final is not None
    assert "text" in final


@pytest.mark.asyncio
async def test_streaming_handles_tool_call_then_text(session):
    """Streaming path executes tools and then returns final text."""
    tool_response = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="t1", name="search_trips", input={})],
    )
    final_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Found trips")],
    )
    fake_client = MagicMock(spec=["create_message"])
    fake_client.create_message = AsyncMock(side_effect=[tool_response, final_response])
    tool_result = {"success": True, "data": {"trips": []}}

    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool", new=AsyncMock(return_value=tool_result)):
        events = await _drain(run_agent_streaming(session, "find trips"))

    final = next((e for e in events if e["type"] == "final"), None)
    assert final is not None
    assert "text" in final
