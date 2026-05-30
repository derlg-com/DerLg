"""Cambodia destination → coordinates lookup for trip map rendering.

The backend trip search does not return structured coordinates, so we derive a
plausible Cambodia location by matching known place names in the trip text.
Coordinates are approximate city centers — good enough for a map pin + distance.
"""

# Capital, used as the distance origin and the default fallback.
PHNOM_PENH = (11.5564, 104.9282)

_DESTINATIONS: dict[str, tuple[float, float]] = {
    "phnom penh": PHNOM_PENH,
    "siem reap": (13.3671, 103.8448),
    "angkor": (13.4125, 103.8660),
    "sihanoukville": (10.6104, 103.5296),
    "kampot": (10.6104, 104.1810),
    "kep": (10.4831, 104.3160),
    "battambang": (13.0957, 103.2022),
    "koh rong": (10.7290, 103.2300),
    "kampong cham": (12.0000, 105.4500),
    "kratie": (12.4881, 106.0190),
    "mondulkiri": (12.7879, 107.1010),
    "ratanakiri": (13.7394, 106.9873),
    "koh kong": (11.6150, 102.9840),
    "takeo": (10.9908, 104.7850),
    "preah vihear": (13.8070, 104.9810),
}


def lookup_coords(*texts: str | None) -> tuple[float, float] | None:
    """Return (lat, lng) for the first known Cambodia destination found in any
    of the given text fields, or None if nothing matches."""
    haystack = " ".join(t for t in texts if t).lower()
    if not haystack:
        return None
    for name, coords in _DESTINATIONS.items():
        if name in haystack:
            return coords
    return None
