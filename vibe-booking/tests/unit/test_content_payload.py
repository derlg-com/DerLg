"""Unit tests for agent.core content-payload normalizers."""
from agent.core import (
    _norm_hotel_detail,
    _norm_guide,
    _norm_trip_detail,
    _build_content_payload,
    build_content_payloads,
    _derive_map_view,
)


def test_norm_hotel_detail_uses_price_from_usd():
    """Backend HotelDetail carries `priceFromUsd` (cheapest active room); the
    hotel_detail card's priceUsd must use it instead of defaulting to 0."""
    out = _norm_hotel_detail(
        {
            "id": "h1",
            "name": "Riverside Hotel",
            "address": "Street 1",
            "description": "Nice",
            "priceFromUsd": 45,
            "starRating": 4,
            "images": ["cover.jpg"],
            "amenities": ["Pool"],
            "latitude": 13.3671,
            "longitude": 103.8448,
        }
    )
    assert out["priceUsd"] == 45
    assert out["name"] == "Riverside Hotel"
    assert out["imageUrl"] == "cover.jpg"


def test_build_content_payload_hotel_detail_price():
    payload = _build_content_payload(
        [
            (
                "get_hotel_detail",
                {
                    "success": True,
                    "data": {
                        "id": "h1",
                        "name": "Riverside Hotel",
                        "priceFromUsd": 45,
                        "images": ["cover.jpg"],
                        "latitude": 13.3,
                        "longitude": 103.8,
                    },
                },
            )
        ]
    )
    assert payload is not None
    assert payload["type"] == "hotel_detail"
    assert payload["data"]["priceUsd"] == 45


def test_norm_guide_maps_snake_case_to_camel():
    out = _norm_guide(
        {
            "id": "g1",
            "name": "Sok Dara",
            "bio": "Temple expert",
            "languages": ["en", "zh"],
            "specialities": ["Angkor Wat"],
            "price_per_day_usd": 50,
            "province": "Siem Reap",
            "avatar_url": "a.jpg",
            "is_verified": True,
        }
    )
    assert out["name"] == "Sok Dara"
    assert out["pricePerDayUsd"] == 50
    assert out["languages"] == ["en", "zh"]
    assert out["avatarUrl"] == "a.jpg"
    assert out["isVerified"] is True


def test_build_content_payload_guide_cards():
    payload = _build_content_payload(
        [
            (
                "search_guides",
                {
                    "success": True,
                    "data": [
                        {
                            "id": "g1",
                            "name": "Sok Dara",
                            "languages": ["en"],
                            "price_per_day_usd": 50,
                            "province": "Siem Reap",
                            "avatar_url": "a.jpg",
                            "is_verified": True,
                        }
                    ],
                },
            )
        ]
    )
    assert payload is not None
    assert payload["type"] == "guide_cards"
    assert payload["data"]["guides"][0]["name"] == "Sok Dara"
    assert payload["data"]["guides"][0]["pricePerDayUsd"] == 50


# ── Task 2: multiple content blocks + auto-derived map ──────────────────────

def _trip_search_result():
    return (
        "search_trips",
        {
            "success": True,
            "data": [
                {"id": "t1", "title": "Angkor Sunrise", "province": "Siem Reap", "price_usd": 120, "duration_days": 1},
                {"id": "t2", "title": "Battambang Bamboo Train", "province": "Battambang", "price_usd": 80, "duration_days": 1},
            ],
        },
    )


def test_build_content_payloads_returns_list_with_trip_cards_and_map():
    """A trip search yields BOTH the trip_cards block and an auto-derived
    map_view block so the UI can render cards + a synced map together."""
    payloads = build_content_payloads([_trip_search_result()])
    types = [p["type"] for p in payloads]
    # 2 trips → trip_cards (not comparison only when ==2... here 2 trips = comparison)
    assert "comparison" in types or "trip_cards" in types
    assert "map_view" in types
    map_block = next(p for p in payloads if p["type"] == "map_view")
    assert len(map_block["data"]["markers"]) == 2
    # Center is the average of the two resolved Cambodia coordinates.
    assert 10.0 < map_block["data"]["center"]["lat"] < 14.0
    assert 103.0 < map_block["data"]["center"]["lng"] < 104.5


def test_build_content_payloads_three_trips_uses_trip_cards():
    raw = {
        "success": True,
        "data": [
            {"id": "t1", "title": "Angkor Sunrise", "province": "Siem Reap", "price_usd": 120, "duration_days": 1},
            {"id": "t2", "title": "Kampot Pepper Farm", "province": "Kampot", "price_usd": 60, "duration_days": 1},
            {"id": "t3", "title": "Kep Crab Market", "province": "Kep", "price_usd": 40, "duration_days": 1},
        ],
    }
    payloads = build_content_payloads([("search_trips", raw)])
    types = [p["type"] for p in payloads]
    assert "trip_cards" in types
    assert "map_view" in types
    map_block = next(p for p in payloads if p["type"] == "map_view")
    assert len(map_block["data"]["markers"]) == 3


def test_build_content_payloads_multiple_tools_emit_multiple_blocks():
    """Two tools in one turn (trips + weather) produce two info blocks plus the
    derived map — proving multi-section auto-render."""
    weather = (
        "get_weather",
        {"success": True, "data": {"date": "2026-01-01", "temp_high_c": 32, "temp_low_c": 24, "condition": "Sunny"}},
    )
    payloads = build_content_payloads([_trip_search_result(), weather])
    types = [p["type"] for p in payloads]
    assert "weather" in types
    assert "map_view" in types
    assert any(t in types for t in ("trip_cards", "comparison"))


def test_derive_map_view_none_without_coords():
    """Guides carry no coordinates, so no map is derived."""
    payloads = build_content_payloads(
        [("search_guides", {"success": True, "data": [{"id": "g1", "name": "Dara", "price_per_day_usd": 50}]})]
    )
    types = [p["type"] for p in payloads]
    assert "guide_cards" in types
    assert "map_view" not in types
    assert _derive_map_view([{"type": "guide_cards", "data": {"guides": []}}]) is None


def test_build_content_payload_back_compat_returns_first():
    """The legacy singular helper still returns the first meaningful payload."""
    single = _build_content_payload([_trip_search_result()])
    assert single is not None
    assert single["type"] in ("trip_cards", "comparison")


def test_derive_map_view_single_marker_zoom():
    payloads = [{"type": "hotel_detail", "data": {"id": "h1", "name": "Riverside", "lat": 13.36, "lng": 103.85}}]
    mv = _derive_map_view(payloads)
    assert mv is not None
    assert mv["data"]["zoom"] == 12
    assert mv["data"]["markers"][0]["type"] == "hotel"
    assert mv["data"]["center"]["lat"] == 13.36


def test_build_content_payloads_sets_results_header_from_query():
    payloads = build_content_payloads([_trip_search_result()], query="luxury hotels near Angkor")
    card = next(p for p in payloads if p["type"] in ("trip_cards", "comparison"))
    assert card["metadata"]["title"] == 'Results for "luxury hotels near Angkor"'


def test_build_content_payloads_no_query_leaves_metadata_empty():
    payloads = build_content_payloads([_trip_search_result()])
    card = next(p for p in payloads if p["type"] in ("trip_cards", "comparison"))
    assert card["metadata"] == {}


# ── booking_summary is completed from the tool ARGUMENTS ────────────────────
# The backend hold response carries only ids and money (booking_id, reference,
# amount_usd, hold_expires_at). Everything the summary card shows a human —
# what was held, for when, for how many — is only on the request side, so the
# builder has to read it from there or render blank fields.

_HOLD_RESULT = {
    "success": True,
    "data": {
        "booking_id": "b-1",
        "reference": "DLG-2026-45678",
        "amount_usd": 378.0,
        "hold_expires_at": "2026-02-01T10:15:00.000Z",
    },
}


def test_booking_summary_fills_item_type_date_and_people_from_tool_args():
    payloads = build_content_payloads(
        [("create_booking_hold", _HOLD_RESULT)],
        tool_args={
            "create_booking_hold": [
                {
                    "item_type": "hotel",
                    "item_id": "h-9",
                    "travel_date": "2026-02-14",
                    "people_count": 2,
                }
            ]
        },
    )

    summary = next(p for p in payloads if p["type"] == "booking_summary")
    assert summary["data"]["itemType"] == "hotel"
    assert summary["data"]["travelDate"] == "2026-02-14"
    assert summary["data"]["peopleCount"] == 2
    assert summary["data"]["totalUsd"] == 378.0
    assert summary["data"]["holdExpiresAt"] == "2026-02-01T10:15:00.000Z"


def test_booking_summary_resolves_item_name_from_cards_shown_this_turn():
    """The held id came from a card this same turn produced, so its name is
    already in hand — no extra backend round-trip needed."""
    payloads = build_content_payloads(
        [_trip_search_result(), ("create_booking_hold", _HOLD_RESULT)],
        tool_args={"create_booking_hold": [{"item_type": "trip", "item_id": "t1"}]},
    )

    summary = next(p for p in payloads if p["type"] == "booking_summary")
    assert summary["data"]["itemName"] == "Angkor Sunrise"


def test_booking_summary_falls_back_to_reference_rather_than_inventing_a_name():
    payloads = build_content_payloads(
        [("create_booking_hold", _HOLD_RESULT)],
        tool_args={"create_booking_hold": [{"item_type": "trip", "item_id": "unknown-id"}]},
    )

    summary = next(p for p in payloads if p["type"] == "booking_summary")
    # A real identifier the user can quote to support beats a fabricated title.
    assert summary["data"]["itemName"] == "DLG-2026-45678"


def test_booking_summary_survives_missing_or_junk_tool_args():
    """No args at all, and a nonsense item_type/people_count, must still yield a
    schema-valid block rather than raising or emitting an invalid itemType."""
    for args in (None, {"create_booking_hold": [{"item_type": "spaceship", "people_count": "many"}]}):
        payloads = build_content_payloads(
            [("create_booking_hold", _HOLD_RESULT)], tool_args=args
        )
        summary = next(p for p in payloads if p["type"] == "booking_summary")
        assert summary["data"]["itemType"] in ("trip", "hotel", "transport", "guide")
        assert summary["data"]["peopleCount"] >= 1
        assert summary["data"]["travelDate"] == ""


def test_two_holds_in_one_turn_each_get_their_own_arguments():
    """Args are recorded per CALL, not per tool name. Keyed by name alone, the
    second hold's date and party size would be reported against the first
    booking — a wrong travel date on a real reservation."""
    second = {
        "success": True,
        "data": {
            "booking_id": "b-2",
            "reference": "DLG-2026-99999",
            "amount_usd": 120.0,
            "hold_expires_at": "2026-02-01T10:15:00.000Z",
        },
    }

    payloads = build_content_payloads(
        [("create_booking_hold", _HOLD_RESULT), ("create_booking_hold", second)],
        tool_args={
            "create_booking_hold": [
                {"item_type": "hotel", "travel_date": "2026-02-14", "people_count": 2},
                {"item_type": "trip", "travel_date": "2026-03-01", "people_count": 4},
            ]
        },
    )

    summaries = [p for p in payloads if p["type"] == "booking_summary"]
    assert len(summaries) == 2
    assert summaries[0]["data"]["travelDate"] == "2026-02-14"
    assert summaries[0]["data"]["peopleCount"] == 2
    assert summaries[1]["data"]["travelDate"] == "2026-03-01"
    assert summaries[1]["data"]["peopleCount"] == 4


def test_failed_call_does_not_shift_argument_pairing():
    """A failed first call is skipped for output but must still consume its slot,
    or the successful second hold would inherit the first one's arguments."""
    failed = {"success": False, "error": "fully booked"}

    payloads = build_content_payloads(
        [("create_booking_hold", failed), ("create_booking_hold", _HOLD_RESULT)],
        tool_args={
            "create_booking_hold": [
                {"item_type": "hotel", "travel_date": "2026-02-14", "people_count": 2},
                {"item_type": "trip", "travel_date": "2026-03-01", "people_count": 4},
            ]
        },
    )

    summaries = [p for p in payloads if p["type"] == "booking_summary"]
    assert len(summaries) == 1
    assert summaries[0]["data"]["travelDate"] == "2026-03-01"
    assert summaries[0]["data"]["peopleCount"] == 4


# ── Task 5: trips catalog contract (new backend TripDetail shape) ───────────

def test_norm_trip_detail_reads_new_backend_shape():
    """Backend now returns name/priceUsd/coverImageUrl/galleryImageUrls/
    itineraryDays; the normalizer must map them to the trip_detail payload."""
    out = _norm_trip_detail(
        {
            "id": "t1",
            "name": "Angkor Highlights",
            "description": "Temples of Angkor",
            "priceUsd": 189,
            "durationDays": 3,
            "coverImageUrl": "https://img/cover.jpg",
            "galleryImageUrls": ["https://img/1.jpg", "https://img/2.jpg"],
            "includedItems": ["Guide", "Lunch"],
            "excludedItems": ["Flights"],
            "itineraryDays": [
                {"dayNumber": 1, "title": "Arrive", "description": "Pickup"},
            ],
            "meetingPoint": None,
        }
    )
    assert out["name"] == "Angkor Highlights"
    assert out["priceUsd"] == 189
    assert out["imageUrl"] == "https://img/cover.jpg"
    assert out["images"] == ["https://img/1.jpg", "https://img/2.jpg"]
    assert out["included"] == ["Guide", "Lunch"]
    assert out["itinerary"][0]["day"] == 1
    # Coordinates resolved from the destination name (Siem Reap / Angkor).
    assert out["lat"] is not None and out["lng"] is not None


def test_build_content_payload_trip_detail_new_shape():
    payload = _build_content_payload(
        [
            (
                "get_trip_detail",
                {
                    "success": True,
                    "data": {
                        "id": "t1",
                        "name": "Angkor Highlights",
                        "priceUsd": 189,
                        "durationDays": 3,
                        "coverImageUrl": "https://img/cover.jpg",
                        "itineraryDays": [
                            {"dayNumber": 1, "title": "Arrive", "description": "Pickup"}
                        ],
                    },
                },
            )
        ]
    )
    assert payload is not None
    assert payload["type"] == "trip_detail"
    assert payload["data"]["name"] == "Angkor Highlights"
    assert payload["data"]["priceUsd"] == 189
