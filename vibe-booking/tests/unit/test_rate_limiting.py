import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_rate_limit_allows_under_limit():
    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 5  # under 10

    with patch("utils.redis.get_redis", return_value=mock_redis):
        from utils.redis import check_rate_limit
        result = await check_rate_limit("session-1")
        assert result is True


@pytest.mark.asyncio
async def test_rate_limit_blocks_over_limit():
    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 11  # over 10

    with patch("utils.redis.get_redis", return_value=mock_redis):
        from utils.redis import check_rate_limit
        result = await check_rate_limit("session-1")
        assert result is False


@pytest.mark.asyncio
async def test_rate_limit_sets_expiry_on_first_message():
    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1  # first message

    with patch("utils.redis.get_redis", return_value=mock_redis):
        from utils.redis import check_rate_limit
        await check_rate_limit("session-1")
        mock_redis.expire.assert_called_once_with("rate:session-1", 60)
