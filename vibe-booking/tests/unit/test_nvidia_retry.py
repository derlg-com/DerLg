"""Tests for NVIDIA 429/5xx retry backoff (fixes 'AI sometimes doesn't call the tool')."""
import httpx
import pytest

from agent.models.nvidia import _retry_delay, _MAX_ATTEMPTS


def _http_error(status: int, retry_after: str | None = None) -> httpx.HTTPStatusError:
    headers = {"retry-after": retry_after} if retry_after else {}
    resp = httpx.Response(status, headers=headers, request=httpx.Request("POST", "http://x"))
    return httpx.HTTPStatusError("err", request=resp.request, response=resp)


def test_429_is_retryable_with_backoff():
    assert _retry_delay(_http_error(429), 0) is not None


def test_429_honors_retry_after_header():
    assert _retry_delay(_http_error(429, "3"), 0) == 3.0


def test_5xx_is_retryable_4xx_is_not():
    assert _retry_delay(_http_error(503), 0) is not None
    assert _retry_delay(_http_error(400), 0) is None


def test_timeout_is_retryable():
    assert _retry_delay(httpx.TimeoutException("t"), 0) is not None


def test_backoff_is_capped_and_increases():
    d0 = _retry_delay(_http_error(429), 0)
    d3 = _retry_delay(_http_error(429), 3)
    assert d3 >= d0 and d3 <= 10.0


def test_max_attempts_increased():
    assert _MAX_ATTEMPTS >= 3
