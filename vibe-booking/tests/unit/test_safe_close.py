"""Tests for the WebSocket double-close guard (Task 10, Issue 11)."""
from unittest.mock import AsyncMock, MagicMock
import pytest
from starlette.websockets import WebSocketState

from api.websocket import _safe_close


@pytest.mark.asyncio
async def test_safe_close_closes_when_connected():
    ws = MagicMock()
    ws.application_state = WebSocketState.CONNECTED
    ws.close = AsyncMock()
    await _safe_close(ws, code=1000)
    ws.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_safe_close_noop_when_disconnected():
    ws = MagicMock()
    ws.application_state = WebSocketState.DISCONNECTED
    ws.close = AsyncMock()
    await _safe_close(ws)
    ws.close.assert_not_called()


@pytest.mark.asyncio
async def test_safe_close_swallows_runtime_error():
    ws = MagicMock()
    ws.application_state = WebSocketState.CONNECTED
    ws.close = AsyncMock(side_effect=RuntimeError("already closed"))
    await _safe_close(ws)  # must not raise
