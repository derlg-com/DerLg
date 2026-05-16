import json
import pytest
from agent.session.state import ConversationState, AgentState
from agent.formatters.formatter import format_response


def _make_tool_result(data: dict) -> dict:
    return {"content": json.dumps({"success": True, "data": data})}


def test_trip_cards_message():
    session = ConversationState(session_id="x")
    result = format_response("Here are trips", [_make_tool_result({"trips": [{"id": "1"}, {"id": "2"}, {"id": "3"}]})], session)
    assert result["type"] == "trip_cards"
    assert len(result["trips"]) == 3


def test_comparison_message_for_two_trips():
    session = ConversationState(session_id="x")
    result = format_response("Compare", [_make_tool_result({"trips": [{"id": "1"}, {"id": "2"}]})], session)
    assert result["type"] == "comparison"


def test_qr_payment_message():
    session = ConversationState(session_id="x")
    result = format_response("Scan QR", [_make_tool_result({"qr_code_url": "https://qr.example.com", "payment_intent_id": "pi_123", "amount_usd": 150.0})], session)
    assert result["type"] == "qr_payment"


def test_text_message_fallback():
    session = ConversationState(session_id="x")
    result = format_response("Hello!", [], session)
    assert result["type"] == "text"
    assert result["text"] == "Hello!"


def test_booking_confirmed_message():
    session = ConversationState(session_id="x", state=AgentState.POST_BOOKING, payment_status="CONFIRMED", booking_ref="DL-001", selected_trip_name="Angkor Wat Tour")
    result = format_response("Confirmed!", [], session)
    assert result["type"] == "booking_confirmed"
    assert result["booking_ref"] == "DL-001"
