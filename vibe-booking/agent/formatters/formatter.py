import json
from agent.session.state import ConversationState, AgentState
from agent.formatters.message_types import (
    TextMessage, TripCardsMessage, QRPaymentMessage, BookingConfirmedMessage,
    WeatherMessage, ItineraryMessage, BudgetEstimateMessage, ComparisonMessage,
    ImageGalleryMessage,
)


def format_response(
    ai_text: str,
    tool_results: list[dict],
    session: ConversationState,
) -> dict:
    merged: dict = {}
    for tr in tool_results:
        try:
            data = json.loads(tr.get("content", "{}"))
            if data.get("success") and isinstance(data.get("data"), dict):
                merged.update(data["data"])
        except (json.JSONDecodeError, TypeError):
            pass

    if "trips" in merged:
        trips = merged["trips"]
        if len(trips) == 2:
            return ComparisonMessage(text=ai_text, trips=trips).model_dump()
        return TripCardsMessage(text=ai_text, trips=trips).model_dump()

    if "qr_code_url" in merged:
        return QRPaymentMessage(
            text=ai_text,
            qr_code_url=merged["qr_code_url"],
            payment_intent_id=merged.get("payment_intent_id", ""),
            amount_usd=merged.get("amount_usd", 0.0),
            expires_at=merged.get("expires_at"),
        ).model_dump()

    if session.state == AgentState.POST_BOOKING and session.payment_status == "CONFIRMED":
        return BookingConfirmedMessage(
            text=ai_text,
            booking_ref=session.booking_ref,
            trip_name=session.selected_trip_name,
            travel_date=merged.get("travel_date", ""),
        ).model_dump()

    if "forecast" in merged:
        return WeatherMessage(text=ai_text, forecast=merged["forecast"]).model_dump()

    if "itinerary" in merged:
        return ItineraryMessage(text=ai_text, itinerary=merged["itinerary"]).model_dump()

    if "total_estimate_usd" in merged:
        return BudgetEstimateMessage(
            text=ai_text,
            total_estimate_usd=merged["total_estimate_usd"],
            breakdown=merged.get("breakdown", {}),
        ).model_dump()

    if "images" in merged:
        return ImageGalleryMessage(text=ai_text, images=merged["images"]).model_dump()

    return TextMessage(text=ai_text).model_dump()
