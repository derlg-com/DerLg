"""Safety-critical tests for the emergency (SOS) flow in `_execute_tool`.

Invariant under test: a user who reports an emergency must ALWAYS receive
actionable Cambodia emergency phone numbers and never a hard failure — regardless
of authentication status OR backend availability. The backend SOS write (which
notifies the support team) is a best-effort enhancement and its failure must
never swallow the numbers.
"""
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from agent.core import CAMBODIA_EMERGENCY_CONTACTS, _execute_tool
from agent.session.state import ConversationState


def _guest() -> ConversationState:
    return ConversationState(session_id="g1", user_id="guest-1", is_authenticated=False)


def _authed() -> ConversationState:
    return ConversationState(session_id="a1", user_id="real-uuid", is_authenticated=True)


def _paths(mock_backend: AsyncMock) -> list[str]:
    return [c.args[1] for c in mock_backend.request.call_args_list]


def _live_contacts():
    return {"success": True, "data": {"contacts": [{"name": "Police", "number": "117"}]}}


@pytest.mark.asyncio
async def test_guest_sos_returns_contacts_and_skips_backend_write():
    """(a) A guest SOS call returns success with non-empty contacts and NEVER
    POSTs to ai-tools/sos (which would FK-fail with a 500)."""
    mock_backend = AsyncMock()

    async def fake_request(method, path, **kwargs):
        if path == "ai-tools/emergency-contacts":
            return _live_contacts()
        return {"success": True, "data": {}}

    mock_backend.request = AsyncMock(side_effect=fake_request)

    with patch("agent.core.get_backend_client", return_value=mock_backend):
        result = await _execute_tool(
            "send_sos_alert",
            {"location": "Siem Reap", "message": "Help, I had an accident"},
            _guest(),
        )

    assert result["success"] is True
    assert result["data"]["contacts"], "guest must receive emergency numbers"
    assert result["data"]["alert_logged"] is False
    assert "ai-tools/sos" not in _paths(mock_backend), "guest must NOT hit the SOS write"


@pytest.mark.asyncio
async def test_authenticated_sos_attempts_write_and_returns_contacts():
    """(b) An authenticated SOS call attempts the backend write AND returns
    contacts; the write uses the server-injected session user_id."""
    mock_backend = AsyncMock()

    async def fake_request(method, path, **kwargs):
        if path == "ai-tools/emergency-contacts":
            return _live_contacts()
        if path == "ai-tools/sos":
            return {"success": True, "data": {"sent": True}}
        return {"success": True, "data": {}}

    mock_backend.request = AsyncMock(side_effect=fake_request)

    with patch("agent.core.get_backend_client", return_value=mock_backend):
        result = await _execute_tool(
            "send_sos_alert",
            # A model-supplied user_id must be ignored in favor of the session id.
            {"user_id": "spoofed", "location": "11.5,104.9", "message": "Emergency"},
            _authed(),
        )

    assert result["success"] is True
    assert result["data"]["contacts"], "authenticated user must receive numbers"
    assert result["data"]["alert_logged"] is True
    assert "ai-tools/sos" in _paths(mock_backend), "authenticated write must be attempted"

    sos_call = next(c for c in mock_backend.request.call_args_list if c.args[1] == "ai-tools/sos")
    assert sos_call.kwargs["json"]["user_id"] == "real-uuid", "must inject session user_id, not model's"


@pytest.mark.asyncio
async def test_authenticated_sos_write_timeout_still_returns_contacts():
    """(c) When the backend SOS write raises/times out, the result STILL contains
    contacts and success: True; alert_logged reflects the failed write."""
    mock_backend = AsyncMock()

    async def fake_request(method, path, **kwargs):
        if path == "ai-tools/emergency-contacts":
            return _live_contacts()
        if path == "ai-tools/sos":
            raise httpx.TimeoutException("write timed out")
        return {"success": True, "data": {}}

    mock_backend.request = AsyncMock(side_effect=fake_request)

    with patch("agent.core.get_backend_client", return_value=mock_backend):
        result = await _execute_tool(
            "send_sos_alert",
            {"location": "Phnom Penh", "message": "Emergency"},
            _authed(),
        )

    assert result["success"] is True
    assert result["data"]["contacts"], "a failed write must NOT remove the numbers"
    assert result["data"]["alert_logged"] is False


@pytest.mark.asyncio
async def test_sos_falls_back_to_constant_when_backend_unreachable():
    """Backend totally unreachable (both the contacts lookup AND the write fail):
    the user still gets the hardcoded national numbers, success: True."""
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(side_effect=httpx.ConnectError("backend down"))

    with patch("agent.core.get_backend_client", return_value=mock_backend):
        result = await _execute_tool(
            "send_sos_alert",
            {"location": "Kampot", "message": "Help"},
            _authed(),
        )

    assert result["success"] is True
    assert result["data"]["contacts"] == CAMBODIA_EMERGENCY_CONTACTS
    assert result["data"]["alert_logged"] is False
