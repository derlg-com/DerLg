import time
from utils.logging import logger


class CircuitBreaker:
    """Opens after max_failures consecutive failures; half-opens after cooldown_seconds."""

    def __init__(self, max_failures: int = 5, cooldown_seconds: float = 30.0) -> None:
        self._failures = 0
        self._max = max_failures
        self._cooldown = cooldown_seconds
        self._opened_at: float | None = None

    @property
    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        if time.monotonic() - self._opened_at >= self._cooldown:
            # half-open: allow one probe
            return False
        return True

    def record_success(self) -> None:
        self._failures = 0
        self._opened_at = None

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self._max:
            self._opened_at = time.monotonic()
            logger.warning("circuit_breaker_opened", failures=self._failures)


# One shared breaker for backend API calls
backend_breaker = CircuitBreaker()
