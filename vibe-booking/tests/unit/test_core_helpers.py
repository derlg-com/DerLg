"""Unit tests for agent.core helpers (Task 18.1.12 — coverage uplift)."""
import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from agent.core import _execute_tool, _execute_tool_with_status
from agent.session.state import ConversationState


@pytest.fixture
def session():
    return ConversationState(
        session_id="sess-coverage",
        user_id="user-1",
        preferred_language="EN",
    )


@pytest.mark.asyncio
async def test_execute_tool_returns_unknown_tool_error(session):
    """_execute_tool returns UNKNOWN_TOOL for tools not in TOOL_DISPATCH."""
    result = await _execute_tool("definitely_not_a_tool", {}, session)
    assert result["success"] is False
    assert result["error"]["code"] == "UNKNOWN_TOOL"


@pytest.mark.asyncio
async def test_execute_tool_dispatches_get_to_backend(session):
    """GET tool dispatch passes inp as `params` to backend.request."""
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True, "data": {"hotels": []}})
    with patch("agent.core.get_backend_client", return_value=mock_backend):
        result = await _execute_tool("search_hotels", {"province": "Siem Reap"}, session)
    assert result["success"] is True
    mock_backend.request.assert_awaited_once()
    args, kwargs = mock_backend.request.call_args
    assert args[0] == "GET"
    assert "params" in kwargs


@pytest.mark.asyncio
async def test_execute_tool_dispatches_post_with_json(session):
    """POST tool dispatch passes inp as `json` to backend.request."""
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True})
    with patch("agent.core.get_backend_client", return_value=mock_backend):
        await _execute_tool("search_trips", {"vibe": "beach"}, session)
    args, kwargs = mock_backend.request.call_args
    assert args[0] == "POST"
    assert "json" in kwargs


@pytest.mark.asyncio
async def test_execute_tool_with_status_emits_running_and_completed(session):
    """_execute_tool_with_status emits running -> completed on success."""
    queue: asyncio.Queue = asyncio.Queue()
    with patch("agent.core._execute_tool", new=AsyncMock(return_value={"success": True})):
        result = await _execute_tool_with_status(
            name="search_trips",
            inp={},
            session=session,
            tool_use_id="tu_1",
            status_queue=queue,
        )
    assert result["success"] is True
    events = []
    while not queue.empty():
        events.append(await queue.get())
    statuses = [e["status"] for e in events]
    assert "running" in statuses
    assert "completed" in statuses


@pytest.mark.asyncio
async def test_execute_tool_with_status_emits_failed_on_unsuccess(session):
    """_execute_tool_with_status emits failed when result.success is False."""
    queue: asyncio.Queue = asyncio.Queue()
    with patch("agent.core._execute_tool", new=AsyncMock(return_value={"success": False, "error": {"code": "X"}})):
        await _execute_tool_with_status(
            name="search_trips",
            inp={},
            session=session,
            tool_use_id="tu_2",
            status_queue=queue,
        )
    events = []
    while not queue.empty():
        events.append(await queue.get())
    final_status = next(e for e in events if e["status"] in ("completed", "failed"))
    assert final_status["status"] == "failed"


@pytest.mark.asyncio
async def test_execute_tool_with_status_emits_failed_on_exception(session):
    """When the inner call raises, status becomes failed and error is included."""
    queue: asyncio.Queue = asyncio.Queue()
    with patch("agent.core._execute_tool", new=AsyncMock(side_effect=RuntimeError("boom"))):
        with pytest.raises(RuntimeError):
            await _execute_tool_with_status(
                name="search_trips",
                inp={},
                session=session,
                tool_use_id="tu_3",
                status_queue=queue,
            )
    events = []
    while not queue.empty():
        events.append(await queue.get())
    failure = [e for e in events if e["status"] == "failed"]
    assert failure, "expected a failed event"
    assert failure[0].get("error") == "boom"


@pytest.mark.asyncio
async def test_execute_tool_with_status_runs_without_queue(session):
    """When status_queue is None, no events are emitted but result still returned."""
    with patch("agent.core._execute_tool", new=AsyncMock(return_value={"success": True})):
        result = await _execute_tool_with_status(
            name="search_trips",
            inp={},
            session=session,
            tool_use_id="tu_4",
            status_queue=None,
        )
    assert result["success"] is True
