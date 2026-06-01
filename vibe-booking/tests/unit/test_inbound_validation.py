"""Inbound WebSocket frame validation (L4)."""
from api.websocket import _valid_inbound


def test_valid_frames():
    assert _valid_inbound({"type": "ping"})
    assert _valid_inbound({"type": "user_message", "content": "hi"})
    assert _valid_inbound({"type": "user_action", "action_type": "book_trip"})
    assert _valid_inbound({"type": "payment_completed", "booking_id": "b1"})


def test_invalid_frames_rejected():
    assert not _valid_inbound("not-a-dict")
    assert not _valid_inbound({"type": "unknown_type"})
    assert not _valid_inbound({"type": "user_message"})          # missing content
    assert not _valid_inbound({"type": "user_message", "content": "  "})  # blank
    assert not _valid_inbound({"type": "user_action"})           # missing action_type
    assert not _valid_inbound({"type": "payment_completed"})     # missing booking_id
    assert not _valid_inbound({})                                # no type
