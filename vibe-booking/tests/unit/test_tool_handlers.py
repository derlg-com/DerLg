import pytest
from unittest.mock import AsyncMock, patch
from agent.session.state import ConversationState


@pytest.fixture
def session():
    return ConversationState(session_id="test-session", user_id="user-1")


@pytest.fixture
def mock_call():
    return AsyncMock(return_value={"success": True, "data": {}})


@pytest.mark.asyncio
async def test_get_trip_suggestions(session, mock_call):
    from agent.tools.handlers.trips import get_trip_suggestions
    result = await get_trip_suggestions({"query": "temple tour", "locale": "en"}, session, mock_call)
    mock_call.assert_called_once_with(session, "search/trips", {"query": "temple tour", "locale": "en"})


@pytest.mark.asyncio
async def test_get_trip_itinerary(session, mock_call):
    from agent.tools.handlers.trips import get_trip_itinerary
    await get_trip_itinerary({"trip_id": "t1"}, session, mock_call)
    mock_call.assert_called_once_with(session, "search/itinerary", {"trip_id": "t1"})


@pytest.mark.asyncio
async def test_create_booking(session, mock_call):
    from agent.tools.handlers.booking import create_booking
    payload = {"user_id": "u1", "items": [{"item_type": "TRIP", "item_id": "t1", "quantity": 1}]}
    await create_booking(payload, session, mock_call)
    mock_call.assert_called_once_with(session, "bookings", payload)


@pytest.mark.asyncio
async def test_cancel_booking(session, mock_call):
    from agent.tools.handlers.booking import cancel_booking
    await cancel_booking({"booking_id": "b1"}, session, mock_call)
    mock_call.assert_called_once_with(session, "bookings/cancel", {"booking_id": "b1"})


@pytest.mark.asyncio
async def test_generate_payment_qr(session, mock_call):
    from agent.tools.handlers.payment import generate_payment_qr
    await generate_payment_qr({"booking_id": "b1", "provider": "BAKONG"}, session, mock_call)
    mock_call.assert_called_once_with(session, "payments/qr", {"booking_id": "b1", "provider": "BAKONG"})


@pytest.mark.asyncio
async def test_check_payment_status(session, mock_call):
    from agent.tools.handlers.payment import check_payment_status
    await check_payment_status({"payment_intent_id": "pi_1"}, session, mock_call)
    mock_call.assert_called_once_with(session, "payments/status", {"payment_intent_id": "pi_1"})


@pytest.mark.asyncio
async def test_get_weather_forecast(session, mock_call):
    from agent.tools.handlers.info import get_weather_forecast
    await get_weather_forecast({"destination": "Siem Reap", "date": "2026-06-01"}, session, mock_call)
    mock_call.assert_called_once_with(session, "search/weather", {"destination": "Siem Reap", "date": "2026-06-01"})


@pytest.mark.asyncio
async def test_estimate_budget(session, mock_call):
    from agent.tools.handlers.info import estimate_budget
    await estimate_budget({"query": "3 days mid-range", "locale": "en"}, session, mock_call)
    mock_call.assert_called_once_with(session, "budget/estimate", {"query": "3 days mid-range", "locale": "en"})


@pytest.mark.asyncio
async def test_get_currency_rates(session, mock_call):
    from agent.tools.handlers.info import get_currency_rates
    await get_currency_rates({"from_currency": "USD", "to_currency": "KHR"}, session, mock_call)
    mock_call.assert_called_once_with(session, "currency/rates", {"from_currency": "USD", "to_currency": "KHR"})
