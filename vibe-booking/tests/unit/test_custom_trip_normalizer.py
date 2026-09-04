"""P6b: create_trip normalizer + content-payload branch.

Backend POST /v1/ai-tools/trips returns snake_case; the agent must convert it
into a camelCase `custom_trip_card` payload the frontend Zod schema accepts.
"""
import pytest

from agent.core import _norm_custom_trip, build_content_payloads, _friendly_cause


def test_norm_custom_trip_maps_snake_to_camel():
    raw = {
        "id": "trip-abc",
        "title": "3-day Siem Reap custom",
        "description": "Boutique hotel + VIP van",
        "duration_days": 3,
        "total_usd": 805.0,
        "items": [
            {"type": "hotel", "name": "Shinta Mani Angkor", "unit_price_usd": 130, "quantity": 3},
            {"type": "transport", "name": "Phnom Penh VIP Hiace", "unit_price_usd": 90, "quantity": 3},
        ],
        "extras": [
            {"name": "Sunrise photo session", "description": "At Angkor Wat",
             "unit_price_usd": 40, "quantity": 1},
        ],
    }

    out = _norm_custom_trip(raw)

    assert out["id"] == "trip-abc"
    assert out["title"] == "3-day Siem Reap custom"
    assert out["durationDays"] == 3
    assert out["totalUsd"] == 805.0
    assert out["items"][0] == {
        "type": "hotel", "name": "Shinta Mani Angkor", "unitPriceUsd": 130, "quantity": 3,
    }
    assert out["extras"][0] == {
        "name": "Sunrise photo session", "description": "At Angkor Wat",
        "unitPriceUsd": 40, "quantity": 1,
    }
    # No snake_case keys leak into the frontend payload.
    assert not any("_usd" in k or "duration_days" in k for k in out.keys())


def test_build_content_payloads_emits_custom_trip_card():
    raw = {
        "id": "trip-abc",
        "title": "Kampot escape",
        "duration_days": 2,
        "total_usd": 240.0,
        "items": [{"type": "guide", "name": "Channary", "unit_price_usd": 35, "quantity": 2}],
        "extras": [],
    }
    payloads = build_content_payloads([("create_trip", {"success": True, "data": raw})])
    assert len(payloads) == 1
    p = payloads[0]
    assert p["type"] == "custom_trip_card"
    assert p["data"]["durationDays"] == 2
    assert p["data"]["totalUsd"] == 240.0
    assert p["data"]["items"][0]["name"] == "Channary"
    assert "extras" not in p["data"]  # empty extras dropped by _strip_none


def test_friendly_cause_maps_timeouts_and_http_errors():
    assert "took too long" in _friendly_cause(TimeoutError("boom"))
    assert "took too long" in _friendly_cause(ValueError("request timed out"))
    assert "returned an error" in _friendly_cause(ValueError("http 500 from upstream"))
    assert "went wrong" in _friendly_cause(RuntimeError("kaboom"))
    assert "Please try again" in _friendly_cause(None)
    # Never leaks the raw exception text.
    assert "kaboom" not in _friendly_cause(RuntimeError("kaboom"))
