import asyncio
import redis.asyncio as aioredis
from config.settings import settings
from utils.logging import logger

_redis: aioredis.Redis | None = None


async def init_redis() -> None:
    global _redis
    for attempt in range(5):
        try:
            _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            await _redis.ping()
            logger.info("redis_connected")
            return
        except Exception as exc:
            delay = 2 ** attempt
            logger.warning("redis_connect_failed", attempt=attempt, retry_in=delay, error=str(exc))
            await asyncio.sleep(delay)
    raise RuntimeError("Could not connect to Redis after 5 attempts")


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized")
    return _redis


async def check_rate_limit(session_id: str, limit: int = 10, window: int = 60) -> bool:
    """Returns True if request is allowed, False if rate limit exceeded."""
    r = get_redis()
    key = f"rate:{session_id}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, window)
    return count <= limit
