import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from agent.session.state import ConversationState, AgentState
from agent.session.manager import SessionManager


@pytest.fixture
def session():
    return ConversationState(session_id="test-123", user_id="user-1")


@pytest.mark.asyncio
async def test_save_and_load_session(session):
    mock_redis = AsyncMock()
    mock_redis.get.return_value = session.to_json()

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        await manager.save(session)
        mock_redis.setex.assert_called_once()

        loaded = await manager.load("test-123")
        assert loaded is not None
        assert loaded.session_id == "test-123"


@pytest.mark.asyncio
async def test_load_missing_session():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        result = await manager.load("nonexistent")
        assert result is None


@pytest.mark.asyncio
async def test_delete_session():
    mock_redis = AsyncMock()

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        await manager.delete("test-123")
        mock_redis.delete.assert_called_once_with("session:test-123")


@pytest.mark.asyncio
async def test_booking_hold_expiry_recovery(session):
    from datetime import datetime, timezone, timedelta
    session.state = AgentState.PAYMENT
    session.booking_id = "b1"
    session.reserved_until = datetime.now(timezone.utc) - timedelta(minutes=20)

    mock_redis = AsyncMock()
    mock_redis.get.return_value = session.to_json()

    with patch("agent.session.manager.get_redis", return_value=mock_redis):
        manager = SessionManager()
        loaded = await manager.load(session.session_id)
        assert loaded.state == AgentState.BOOKING
        assert loaded.booking_id == ""
