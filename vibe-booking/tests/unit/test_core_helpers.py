"""Unit tests for agent.core._execute_tool helper."""
from unittest.mock import AsyncMock, patch
import pytest

from agent.core import _execute_tool
from agent.session.state import ConversationState


@pytest.fixture
def session():
    return ConversationState(session_id="sess-coverage", user_id="user-1", preferred_language="EN")


@pytest.mark.asyncio
async def test_execute_tool_returns_unknown_tool_error(session):
    """_execute_tool returns error for tools not in TOOL_DISPATCH."""
    result = await _execute_tool("definitely_not_a_tool", {}, session)
    assert result["success"] is False


@pytest.mark.asyncio
async def test_execute_tool_dispatches_get_to_backend(session):
    """GET tool dispatch passes inp as `params` to backend.request."""
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True, "data": {"hotels": []}})
    with patch("agent.core.get_backend_client", return_value=mock_backend):
        result = await _execute_tool("search_hotels", {"city": "Siem Reap"}, session)
    assert result["success"] is True
    args, kwargs = mock_backend.request.call_args
    assert args[0] == "GET"
    assert "params" in kwargs


@pytest.mark.asyncio
async def test_execute_tool_dispatches_post_with_json(session):
    """POST tool dispatch passes inp as `json` to backend.request."""
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True})
    with patch("agent.core.get_backend_client", return_value=mock_backend):
        await _execute_tool("search_trips", {"query": "beach", "locale": "en"}, session)
    args, kwargs = mock_backend.request.call_args
    assert args[0] == "POST"
    assert "json" in kwargs


@pytest.mark.asyncio
async def test_execute_tool_passes_language_to_backend(session):
    """Language from session is passed to backend.request."""
    session.preferred_language = "ZH"
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True})
    with patch("agent.core.get_backend_client", return_value=mock_backend):
        await _execute_tool("search_trips", {"query": "temple", "locale": "zh"}, session)
    _, kwargs = mock_backend.request.call_args
    assert kwargs.get("language") == "zh"
