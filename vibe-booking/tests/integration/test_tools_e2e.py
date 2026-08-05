"""Live end-to-end tests for every AI-agent tool against the RUNNING backend.

Unlike ``test_all_tools_contract.py`` (which mocks the backend and only checks
shapes), this module issues REAL HTTP requests to the NestJS ``/v1/ai-tools/*``
endpoints with a valid ``X-Service-Key`` and asserts the live ``{success, data}``
envelope, hitting a real database. It exercises the agent's authoritative
``TOOL_DISPATCH`` so any drift between the agent and the backend routes fails here.

It is intentionally self-skipping: if the backend is unreachable (or the service
key is the placeholder), the whole module is skipped with a clear reason instead
of failing — so it is safe to keep in the default test run and can be promoted to
a real integration job later.

How to run it for real
----------------------
Start the backend (defaults to PORT=3003 in ``backend/.env``), then::

    # from repo root, with the real values (NOT the fake tests/.env.test ones):
    export E2E_BACKEND_URL=http://localhost:3003
    export E2E_AI_SERVICE_KEY="$(grep -E '^AI_SERVICE_KEY=' backend/.env | cut -d= -f2-)"
    export RUN_LIVE_E2E=1
    cd vibe-booking && .venv/bin/python -m pytest tests/integration/test_tools_e2e.py -v

Configuration (environment variables)
-------------------------------------
* ``E2E_BACKEND_URL`` / ``BACKEND_URL`` — backend base URL (default ``http://localhost:3003``).
* ``E2E_AI_SERVICE_KEY`` / ``AI_SERVICE_KEY`` — must match the backend's
  ``AI_SERVICE_KEY``. The fake value from ``tests/.env.test`` is treated as "absent".
* ``RUN_LIVE_E2E`` — set to ``1`` to require the live run (a skip becomes a hint).
  When unset, the module still runs if a backend is reachable, else skips quietly.

Seed data is discovered at runtime from the search endpoints (no hard-coded UUIDs),
so the suite keeps working across reseeds. Any booking / payment / SOS rows it
creates are best-effort cleaned up at the end of the session.
"""
from __future__ import annotations

import os
import re
import socket
from urllib.parse import urlparse

import httpx
import pytest

# Authoritative agent → backend contract. Importing this (not a local copy) is
# what makes this an agent-side E2E test: if TOOL_DISPATCH drifts, this breaks.
from agent.tools import ALL_TOOLS, TOOL_DISPATCH

# --------------------------------------------------------------------------- #
# Configuration & feasibility gate
# --------------------------------------------------------------------------- #

# Values that mean "no real key configured" (the committed test stub uses this).
_PLACEHOLDER_KEYS = {
    "",
    "test-service-key-32-chars-minimum!!",
    "dev-service-key",
}

_DEFAULT_BACKEND_URL = "http://localhost:3003"


def _backend_url() -> str:
    return (
        os.environ.get("E2E_BACKEND_URL")
        or os.environ.get("BACKEND_URL")
        or _DEFAULT_BACKEND_URL
    ).rstrip("/")


def _service_key() -> str:
    return os.environ.get("E2E_AI_SERVICE_KEY") or os.environ.get("AI_SERVICE_KEY") or ""


def _tcp_reachable(url: str, timeout: float = 1.5) -> bool:
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


BACKEND_URL = _backend_url()
SERVICE_KEY = _service_key()
_REQUIRED = os.environ.get("RUN_LIVE_E2E") == "1"


def _skip_reason() -> str | None:
    """Return a human-readable reason to skip, or None if the live run can proceed."""
    if SERVICE_KEY in _PLACEHOLDER_KEYS:
        return (
            "No real AI_SERVICE_KEY configured for live E2E. Set E2E_AI_SERVICE_KEY "
            "to the backend's AI_SERVICE_KEY (see module docstring)."
        )
    if not _tcp_reachable(BACKEND_URL):
        return (
            f"Backend not reachable at {BACKEND_URL}. Start it "
            f"(cd backend && npm run start:dev) and set E2E_BACKEND_URL if the port differs."
        )
    return None


_SKIP = _skip_reason()
if _SKIP and _REQUIRED:
    # The caller explicitly asked for a live run, so surface the blocker loudly.
    raise pytest.UsageError(f"RUN_LIVE_E2E=1 but cannot run live E2E: {_SKIP}")

pytestmark = pytest.mark.skipif(_SKIP is not None, reason=_SKIP or "")


# --------------------------------------------------------------------------- #
# Shared live client + seed discovery (session-scoped)
# --------------------------------------------------------------------------- #

_HEADERS = {
    "X-Service-Key": SERVICE_KEY,
    "Accept-Language": "en",
    "Content-Type": "application/json",
}

# A future travel date well clear of "today" so availability holds.
_DATE = "2026-09-01"

# Identifiable marker on rows the SOS test writes, so they can be swept later.
SOS_MARKER = "E2E pytest SOS (safe to delete)"

# Cities known to exist in the seed; the harness still verifies non-emptiness
# and falls back across them so a single renamed city doesn't break discovery.
_SEED_CITIES = ("Siem Reap", "Phnom Penh", "Kampot")


def _resolve_path(path: str, inp: dict) -> tuple[str, dict]:
    """Fill ``{param}`` path templates from ``inp`` and drop those keys (mirrors
    agent.core._execute_tool)."""
    inp = dict(inp)
    for key in re.findall(r"\{(\w+)\}", path):
        path = path.replace("{" + key + "}", str(inp.pop(key, "")))
    return path, inp


class LiveBackend:
    """Thin live HTTP driver that routes through the agent's TOOL_DISPATCH."""

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def call(self, tool: str, inp: dict, *, key: str | None = None) -> httpx.Response:
        method, path = TOOL_DISPATCH[tool]
        path, inp = _resolve_path(path, inp)
        headers = dict(_HEADERS)
        if key is not None:
            headers["X-Service-Key"] = key
        kwargs = {"json": inp} if method == "POST" else {"params": inp}
        return self._client.request(method, f"/v1/{path}", headers=headers, **kwargs)

    def data(self, tool: str, inp: dict) -> object:
        r = self.call(tool, inp)
        assert r.status_code in (200, 201), f"{tool} -> HTTP {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert isinstance(body, dict) and body.get("success") is True and "data" in body, (
            f"{tool} did not return a success envelope: {body!r}"
        )
        return body["data"]


@pytest.fixture(scope="session")
def backend() -> LiveBackend:
    with httpx.Client(base_url=BACKEND_URL, timeout=20.0) as client:
        yield LiveBackend(client)


@pytest.fixture(scope="session")
def seed(backend: LiveBackend) -> dict:
    """Discover real seed identifiers from the running backend so the booking /
    detail / availability tools can target genuine rows without hard-coded UUIDs."""
    discovered: dict = {"city": None, "trip_id": None, "hotel_id": None}

    for city in _SEED_CITIES:
        trips = backend.data("search_trips", {"destination": city})
        hotels = backend.data("search_hotels", {"city": city})
        if trips and hotels:
            discovered["city"] = city
            discovered["trip_id"] = trips[0]["id"]
            discovered["hotel_id"] = hotels[0]["id"]
            break

    if not discovered["trip_id"]:
        pytest.skip(
            "Backend reachable but database has no published trips/hotels to test "
            "against. Seed the DB (backend prisma seeds) and retry."
        )
    return discovered


# Module-level holder so the booking chain can share a freshly created booking id
# and the session-teardown can clean it up.
_CREATED = {"booking_id": None}


# --------------------------------------------------------------------------- #
# (A) Auth guard — the security boundary must hold on the live server
# --------------------------------------------------------------------------- #

def test_missing_service_key_is_rejected(backend: LiveBackend):
    r = backend.call("get_weather", {"location": "Siem Reap", "date": _DATE}, key="")
    assert r.status_code == 401, f"expected 401 without key, got {r.status_code}"


def test_wrong_service_key_is_rejected(backend: LiveBackend):
    r = backend.call(
        "get_weather", {"location": "Siem Reap", "date": _DATE}, key="totally-wrong-key"
    )
    assert r.status_code == 401, f"expected 401 with wrong key, got {r.status_code}"


# --------------------------------------------------------------------------- #
# (B) Read-only / idempotent tools — one parametrized live test per tool
# --------------------------------------------------------------------------- #

def _inputs_for(tool: str, seed: dict) -> dict:
    city = seed["city"]
    return {
        "search_trips":           {"destination": city},
        "search_hotels":          {"city": city},
        "search_guides":          {"location": city, "language": "en", "date": _DATE},
        "search_transport":       {"from_location": city, "to_location": "Phnom Penh", "departure_date": _DATE},
        "check_availability":     {"item_type": "trip", "item_id": seed["trip_id"], "date": _DATE},
        "get_weather":            {"location": city, "date": _DATE},
        "get_emergency_contacts": {"location": city},
        "estimate_budget":        {"query": f"3 days {city} mid-range for 2", "locale": "en",
                                   "duration_days": 3, "people_count": 2},
        "get_user_loyalty":       {},  # user_id injected server-side; see dedicated test
        "get_trip_detail":        {"trip_id": seed["trip_id"]},
        "get_hotel_detail":       {"hotel_id": seed["hotel_id"]},
    }[tool]


# Tools that need a verified user_id and/or write rows are covered separately.
_READONLY_TOOLS = [
    "search_trips", "search_hotels", "search_guides", "search_transport",
    "check_availability", "get_weather", "get_emergency_contacts",
    "estimate_budget", "get_trip_detail", "get_hotel_detail",
]


@pytest.mark.parametrize("tool", _READONLY_TOOLS)
def test_readonly_tool_end_to_end(backend: LiveBackend, seed: dict, tool: str):
    data = backend.data(tool, _inputs_for(tool, seed))
    # Searches return a list (possibly populated); details/scalars return a dict.
    if tool in ("search_trips", "search_hotels", "search_guides", "search_transport"):
        assert isinstance(data, list)
        if data:
            assert isinstance(data[0], dict) and data[0].get("id")
    else:
        assert isinstance(data, dict) and data, f"{tool} returned empty data"


def test_search_returns_seeded_results(backend: LiveBackend, seed: dict):
    """Beyond a 200, at least trips and hotels must be non-empty for the seed city."""
    assert backend.data("search_trips", {"destination": seed["city"]}), "no trips for seed city"
    assert backend.data("search_hotels", {"city": seed["city"]}), "no hotels for seed city"


def test_get_user_loyalty_with_injected_user(backend: LiveBackend):
    """get_user_loyalty needs a real user_id (server-injected from the session in
    prod). We discover one via the DB-independent loyalty contract: pick any user
    the backend will accept. Skips if no SEED_USER_ID is provided and none can be
    inferred, since this tool has no public listing endpoint."""
    user_id = os.environ.get("SEED_USER_ID")
    if not user_id:
        pytest.skip(
            "Set SEED_USER_ID to a real users.id to exercise get_user_loyalty "
            "end-to-end (no public user-listing endpoint to discover one)."
        )
    data = backend.data("get_user_loyalty", {"user_id": user_id})
    assert "points" in data and data.get("user_id") == user_id


# --------------------------------------------------------------------------- #
# (C) Booking chain — create_booking_hold → generate_payment_qr → status
#     (real writes; cleaned up in session teardown)
# --------------------------------------------------------------------------- #

def test_create_booking_hold_end_to_end(backend: LiveBackend, seed: dict):
    user_id = os.environ.get("SEED_USER_ID")
    if not user_id:
        pytest.skip("Set SEED_USER_ID to a real users.id to exercise the booking chain.")
    data = backend.data(
        "create_booking_hold",
        {"item_type": "trip", "item_id": seed["trip_id"], "travel_date": _DATE,
         "people_count": 2, "user_id": user_id},
    )
    assert data.get("booking_id") and data.get("reference")
    assert isinstance(data.get("amount_usd"), (int, float))
    assert set(data.get("methods") or []) >= {"stripe", "bakong"}
    _CREATED["booking_id"] = data["booking_id"]


def test_generate_payment_qr_end_to_end(backend: LiveBackend):
    booking_id = _CREATED["booking_id"]
    if not booking_id:
        pytest.skip("No booking_id (create_booking_hold did not run/produce one).")
    data = backend.data("generate_payment_qr", {"booking_id": booking_id, "provider": "BAKONG"})
    assert data.get("payment_intent_id") and (data.get("qr_image_url") or data.get("qr_url"))
    assert data.get("booking_id") == booking_id


def test_check_payment_status_end_to_end(backend: LiveBackend):
    booking_id = _CREATED["booking_id"]
    if not booking_id:
        pytest.skip("No booking_id (create_booking_hold did not run/produce one).")
    data = backend.data("check_payment_status", {"booking_id": booking_id})
    assert data.get("booking_id") == booking_id
    assert "status" in data  # backend (Prisma) status; agent maps it to the FE enum


def test_send_sos_alert_end_to_end(backend: LiveBackend):
    user_id = os.environ.get("SEED_USER_ID")
    if not user_id:
        pytest.skip("Set SEED_USER_ID to a real users.id to exercise send_sos_alert.")
    data = backend.data(
        "send_sos_alert",
        {"location": "11.5564,104.9282", "message": SOS_MARKER,
         "user_id": user_id},
    )
    assert data.get("sent") is True


# --------------------------------------------------------------------------- #
# (D) Coverage assertion — every dispatched tool is exercised above
# --------------------------------------------------------------------------- #

def test_every_tool_has_live_coverage():
    """Guard: the union of tools covered by this module equals the full tool set,
    so a newly added tool can't silently escape live E2E."""
    booking_chain = {
        "create_booking_hold", "generate_payment_qr", "check_payment_status", "send_sos_alert",
    }
    covered = set(_READONLY_TOOLS) | {"get_user_loyalty"} | booking_chain
    all_tools = {t["function"]["name"] for t in ALL_TOOLS}
    assert covered == all_tools == set(TOOL_DISPATCH), (
        f"tool coverage drift: uncovered={all_tools - covered}, "
        f"unknown={covered - all_tools}"
    )


# --------------------------------------------------------------------------- #
# Cleanup of rows this suite created.
# --------------------------------------------------------------------------- #
# NOTE: the booking-chain tools write real rows (a `hold` booking, a `pending`
# payment, and an `sos` emergency_alert). The user-facing cancel route
# (POST /v1/bookings/:id/cancel) is JWT-protected, so the AI X-Service-Key
# CANNOT cancel the hold — we attempt it but must not pretend it worked. The
# rows are harmless dev/test data; a dedicated integration environment should
# either run against an ephemeral DB or sweep them out. We report exactly what
# was created (and identifiable markers) so cleanup is unambiguous.


@pytest.fixture(scope="session", autouse=True)
def _report_and_try_cleanup_created_rows():
    yield
    booking_id = _CREATED.get("booking_id")
    if not booking_id:
        return
    cancelled = False
    try:
        with httpx.Client(base_url=BACKEND_URL, timeout=10.0) as client:
            # Best-effort only; expected to 401/403 since this needs a user JWT.
            r = client.post(f"/v1/bookings/{booking_id}/cancel", headers=_HEADERS)
            cancelled = r.status_code in (200, 201)
    except Exception:
        cancelled = False
    if not cancelled:
        import sys
        print(
            "\n[test_tools_e2e] NOTE: created test rows that the AI service key "
            "cannot remove via the API (booking cancel needs a user JWT). "
            "Sweep them from the DB if running against a shared database:\n"
            f"    booking_id = {booking_id}\n"
            f"    emergency_alerts.notes LIKE '%{SOS_MARKER}%'\n"
            "  e.g. DELETE FROM payments WHERE booking_id='<id>'; "
            "DELETE FROM booking_items WHERE booking_id='<id>'; "
            "DELETE FROM bookings WHERE id='<id>';",
            file=sys.stderr,
        )
