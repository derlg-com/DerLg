"""Tests for server-side user_id injection and tool-call leak sanitizer (Task 3)."""
from unittest.mock import AsyncMock, patch
import pytest

from agent.core import _execute_tool, _sanitize_assistant_text
from agent.session.state import ConversationState


@pytest.fixture
def session():
    return ConversationState(session_id="s1", user_id="real-uuid", preferred_language="EN")


@pytest.mark.asyncio
async def test_create_booking_hold_overrides_model_user_id(session):
    """A model-supplied user_id is replaced by the verified session user_id."""
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True})
    with patch("agent.core.get_backend_client", return_value=mock_backend):
        await _execute_tool(
            "create_booking_hold",
            {"user_id": "12345", "item_type": "trip", "item_id": "t1"},
            session,
        )
    _, kwargs = mock_backend.request.call_args
    assert kwargs["json"]["user_id"] == "real-uuid"


@pytest.mark.asyncio
async def test_non_user_scoped_tool_not_injected(session):
    """search_trips inputs are untouched by user_id injection."""
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True})
    with patch("agent.core.get_backend_client", return_value=mock_backend):
        await _execute_tool("search_trips", {"destination": "Siem Reap"}, session)
    _, kwargs = mock_backend.request.call_args
    assert "user_id" not in kwargs["json"]


def test_sanitizer_strips_tool_call_json():
    leaked = 'Here you go {"name": "search_trips", "parameters": {"destination": "Siem Reap"}} done'
    cleaned = _sanitize_assistant_text(leaked)
    assert "search_trips" not in cleaned
    assert "{" not in cleaned


def test_sanitizer_preserves_normal_prose():
    text = "I found 3 great trips near Siem Reap for you!"
    assert _sanitize_assistant_text(text) == text
