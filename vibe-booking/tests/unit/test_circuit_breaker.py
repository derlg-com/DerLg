"""Task 9.6 — Unit tests for timeout and circuit breaker (R11)."""
import time
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx


@pytest.fixture
def client():
    from agent.backend_client import BackendClient
    return BackendClient()


@pytest.mark.asyncio
async def test_circuit_opens_after_5_failures(client):
    client._client.request = AsyncMock(side_effect=httpx.ConnectError("down"))

    for _ in range(5):
        result = await client.request("GET", "ai-tools/trips")
        assert result["success"] is False

    assert client._is_open


@pytest.mark.asyncio
async def test_circuit_returns_error_when_open(client):
    client._failures = 5
    client._opened_at = time.monotonic()

    result = await client.request("GET", "ai-tools/trips")
    assert result["success"] is False
    assert result["error"]["code"] == "CIRCUIT_OPEN"


@pytest.mark.asyncio
async def test_circuit_closes_after_cooldown(client):
    client._failures = 5
    client._opened_at = time.monotonic() - 61  # past 60s cooldown

    assert not client._is_open


@pytest.mark.asyncio
async def test_successful_request_resets_failures(client):
    client._failures = 3
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"success": True, "data": []}
    mock_resp.raise_for_status = MagicMock()
    client._client.request = AsyncMock(return_value=mock_resp)

    result = await client.request("GET", "ai-tools/trips")
    assert result["success"] is True
    assert client._failures == 0
    assert client._opened_at is None


@pytest.mark.asyncio
async def test_llm_timeout_triggers_retry():
    """R11.3 — 60s timeout with single retry."""
    import asyncio
    from agent.models.nvidia import NvidiaClient

    call_count = 0

    async def slow_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise httpx.TimeoutException("timeout")
        mock = MagicMock()
        mock.raise_for_status = MagicMock()
        mock.json.return_value = {
            "choices": [{"message": {"content": "ok", "tool_calls": []}, "finish_reason": "stop"}],
            "usage": {},
        }
        return mock

    with patch("agent.models.nvidia.settings") as mock_settings:
        mock_settings.nvidia_base_url = "https://fake"
        mock_settings.nvidia_api_key = "key"
        mock_settings.model_llm = "gpt-oss-120b"
        nvidia = NvidiaClient()
        nvidia._client.post = slow_post

        result = await nvidia.create_message("sys", [], [])
        assert result.stop_reason == "end_turn"
        assert call_count == 2  # retried once
