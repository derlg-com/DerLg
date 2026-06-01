"""All-tools contract test: agent ↔ backend routes/DTOs ↔ frontend Zod schemas.

Encodes the authoritative contracts so any drift in TOOL_DISPATCH, tool
parameter requirements, or content-payload shape fails CI instead of silently
breaking a card in the browser (the frontend drops payloads that fail
ContentPayloadSchema.safeParse).
"""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from agent.tools import ALL_TOOLS, TOOL_DISPATCH
from agent.core import _build_content_payload
from agent.session.state import ConversationState

# --- Authoritative backend contract (ai-tools.controller.ts + ai-tools.dto.ts) ---
# tool name -> (METHOD, path, required DTO fields)  [server-injected user_id excluded]
BACKEND_ROUTES = {
    "search_trips":           ("POST", "ai-tools/search/trips",       {"destination"}),
    "search_hotels":          ("GET",  "ai-tools/hotels",             {"city"}),
    "search_guides":          ("GET",  "ai-tools/guides",             {"location", "language", "date"}),
    "search_transport":       ("GET",  "ai-tools/search/transport",   {"from_location", "to_location", "departure_date"}),
    "check_availability":     ("GET",  "ai-tools/availability",       {"item_type", "item_id", "date"}),
    "create_booking_hold":    ("POST", "ai-tools/bookings",           {"item_type", "item_id", "travel_date", "people_count"}),
    "check_payment_status":   ("GET",  "ai-tools/payments/status",    {"booking_id"}),
    "estimate_budget":        ("POST", "ai-tools/budget/estimate",    {"query", "locale"}),
    "get_weather":            ("GET",  "ai-tools/weather",            {"location", "date"}),
    "get_emergency_contacts": ("GET",  "ai-tools/emergency-contacts", {"location"}),
    "send_sos_alert":         ("POST", "ai-tools/sos",                {"location", "message"}),
    "generate_payment_qr":    ("POST", "ai-tools/payments/qr",        {"booking_id", "provider"}),
    "get_user_loyalty":       ("GET",  "ai-tools/loyalty",            set()),  # user_id server-injected
}

# user_id is injected server-side for these, so it must NOT be a model-required param.
_SERVER_INJECTED = {"create_booking_hold", "send_sos_alert", "get_user_loyalty"}


def _tool(name: str) -> dict:
    return next(t for t in ALL_TOOLS if t["function"]["name"] == name)


# ============================ (A) DISPATCH ==================================

def test_dispatch_covers_every_tool_and_vice_versa():
    tool_names = {t["function"]["name"] for t in ALL_TOOLS}
    assert tool_names == set(TOOL_DISPATCH) == set(BACKEND_ROUTES)


def test_dispatch_method_and_path_match_backend():
    for name, (method, path, _) in BACKEND_ROUTES.items():
        assert TOOL_DISPATCH[name] == (method, path), f"{name} dispatch drift"


# ============================ (B) PARAMS vs DTO =============================

def test_tool_required_params_match_backend_required_fields():
    for name, (_, _, required) in BACKEND_ROUTES.items():
        schema_required = set(_tool(name)["function"]["parameters"].get("required", []))
        assert schema_required == required, (
            f"{name}: tool required {schema_required} != backend required {required}"
        )


def test_server_injected_tools_do_not_expose_user_id_param():
    for name in _SERVER_INJECTED:
        props = _tool(name)["function"]["parameters"].get("properties", {})
        assert "user_id" not in props, f"{name} must not let the model supply user_id"


# ============== (C) CONTENT PAYLOAD vs FRONTEND ZOD ========================
# Minimal Python encoding of the frontend discriminated union invariants:
# required keys in data + enum membership. Mirrors frontend/schemas/vibe-booking.ts.
TRANSPORT_MODES = {"van", "bus", "tuk_tuk", "taxi", "shuttle", "minivan"}
PAYMENT_STATUSES = {"PENDING", "SUCCEEDED", "FAILED", "CANCELLED"}
BOOKING_ITEM_TYPES = {"trip", "hotel", "transport", "guide"}


def _validate_payload(p: dict) -> None:
    """Raise AssertionError if `p` would fail the frontend ContentPayloadSchema."""
    t, data = p["type"], p["data"]
    if t in ("trip_cards", "comparison"):
        items = data["trips"] if t == "trip_cards" else data["items"]
        for it in items:
            assert {"id", "name", "durationDays", "priceUsd"} <= it.keys()
            assert isinstance(it["durationDays"], (int, float))
            assert isinstance(it["priceUsd"], (int, float))
            for k in ("description", "province", "rating", "imageUrl", "lat", "lng"):
                assert it.get(k) is not None or k not in it  # no nulls (Zod rejects null)
    elif t == "hotel_cards":
        for h in data["hotels"]:
            assert {"id", "name", "priceUsd"} <= h.keys()
            assert isinstance(h["priceUsd"], (int, float))
    elif t == "transport_options":
        for o in data["options"]:
            assert {"id", "mode", "operator", "priceUsd", "durationMinutes"} <= o.keys()
            assert o["mode"] in TRANSPORT_MODES, f"bad mode {o['mode']}"
    elif t == "weather":
        for f in data["forecast"]:
            assert {"date", "high", "low", "condition"} <= f.keys()
    elif t == "budget_estimate":
        assert isinstance(data["totalUsd"], (int, float))
        assert all(isinstance(v, (int, float)) for v in data["breakdown"].values())
    elif t == "qr_payment":
        assert {"qrUrl", "amount", "expiry", "paymentIntentId"} <= data.keys()
        assert "usd" in data["amount"]
    elif t == "payment_status":
        assert {"paymentIntentId", "bookingId", "status", "amountUsd"} <= data.keys()
        assert data["status"] in PAYMENT_STATUSES, f"bad status {data['status']}"
    elif t == "booking_summary":
        assert {"bookingId", "itemType", "itemName", "travelDate", "peopleCount",
                "priceBreakdown", "totalUsd"} <= data.keys()
        assert data["itemType"] in BOOKING_ITEM_TYPES
        for v in data.values():
            assert v is not None
    else:
        raise AssertionError(f"unexpected payload type {t}")


# Mocked backend responses (snake_case, exactly as the NestJS service returns).
BACKEND_RESPONSES = {
    "search_trips": [
        {"id": "t1", "title": "Angkor Highlights", "duration_days": 5,
         "price_usd": 599, "category": "culture", "cover_image": "http://img/x.jpg"}
    ],
    "search_hotels": [
        {"id": "h1", "name": "Riverside Hotel", "address": "Siem Reap",
         "star_rating": 4, "price_from_usd": 75, "images": ["http://img/h.jpg"]}
    ],
    "search_transport": [
        {"id": "v1", "mode": "tuk_tuk", "operator": "Mr. Sok", "price_usd": 15,
         "capacity": 3, "departure_date": "2026-06-01", "pricing_model": "per_day"}
    ],
    "get_weather": {"location": "Siem Reap", "date": "2026-06-01", "condition": "sunny",
                    "temp_high_c": 32, "temp_low_c": 24},
    "estimate_budget": {"total_usd": 450, "currency": "USD",
                        "breakdown": [{"category": "Food & Drink", "min_usd": 100, "max_usd": 150}]},
    "generate_payment_qr": {"payment_intent_id": "pi_1", "booking_id": "b1",
                            "qr_image_url": "http://qr/x", "amount_usd": 599,
                            "expiry": "2026-06-01T00:00:00Z", "provider": "bakong"},
    "create_booking_hold": {"booking_id": "b1", "reference": "REF1", "amount_usd": 599,
                            "expires_at": "2026-06-01T00:00:00Z",
                            "hold_expires_at": "2026-06-01T00:00:00Z", "methods": ["stripe", "bakong"]},
}


@pytest.mark.parametrize("tool_name,raw", list(BACKEND_RESPONSES.items()))
def test_content_payload_validates_against_frontend_schema(tool_name, raw):
    payload = _build_content_payload([(tool_name, {"success": True, "data": raw})])
    assert payload is not None, f"{tool_name} produced no payload"
    _validate_payload(payload)


@pytest.mark.parametrize("backend_status,expected", [
    ("pending", "PENDING"), ("processing", "PENDING"), ("succeeded", "SUCCEEDED"),
    ("failed", "FAILED"), ("refunded", "CANCELLED"), ("partially_refunded", "CANCELLED"),
])
def test_payment_status_maps_all_backend_states_into_frontend_enum(backend_status, expected):
    raw = {"payment_intent_id": "pi_1", "booking_id": "b1", "status": backend_status,
           "amount_usd": 599, "method": "bakong"}
    payload = _build_content_payload([("check_payment_status", {"success": True, "data": raw})])
    assert payload["data"]["status"] == expected
    _validate_payload(payload)  # never dropped by the frontend


def test_comparison_payload_for_exactly_two_trips():
    raw = [{"id": f"t{i}", "title": f"Trip {i}", "duration_days": 3, "price_usd": 200}
           for i in (1, 2)]
    payload = _build_content_payload([("search_trips", {"success": True, "data": raw})])
    assert payload["type"] == "comparison"
    _validate_payload(payload)


# ===================== (D) EVERY TOOL DISPATCHES ============================

def test_every_tool_dispatches_to_its_backend_route():
    """_execute_tool routes each tool to the right METHOD+path with the right
    kwarg (json for POST, params for GET), and injects user_id where required."""
    from agent.core import _execute_tool

    session = ConversationState(session_id="s1", user_id="real-uuid", preferred_language="EN")
    mock_backend = AsyncMock()
    mock_backend.request = AsyncMock(return_value={"success": True, "data": {}})

    with patch("agent.core.get_backend_client", return_value=mock_backend):
        for name, (method, path, _) in BACKEND_ROUTES.items():
            mock_backend.request.reset_mock()
            asyncio.run(_execute_tool(name, {"probe": "x"}, session))
            args, kwargs = mock_backend.request.call_args
            assert args[0] == method and args[1] == path, f"{name} routed wrong"
            assert ("json" in kwargs) == (method == "POST")
            assert ("params" in kwargs) == (method == "GET")
            if name in _SERVER_INJECTED:
                sent = kwargs.get("json") or kwargs.get("params")
                assert sent.get("user_id") == "real-uuid", f"{name} missing injected user_id"
