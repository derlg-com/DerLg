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
