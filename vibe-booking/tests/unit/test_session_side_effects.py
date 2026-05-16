import pytest
from agent.session.state import ConversationState, AgentState
from agent.tools.executor import _apply_session_side_effects


def test_get_trip_suggestions_updates_ids():
    session = ConversationState(session_id="x")
    result = {"success": True, "data": {"trips": [{"id": "t1"}, {"id": "t2"}]}}
    _apply_session_side_effects("getTripSuggestions", result, session)
    assert session.suggested_trip_ids == ["t1", "t2"]


def test_create_booking_transitions_to_payment():
    session = ConversationState(session_id="x")
    result = {"success": True, "data": {"booking_id": "b1", "booking_ref": "DL-001", "reserved_until": "2026-05-16T12:00:00"}}
    _apply_session_side_effects("createBooking", result, session)
    assert session.state == AgentState.PAYMENT
    assert session.booking_id == "b1"


def test_cancel_booking_resets_to_discovery():
    session = ConversationState(session_id="x", state=AgentState.PAYMENT, booking_id="b1")
    result = {"success": True, "data": {}}
    _apply_session_side_effects("cancelBooking", result, session)
    assert session.state == AgentState.DISCOVERY
    assert session.booking_id == ""


def test_payment_success_transitions_to_post_booking():
    session = ConversationState(session_id="x", state=AgentState.PAYMENT)
    result = {"success": True, "data": {"status": "SUCCEEDED"}}
    _apply_session_side_effects("checkPaymentStatus", result, session)
    assert session.state == AgentState.POST_BOOKING
    assert session.payment_status == "CONFIRMED"
