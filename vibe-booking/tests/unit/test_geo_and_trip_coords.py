"""Tests for Cambodia coordinate lookup and trip normalization (Task 8)."""
from agent.tools.geo import lookup_coords, PHNOM_PENH
from agent.core import _norm_trip


def test_lookup_matches_known_destination():
    assert lookup_coords("Siem Reap") == (13.3671, 103.8448)


def test_lookup_matches_within_free_text():
    assert lookup_coords(None, "Angkor Wat Temple Tour", None) is not None


def test_lookup_returns_none_when_unknown():
    assert lookup_coords("Atlantis") is None


def test_norm_trip_attaches_coords_for_known_destination():
    trip = _norm_trip({"id": "t1", "title": "Siem Reap Temple Tour", "duration_days": 3})
    assert trip["lat"] == 13.3671
    assert trip["lng"] == 103.8448


def test_norm_trip_omits_coords_when_unknown():
    trip = _norm_trip({"id": "t2", "title": "Mystery Trip", "duration_days": 2})
    assert "lat" not in trip
    assert "lng" not in trip


def test_norm_trip_uses_search_destination_fallback_for_map():
    """Backend trips carry no province/location; the searched destination must
    still resolve map coords so the '📍 Show on map' button appears (map fix)."""
    trip = _norm_trip(
        {"id": "t3", "title": "Cambodia Highlights", "duration_days": 5},
        "Siem Reap",
    )
    assert trip["lat"] == 13.3671
    assert trip["lng"] == 103.8448
    assert trip["province"] == "Siem Reap"


def test_build_content_payload_threads_search_destination():
    from agent.core import _build_content_payload
    raw = [{"id": "t1", "title": "Cambodia Highlights", "duration_days": 5, "price_usd": 599}]
    payload = _build_content_payload(
        [("search_trips", {"success": True, "data": raw})], "Siem Reap"
    )
    trip = payload["data"]["trips"][0]
    assert trip["lat"] == 13.3671 and trip["lng"] == 103.8448


def test_norm_trip_detail_maps_and_resolves_coords():
    from agent.core import _norm_trip_detail
    raw = {
        "id": "t1", "title": "Cambodia Highlights", "description": "temples",
        "basePriceUsd": 599, "durationDays": 5, "coverImage": "http://img/x.jpg",
        "images": ["http://img/x.jpg"], "includedItems": ["Guide"], "excludedItems": ["Flights"],
        "meetingPoint": "Siem Reap International Airport",
        "itinerary": [{"id": "i1", "dayNumber": 1, "sortOrder": 0, "title": "Arrive", "description": "pickup"}],
    }
    d = _norm_trip_detail(raw)
    assert d["id"] == "t1" and d["name"] == "Cambodia Highlights" and d["priceUsd"] == 599
    assert d["itinerary"][0] == {"day": 1, "title": "Arrive", "description": "pickup"}
    assert d["included"] == ["Guide"] and d["images"] == ["http://img/x.jpg"]
    # Task 5: per-trip coords resolved from the meeting point (Siem Reap).
    assert d["lat"] == 13.3671 and d["lng"] == 103.8448


def test_norm_hotel_detail_uses_backend_coords():
    from agent.core import _norm_hotel_detail
    raw = {"id": "h1", "name": "Riverside", "address": "SR", "description": "nice",
           "starRating": 4, "images": ["http://img/h.jpg"], "amenities": ["Pool"],
           "latitude": 13.36, "longitude": 103.85}
    d = _norm_hotel_detail(raw)
    assert d["id"] == "h1" and d["rating"] == 4 and d["amenities"] == ["Pool"]
    assert d["imageUrl"] == "http://img/h.jpg" and d["lat"] == 13.36 and d["lng"] == 103.85


def test_build_content_payload_trip_detail():
    from agent.core import _build_content_payload
    raw = {"id": "t1", "title": "X", "basePriceUsd": 100, "durationDays": 3, "itinerary": []}
    p = _build_content_payload([("get_trip_detail", {"success": True, "data": raw})])
    assert p["type"] == "trip_detail" and p["data"]["id"] == "t1"
