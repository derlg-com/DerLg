import asyncio
import httpx
from config.settings import settings
from utils.logging import logger

_TIMEOUT = 15.0
_MAX_FAILURES = 5
_COOLDOWN = 60.0  # seconds before half-open


class BackendClient:
    """HTTP client for backend /v1/* endpoints with circuit breaker."""

    def __init__(self) -> None:
        self._failures = 0
        self._opened_at: float | None = None
        self._client = httpx.AsyncClient(
            base_url=f"{settings.backend_url}/v1/",
            timeout=_TIMEOUT,
        )

    @property
    def _is_open(self) -> bool:
        if self._opened_at is None:
            return False
        import time
        return (time.monotonic() - self._opened_at) < _COOLDOWN

    def _headers(self, language: str) -> dict:
        return {
            "X-Service-Key": settings.ai_service_key,
            "Accept-Language": language,
            "Content-Type": "application/json",
        }

    async def request(self, method: str, path: str, *, language: str = "en", **kwargs) -> dict:
        if self._is_open:
            return {"success": False, "error": {"code": "CIRCUIT_OPEN", "message": "Backend temporarily unavailable."}}
        try:
            resp = await self._client.request(method, path, headers=self._headers(language), **kwargs)
            resp.raise_for_status()
            self._failures = 0
            self._opened_at = None
            return resp.json()
        except Exception as exc:
            self._failures += 1
            if self._failures >= _MAX_FAILURES:
                import time
                self._opened_at = time.monotonic()
                logger.warning("circuit_breaker_opened", failures=self._failures)
            logger.error("backend_request_failed", path=path, error=str(exc))
            return {"success": False, "error": {"code": "BACKEND_ERROR", "message": "Tool execution failed."}}

    async def aclose(self) -> None:
        await self._client.aclose()


# Module-level singleton
_client: BackendClient | None = None


def get_backend_client() -> BackendClient:
    global _client
    if _client is None:
        _client = BackendClient()
    return _client
