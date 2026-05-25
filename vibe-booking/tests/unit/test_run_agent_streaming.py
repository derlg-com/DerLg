"""Unit tests for agent.core.run_agent_streaming (Task 18.1.12)."""
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
async def test_streaming_yields_final_event_for_simple_text_response(session):
    """Non-streaming model path → run_agent_streaming yields a final event."""
    fake_response = ModelResponse(
        stop_reason="end_turn",
        content=[ContentBlock(type="text", text="Hello again")],
    )
    fake_client = MagicMock(spec=["create_message"])  # no stream_message
    fake_client.create_message = AsyncMock(return_value=fake_response)

    with patch("agent.core.get_model_client", return_value=fake_client):
        events = await _drain(run_agent_streaming(session, "Hi"))

    final = next((e for e in events if e["type"] == "final"), None)
    assert final is not None
    payload = final["payload"]
    assert payload["type"] in ("text", "agent_message")


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
    assert any(e["type"] == "final" for e in events)


@pytest.mark.asyncio
async def test_streaming_emits_requires_payment_when_booking_hold_succeeds(session):
    """Streaming path also short-circuits to requires_payment for create_booking_hold."""
    tool_use_response = ModelResponse(
        stop_reason="tool_use",
        content=[ContentBlock(type="tool_use", id="t1", name="create_booking_hold", input={"trip_id": "x"})],
    )
    fake_client = MagicMock(spec=["create_message"])
    fake_client.create_message = AsyncMock(return_value=tool_use_response)
    backend_result = {
        "success": True,
        "data": {
            "booking_id": "B-99",
            "reference": "REF-99",
            "amount_usd": 100,
            "expires_at": "2026-05-25T11:00:00Z",
        },
    }

    async def fake_exec_with_status(name, inp, tool_use_id, sess, queue):
        await queue.put({"type": "agent_tool_status", "tool_use_id": tool_use_id, "name": name, "status": "running"})
        await queue.put({"type": "agent_tool_status", "tool_use_id": tool_use_id, "name": name, "status": "completed"})
        return backend_result

    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool_with_status", new=fake_exec_with_status):
        events = await _drain(run_agent_streaming(session, "book please"))

    payment_event = next(e for e in events if e["type"] == "requires_payment")
    assert payment_event["booking_id"] == "B-99"
    assert payment_event["amount_usd"] == 100


@pytest.mark.asyncio
async def test_streaming_emits_tool_status_events(session):
    """Tool execution should emit running and completed status events."""
    tool_use_then_final = [
        ModelResponse(
            stop_reason="tool_use",
            content=[ContentBlock(type="tool_use", id="t1", name="search_hotels", input={})],
        ),
        ModelResponse(
            stop_reason="end_turn",
            content=[ContentBlock(type="text", text="done")],
        ),
    ]
    fake_client = MagicMock(spec=["create_message"])
    fake_client.create_message = AsyncMock(side_effect=tool_use_then_final)

    async def fake_exec_with_status(name, inp, tool_use_id, sess, queue):
        await queue.put({"type": "agent_tool_status", "tool_use_id": tool_use_id, "name": name, "status": "running"})
        await queue.put({"type": "agent_tool_status", "tool_use_id": tool_use_id, "name": name, "status": "completed"})
        return {"success": True, "data": {"hotels": []}}

    with patch("agent.core.get_model_client", return_value=fake_client), \
         patch("agent.core._execute_tool_with_status", new=fake_exec_with_status):
        events = await _drain(run_agent_streaming(session, "find hotels"))

    statuses = [e for e in events if e["type"] == "agent_tool_status"]
    assert any(e["status"] == "running" for e in statuses)
    assert any(e["status"] == "completed" for e in statuses)
