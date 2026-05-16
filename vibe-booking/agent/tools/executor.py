import asyncio
import json
import httpx
from agent.session.state import ConversationState, AgentState
from config.settings import settings
from utils.logging import logger

TOOL_TIMEOUT = 15.0


async def _call_backend(
    session: ConversationState,
    endpoint: str,
    payload: dict,
) -> dict:
    headers = {
        "X-Service-Key": settings.ai_service_key,
        "Accept-Language": session.preferred_language,
        "Content-Type": "application/json",
    }
    url = f"{settings.backend_url}/v1/ai-tools/{endpoint}"
    async with httpx.AsyncClient(timeout=TOOL_TIMEOUT) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def _execute_single(
    tool_name: str,
    tool_input: dict,
    session: ConversationState,
) -> dict:
    from agent.tools.handlers import trips, booking, payment, info
    dispatch = {
        "getTripSuggestions": trips.get_trip_suggestions,
        "getTripItinerary": trips.get_trip_itinerary,
        "getTripImages": trips.get_trip_images,
        "compareTrips": trips.compare_trips,
        "calculateCustomTrip": trips.calculate_custom_trip,
        "customizeTrip": trips.customize_trip,
        "validateUserDetails": booking.validate_user_details,
        "createBooking": booking.create_booking,
        "cancelBooking": booking.cancel_booking,
        "modifyBooking": booking.modify_booking,
        "applyDiscountCode": booking.apply_discount_code,
        "generatePaymentQR": payment.generate_payment_qr,
        "checkPaymentStatus": payment.check_payment_status,
        "getHotelDetails": info.get_hotel_details,
        "getWeatherForecast": info.get_weather_forecast,
        "getPlaces": info.get_places,
        "getUpcomingFestivals": info.get_upcoming_festivals,
        "estimateBudget": info.estimate_budget,
        "getCurrencyRates": info.get_currency_rates,
        "getTransportOptions": info.get_transport_options,
    }
    handler = dispatch.get(tool_name)
    if handler is None:
        return {"success": False, "error": {"code": "UNKNOWN_TOOL", "message": f"Unknown tool: {tool_name}"}}
    try:
        result = await handler(tool_input, session, _call_backend)
        _apply_session_side_effects(tool_name, result, session)
        return result
    except Exception as exc:
        logger.error("tool_execution_error", tool=tool_name, error=str(exc))
        return {"success": False, "error": {"code": "TOOL_ERROR", "message": "Tool execution failed"}}


async def execute_tools_parallel(
    tool_calls: list[dict],
    session: ConversationState,
) -> list[dict]:
    tasks = [
        _execute_single(tc["name"], tc["input"], session)
        for tc in tool_calls
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    tool_results = []
    for tc, result in zip(tool_calls, results):
        if isinstance(result, Exception):
            result = {"success": False, "error": {"code": "TOOL_ERROR", "message": str(result)}}
        tool_results.append({
            "type": "tool_result",
            "tool_use_id": tc["id"],
            "content": json.dumps(result),
        })
    return tool_results


def _apply_session_side_effects(tool_name: str, result: dict, session: ConversationState) -> None:
    if not result.get("success"):
        return
    data = result.get("data", {})
    if tool_name == "getTripSuggestions":
        trips = data.get("trips", data if isinstance(data, list) else [])
        session.suggested_trip_ids = [t["id"] for t in trips if "id" in t]
    elif tool_name == "createBooking":
        session.booking_id = data.get("booking_id", "")
        session.booking_ref = data.get("reference", "")
        from datetime import datetime
        reserved = data.get("hold_expires_at")
        if reserved:
            session.reserved_until = datetime.fromisoformat(reserved)
        session.state = AgentState.PAYMENT
    elif tool_name == "generatePaymentQR":
        session.payment_intent_id = data.get("payment_intent_id", data.get("qr_data", ""))
    elif tool_name == "checkPaymentStatus":
        if data.get("status") == "SUCCEEDED":
            session.payment_status = "CONFIRMED"
            session.state = AgentState.POST_BOOKING
    elif tool_name == "cancelBooking":
        session.booking_id = ""
        session.booking_ref = ""
        session.payment_intent_id = ""
        session.state = AgentState.DISCOVERY
