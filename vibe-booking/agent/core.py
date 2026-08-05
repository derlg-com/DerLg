import asyncio
import json
import re
from typing import AsyncIterator
from agent.session.state import ConversationState
from agent.models.factory import get_model_client
from agent.tools import ALL_TOOLS, TOOL_DISPATCH
from agent.tools.geo import lookup_coords
from agent.prompts.builder import build_system_prompt
from agent.suggestions import generate_suggestions
from agent.blurbs import attach_card_blurbs
from agent.backend_client import get_backend_client
from utils.logging import logger

MAX_TOOL_LOOPS = 5
MAX_MESSAGES = 20
MAX_TOKENS = 2048

# Mutations/reads whose user_id must come from the verified session, never the model.
_USER_SCOPED_TOOLS = ("create_booking_hold", "send_sos_alert", "get_user_loyalty")

# SAFETY NET — Cambodia national emergency numbers. A user reporting an emergency
# must ALWAYS receive these actionable numbers, even if the backend is
# unreachable (circuit open, timeout, 500). Mirrors the values backend
# `getEmergencyContacts` returns so the experience is identical online/offline.
CAMBODIA_EMERGENCY_CONTACTS: list[dict] = [
    {"name": "Police", "number": "117"},
    {"name": "Ambulance", "number": "119"},
    {"name": "Fire", "number": "118"},
    {"name": "Tourist Police", "number": "012 942 484"},
]

# Matches raw tool-call JSON the model may leak as visible text instead of a
# real tool call, e.g. {"name": "search_trips", "parameters": {...}}.
_TOOL_CALL_JSON = re.compile(
    r'\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"(?:parameters|arguments)"\s*:\s*\{.*?\}\s*\}',
    re.DOTALL,
)


def _sanitize_assistant_text(text: str) -> str:
    """Strip raw tool-call JSON the model may leak into chat text (Issue 9)."""
    if not text:
        return text
    return _TOOL_CALL_JSON.sub("", text).strip()


# ---------------------------------------------------------------------------
# Per-tool normalizers: backend response → frontend ContentPayload
# Backend returns arrays directly (not wrapped in a key), or plain objects.
# Frontend Zod schemas expect camelCase fields.
# ---------------------------------------------------------------------------

def _strip_none(d: dict) -> dict:
    """Drop keys whose value is None so the frontend Zod `.optional()` fields
    (which accept `undefined` but reject `null`) validate instead of silently
    dropping the whole content payload."""
    return {k: v for k, v in d.items() if v is not None}


# Backend Prisma PaymentStatus → frontend Zod enum (PENDING|SUCCEEDED|FAILED|
# CANCELLED). Unmapped/refund states collapse to the nearest allowed value so
# the payment_status card validates instead of being silently dropped.
_PAYMENT_STATUS_MAP = {
    "pending": "PENDING",
    "processing": "PENDING",
    "succeeded": "SUCCEEDED",
    "failed": "FAILED",
    "refunded": "CANCELLED",
    "partially_refunded": "CANCELLED",
    "cancelled": "CANCELLED",
    "canceled": "CANCELLED",
}


def _map_payment_status(status: object) -> str:
    return _PAYMENT_STATUS_MAP.get(str(status or "").lower(), "PENDING")


# Human-readable verb for each tool, used to narrate the AI's plan in the
# "thinking" panel (the model emits no chain-of-thought on tool-use turns).
_TOOL_INTENT = {
    "search_trips": "Searching trips",
    "search_hotels": "Searching hotels",
    "search_guides": "Finding guides",
    "search_transport": "Finding transport",
    "check_availability": "Checking availability",
    "create_booking_hold": "Holding the booking",
    "check_payment_status": "Checking payment status",
    "estimate_budget": "Estimating the budget",
    "get_weather": "Checking the weather",
    "get_emergency_contacts": "Finding emergency contacts",
    "send_sos_alert": "Sending an SOS alert",
    "generate_payment_qr": "Generating a payment QR",
    "get_user_loyalty": "Checking loyalty points",
    "create_trip": "Composing your custom trip",
}


def _friendly_cause(exc: BaseException | None) -> str:
    """One user-safe sentence describing why the agent loop gave up (P6a).

    Never leaks exception internals to the user; maps common failure classes
    (timeouts, HTTP errors) to plain language and falls back to a generic line.
    """
    if exc is None:
        return "Please try again."
    name = type(exc).__name__.lower()
    msg = str(exc).lower()
    if "timeout" in name or "timed out" in msg or "timeout" in msg:
        return "The service took too long to respond. Please try again."
    if "http" in name or "httpstatus" in name or "http" in msg or "status" in name or "response" in msg:
        return "The service returned an error. Please try again."
    return "Something went wrong on our end. Please try again."


def _format_tool_intent(name: str, inp: dict) -> str:
    """One readable line describing a tool call, e.g.
    'Searching trips (destination: Siem Reap)'. Omits server-injected user_id."""
    verb = _TOOL_INTENT.get(name, name.replace("_", " "))
    params = ", ".join(f"{k}: {v}" for k, v in inp.items() if k != "user_id" and v not in (None, ""))
    return f"{verb} ({params})" if params else verb


def _norm_trip(t: dict, fallback_destination: str | None = None) -> dict:
    name = t.get("title") or t.get("name", "")
    province = t.get("province") or t.get("destination")
    # Backend trip search returns no province/description, so also try the
    # user's searched destination (e.g. "Siem Reap") so the map can render.
    coords = lookup_coords(province, name, t.get("description"), fallback_destination)
    return _strip_none({
        "id": t.get("id", ""),
        "name": name,
        "description": t.get("description"),
        "province": province or fallback_destination,
        "durationDays": t.get("duration_days") or t.get("durationDays", 0),
        "priceUsd": t.get("price_usd") or t.get("priceUsd") or t.get("base_price_usd", 0),
        "imageUrl": t.get("cover_image") or t.get("imageUrl"),
        "rating": t.get("rating"),
        "highlights": t.get("highlights"),
        "lat": coords[0] if coords else None,
        "lng": coords[1] if coords else None,
    })


def _norm_hotel(h: dict) -> dict:
    images = h.get("images") or []
    name = h.get("name", "")
    address = h.get("address")
    # Backend hotel search returns no coordinates; derive an approximate pin from
    # the address/name so hotel cards can render a synced map like trips do.
    coords = lookup_coords(address, name)
    return _strip_none({
        "id": h.get("id", ""),
        "name": name,
        "address": address,
        "description": h.get("description"),
        "priceUsd": h.get("price_from_usd") or h.get("priceUsd") or 0,
        "rating": h.get("star_rating") or h.get("rating"),
        "imageUrl": images[0] if images else h.get("imageUrl"),
        "lat": coords[0] if coords else None,
        "lng": coords[1] if coords else None,
    })


def _norm_transport(v: dict) -> dict:
    return _strip_none({
        "id": v.get("id", ""),
        "mode": v.get("mode") or v.get("vehicleType", "van"),
        "operator": v.get("operator") or v.get("name", ""),
        "priceUsd": v.get("price_usd") or v.get("priceUsd", 0),
        "durationMinutes": v.get("duration_minutes") or v.get("durationMinutes", 0),
        "departureTime": v.get("departure_date") or v.get("departureTime"),
    })


def _norm_guide(g: dict) -> dict:
    """Backend ai-tools guide → frontend guide_cards item (camelCase)."""
    is_verified = g.get("is_verified")
    if is_verified is None:
        is_verified = g.get("isVerified")
    return _strip_none({
        "id": g.get("id", ""),
        "name": g.get("name") or "Local Guide",
        "pricePerDayUsd": g.get("price_per_day_usd") or g.get("pricePerDayUsd") or 0,
        "languages": g.get("languages") or None,
        "specialities": g.get("specialities") or None,
        "province": g.get("province"),
        "avatarUrl": g.get("avatar_url") or g.get("avatarUrl"),
        "isVerified": is_verified,
        "bio": g.get("bio"),
    })


def _norm_trip_detail(t: dict) -> dict:
    """Backend TripDetail (camelCase) → frontend trip_detail payload.
    Coords come from a geo lookup over name / description (meeting-point
    coordinates are not modeled backend-side yet). Reads the documented keys
    (name/priceUsd/coverImageUrl/galleryImageUrls/itineraryDays) and falls back
    to the legacy keys for safety."""
    name = t.get("name") or t.get("title", "")
    # meetingPoint may be a legacy string, a {description,...} object (new
    # shape), or null; use its text (if any) plus name/description for coords.
    mp = t.get("meetingPoint")
    mp_text = (
        mp.get("description") if isinstance(mp, dict) else mp if isinstance(mp, str) else None
    )
    coords = lookup_coords(mp_text, name, t.get("description"))
    itinerary = [
        {"day": it.get("dayNumber", 0), "title": it.get("title", ""), "description": it.get("description")}
        for it in (t.get("itineraryDays") or t.get("itinerary") or [])
    ]
    return _strip_none({
        "id": t.get("id", ""),
        "name": name,
        "description": t.get("description"),
        "priceUsd": t.get("priceUsd") or t.get("basePriceUsd") or 0,
        "durationDays": t.get("durationDays", 0),
        "imageUrl": t.get("coverImageUrl") or t.get("coverImage"),
        "images": t.get("galleryImageUrls") or t.get("images") or None,
        "included": t.get("includedItems") or None,
        "excluded": t.get("excludedItems") or None,
        "itinerary": itinerary or None,
        "lat": coords[0] if coords else None,
        "lng": coords[1] if coords else None,
    })


def _norm_hotel_detail(h: dict) -> dict:
    """Backend HotelDetail → frontend hotel_detail payload (coords are real)."""
    return _strip_none({
        "id": h.get("id", ""),
        "name": h.get("name", ""),
        "address": h.get("address"),
        "description": h.get("description"),
        "priceUsd": h.get("priceFromUsd") or h.get("priceUsd") or 0,
        "rating": h.get("starRating") or h.get("rating"),
        "imageUrl": (h.get("images") or [None])[0],
        "images": h.get("images") or None,
        "amenities": h.get("amenities") or None,
        "lat": h.get("latitude"),
        "lng": h.get("longitude"),
    })


def _norm_custom_trip(t: dict) -> dict:
    """Backend POST /v1/ai-tools/trips response (snake_case) → frontend
    custom_trip_card payload (camelCase). Items/extras keep only the fields the
    frontend card renders; `description`/`start_date` pass through when present."""
    return _strip_none({
        "id": t.get("id", ""),
        "title": t.get("title", ""),
        "description": t.get("description"),
        "durationDays": t.get("duration_days") or t.get("durationDays", 0),
        "totalUsd": t.get("total_usd") or t.get("totalUsd") or 0,
        "items": [
            _strip_none({
                "type": it.get("type", ""),
                "name": it.get("name", ""),
                "unitPriceUsd": it.get("unit_price_usd") or it.get("unitPriceUsd") or 0,
                "quantity": it.get("quantity", 1),
            })
            for it in (t.get("items") or [])
        ] or None,
        "extras": [
            _strip_none({
                "name": e.get("name", ""),
                "description": e.get("description"),
                "unitPriceUsd": e.get("unit_price_usd") or e.get("unitPriceUsd") or 0,
                "quantity": e.get("quantity", 1),
            })
            for e in (t.get("extras") or [])
        ] or None,
        "startDate": t.get("start_date") or t.get("startDate"),
    })


def _as_list(data: object) -> list:
    """Backend returns arrays directly; handle both list and dict-with-key."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # Try common wrapper keys
        for key in ("trips", "hotels", "guides", "options", "vehicles", "results", "items"):
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def _extract_booking_hold(tool_results: list[tuple[str, dict]]) -> dict | None:
    """Return requires_payment data if create_booking_hold succeeded."""
    for tool_name, result in tool_results:
        if tool_name == "create_booking_hold" and result.get("success"):
            raw = result.get("data") or {}
            if isinstance(raw, dict) and raw.get("booking_id"):
                return {
                    "booking_id": raw["booking_id"],
                    "amount_usd": raw.get("amount_usd", 0),
                    "methods": raw.get("methods", ["stripe", "bakong"]),
                    "hold_expires_at": raw.get("hold_expires_at") or raw.get("expires_at"),
                }
    return None


def _collect_map_markers(payloads: list[dict]) -> list[dict]:
    """Pull mappable points (lat/lng) out of already-built card/detail payloads
    so a map_view can be derived to sit alongside the cards (TripAdvisor-style)."""
    markers: list[dict] = []
    for p in payloads:
        ptype = p.get("type")
        data = p.get("data") or {}
        if ptype == "trip_cards":
            items, mtype = data.get("trips", []), "trip"
        elif ptype == "comparison":
            items, mtype = data.get("items", []), "trip"
        elif ptype == "hotel_cards":
            items, mtype = data.get("hotels", []), "hotel"
        elif ptype == "trip_detail":
            items, mtype = [data], "trip"
        elif ptype == "hotel_detail":
            items, mtype = [data], "hotel"
        else:
            continue
        for it in items:
            lat, lng = it.get("lat"), it.get("lng")
            if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                markers.append(_strip_none({
                    "id": str(it.get("id") or it.get("name") or ""),
                    "lat": float(lat),
                    "lng": float(lng),
                    "label": it.get("name"),
                    "type": mtype,
                }))
    return markers


def _derive_map_view(payloads: list[dict]) -> dict | None:
    """Build a map_view payload centered on the mappable items in `payloads`.
    Returns None when nothing has coordinates. De-dups markers by id."""
    markers = _collect_map_markers(payloads)
    if not markers:
        return None
    seen: set[str] = set()
    unique: list[dict] = []
    for m in markers:
        mid = str(m.get("id", ""))
        if mid in seen:
            continue
        seen.add(mid)
        unique.append(m)
    avg_lat = sum(m["lat"] for m in unique) / len(unique)
    avg_lng = sum(m["lng"] for m in unique) / len(unique)
    return {
        "type": "map_view",
        "data": {
            "center": {"lat": avg_lat, "lng": avg_lng},
            "markers": unique,
            "zoom": 12 if len(unique) == 1 else 9,
        },
        "actions": [],
        "metadata": {},
    }


def build_content_payloads(
    tool_results: list[tuple[str, dict]],
    search_destination: str | None = None,
    query: str | None = None,
) -> list[dict]:
    """Map ALL tool results to a list of typed ContentPayloads for the frontend.

    Unlike the legacy single-payload builder, this returns EVERY meaningful
    block produced this turn (e.g. trip_cards + weather + budget_estimate) plus
    an auto-derived map_view when any card/detail carries coordinates — so the
    UI can auto-render a rich, multi-section result like TripAdvisor's
    "Plan with AI". Handles both array responses (backend returns list directly)
    and object responses, mapping snake_case backend fields to camelCase.
    """
    payloads: list[dict] = []
    for tool_name, result in tool_results:
        if not result.get("success"):
            continue
        raw = result.get("data")
        if raw is None:
            continue

        if tool_name == "search_trips":
            trips = [_norm_trip(t, search_destination) for t in _as_list(raw)]
            if not trips:
                continue
            payload_type = "comparison" if len(trips) == 2 else "trip_cards"
            key = "items" if payload_type == "comparison" else "trips"
            payloads.append({"type": payload_type, "data": {key: trips}, "actions": [], "metadata": {}})

        elif tool_name == "search_hotels":
            hotels = [_norm_hotel(h) for h in _as_list(raw)]
            if not hotels:
                continue
            payloads.append({"type": "hotel_cards", "data": {"hotels": hotels}, "actions": [], "metadata": {}})

        elif tool_name == "search_transport":
            options = [_norm_transport(v) for v in _as_list(raw)]
            if not options:
                continue
            payloads.append({"type": "transport_options", "data": {"options": options}, "actions": [], "metadata": {}})

        elif tool_name == "search_guides":
            guides = [_norm_guide(g) for g in _as_list(raw)]
            if not guides:
                continue
            payloads.append({"type": "guide_cards", "data": {"guides": guides}, "actions": [], "metadata": {}})

        elif tool_name == "get_weather":
            # Backend returns a single weather object, not an array
            if isinstance(raw, dict):
                forecast = [{
                    "date": raw.get("date", ""),
                    "high": raw.get("temp_high_c") or raw.get("high", 0),
                    "low": raw.get("temp_low_c") or raw.get("low", 0),
                    "condition": raw.get("condition", ""),
                    "icon": raw.get("icon"),
                }]
                payloads.append({"type": "weather", "data": {"forecast": forecast}, "actions": [], "metadata": {}})

        elif tool_name == "estimate_budget":
            if isinstance(raw, dict):
                # Backend returns total_usd (midpoint), breakdown is a list of objects
                total = raw.get("total_usd") or raw.get("total_estimate_usd") or raw.get("totalUsd", 0)
                breakdown_list = raw.get("breakdown", [])
                # Convert list → dict for frontend schema (category → amount)
                breakdown_dict: dict = {}
                if isinstance(breakdown_list, list):
                    for item in breakdown_list:
                        if isinstance(item, dict):
                            cat = item.get("category", "other").lower().replace(" & ", "_").replace(" ", "_")
                            breakdown_dict[cat] = item.get("min_usd") or item.get("amount_usd", 0)
                elif isinstance(breakdown_list, dict):
                    breakdown_dict = breakdown_list
                if total:
                    payloads.append({
                        "type": "budget_estimate",
                        "data": {"totalUsd": total, "breakdown": breakdown_dict},
                        "actions": [],
                        "metadata": {},
                    })

        elif tool_name == "generate_payment_qr":
            if isinstance(raw, dict) and (raw.get("qr_image_url") or raw.get("qr_url")):
                payloads.append({
                    "type": "qr_payment",
                    "data": {
                        "qrUrl": raw.get("qr_image_url") or raw.get("qr_url", ""),
                        "amount": {"usd": raw.get("amount_usd", 0)},
                        "expiry": raw.get("expiry", ""),
                        "paymentIntentId": raw.get("payment_intent_id", ""),
                        "bookingId": raw.get("booking_id", ""),
                    },
                    "actions": [],
                    "metadata": {},
                })

        elif tool_name == "check_payment_status":
            if isinstance(raw, dict) and raw.get("status"):
                payloads.append({
                    "type": "payment_status",
                    "data": {
                        "paymentIntentId": raw.get("payment_intent_id") or raw.get("paymentIntentId", ""),
                        "bookingId": raw.get("booking_id") or raw.get("bookingId", ""),
                        "status": _map_payment_status(raw.get("status")),
                        "amountUsd": raw.get("amount_usd") or raw.get("amountUsd") or 0,
                        "method": raw.get("method"),
                    },
                    "actions": [],
                    "metadata": {},
                })

        elif tool_name == "create_booking_hold":
            if isinstance(raw, dict) and raw.get("booking_id"):
                payloads.append({
                    "type": "booking_summary",
                    "data": {
                        "bookingId": raw["booking_id"],
                        "itemType": "trip",
                        "itemName": "",
                        "travelDate": "",
                        "peopleCount": 1,
                        "priceBreakdown": [{"label": "Total", "amountUsd": raw.get("amount_usd", 0)}],
                        "totalUsd": raw.get("amount_usd", 0),
                        "holdExpiresAt": raw.get("hold_expires_at") or raw.get("expires_at"),
                    },
                    "actions": [],
                    "metadata": {},
                })

        elif tool_name == "get_trip_detail":
            if isinstance(raw, dict) and raw.get("id"):
                payloads.append({"type": "trip_detail", "data": _norm_trip_detail(raw), "actions": [], "metadata": {}})

        elif tool_name == "get_hotel_detail":
            if isinstance(raw, dict) and raw.get("id"):
                payloads.append({"type": "hotel_detail", "data": _norm_hotel_detail(raw), "actions": [], "metadata": {}})

        elif tool_name == "create_trip":
            if isinstance(raw, dict) and raw.get("id"):
                payloads.append({"type": "custom_trip_card", "data": _norm_custom_trip(raw), "actions": [], "metadata": {}})

    # Results header ("Results for '<query>'") on the card-list blocks.
    if query:
        title = f'Results for "{query}"'
        for p in payloads:
            if p.get("type") in ("trip_cards", "hotel_cards", "comparison"):
                p["metadata"] = {**(p.get("metadata") or {}), "title": title}

    # Auto-derive an overview map from any card/detail coords so the UI can show
    # cards + a synced map together. The frontend drops a redundant standalone
    # map_view when a card-list block is present (the cards own their inline map).
    map_view = _derive_map_view(payloads)
    if map_view is not None:
        payloads.append(map_view)

    return payloads


def _build_content_payload(
    tool_results: list[tuple[str, dict]], search_destination: str | None = None
) -> dict | None:
    """Back-compat: the FIRST meaningful payload (legacy single-payload field).
    New code should use build_content_payloads(...) for the full list."""
    payloads = build_content_payloads(tool_results, search_destination)
    return payloads[0] if payloads else None


async def _resolve_emergency_contacts(
    location: str, session: ConversationState
) -> tuple[list[dict], bool]:
    """Best-effort emergency-contacts resolution with a guaranteed fallback.

    Tries a live `get_emergency_contacts` lookup for the given location, but ANY
    failure (circuit open, timeout, empty result, unexpected error) falls back to
    the hardcoded ``CAMBODIA_EMERGENCY_CONTACTS`` so a user in distress always
    receives actionable numbers. Returns ``(contacts, is_live)``.
    """
    if location:
        try:
            backend = get_backend_client()
            result = await backend.request(
                "GET",
                "ai-tools/emergency-contacts",
                language=session.preferred_language.lower(),
                params={"location": location},
            )
            if result.get("success"):
                data = result.get("data") or {}
                contacts = data.get("contacts")
                if isinstance(contacts, list) and contacts:
                    return contacts, True
        except Exception as exc:  # defensive: never let a lookup error hide numbers
            logger.warning("emergency_contacts_lookup_failed", error=str(exc))
    return list(CAMBODIA_EMERGENCY_CONTACTS), False


async def _handle_sos_alert(inp: dict, session: ConversationState) -> dict:
    """Resilient SOS handler enforcing the safety invariant: a user reporting an
    emergency ALWAYS receives actionable Cambodia emergency numbers and never a
    hard failure — regardless of auth status OR backend availability.

    - Guests are NEVER POSTed to ``ai-tools/sos``: ``session.user_id`` is not a
      real ``users`` row, so the write would FK-fail (HTTP 500) and yield nothing.
    - Authenticated users get a best-effort backend write (notifies the support
      team). Whether it succeeds or fails, the emergency numbers are still
      returned; ``alert_logged`` reports whether the write actually landed.
    """
    location = inp.get("location") or ""
    user_message = inp.get("message") or ""
    contacts, _is_live = await _resolve_emergency_contacts(location, session)
    alert_logged = False

    if session.is_authenticated:
        try:
            backend = get_backend_client()
            # Server-side inject the verified session user id; never trust a
            # model-supplied user_id for this mutation (Issue 10).
            payload = {
                "user_id": session.user_id,
                "location": location,
                "message": user_message,
            }
            result = await backend.request(
                "POST",
                "ai-tools/sos",
                language=session.preferred_language.lower(),
                json=payload,
            )
            alert_logged = bool(result.get("success"))
        except Exception as exc:  # best-effort: a failed write must NOT hide numbers
            logger.warning("sos_alert_write_failed", error=str(exc))
            alert_logged = False

    if alert_logged:
        message = (
            "Emergency support has been alerted. If you are in danger, call these "
            "Cambodia emergency numbers right now."
        )
    else:
        message = (
            "If you are in danger, call these Cambodia emergency numbers right now. "
            "(We couldn't auto-notify our support team, but these numbers are live "
            "and reachable immediately.)"
        )

    return {
        "success": True,
        "data": {
            "contacts": contacts,
            "message": message,
            "alert_logged": alert_logged,
            "location": location,
        },
    }


async def _execute_tool(name: str, inp: dict, session: ConversationState) -> dict:
    # SOS is safety-critical: it must ALWAYS return actionable emergency numbers
    # and NEVER a hard failure, regardless of auth status or backend availability.
    # The backend SOS write (notifying support) is a best-effort enhancement only.
    if name == "send_sos_alert":
        return await _handle_sos_alert(inp, session)

    dispatch = TOOL_DISPATCH.get(name)
    if not dispatch:
        return {"success": False, "error": f"Unknown tool: {name}"}
    # Server-side inject the verified session user id; never trust a model-supplied
    # user_id for user-scoped mutations (Issue 10).
    if name in _USER_SCOPED_TOOLS:
        inp = {**inp, "user_id": session.user_id}
    method, path = dispatch
    # Path templates like "trips/{trip_id}" are filled from input; those keys are
    # then dropped so they aren't also sent as query params/body.
    if "{" in path:
        inp = dict(inp)
        for key in re.findall(r"\{(\w+)\}", path):
            path = path.replace("{" + key + "}", str(inp.pop(key, "")))
    backend = get_backend_client()
    kwargs = {"json": inp} if method == "POST" else {"params": inp}
    return await backend.request(method, path, language=session.preferred_language.lower(), **kwargs)


async def run_agent(session: ConversationState, user_text: str) -> tuple[str, dict | None]:
    """Run agent and return (plain_text, content_payload)."""
    session.messages.append({"role": "user", "content": user_text})

    system = build_system_prompt(session)
    client = get_model_client(session)
    messages = session.messages[-MAX_MESSAGES:]
    all_tool_results: list[tuple[str, dict]] = []
    search_destination: str | None = None
    last_error: BaseException | None = None

    for _ in range(MAX_TOOL_LOOPS):
        try:
            response = await client.create_message(
                system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
            )
        except Exception as exc:  # model unreachable/timeout → surface cause
            last_error = exc
            break

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            text = _sanitize_assistant_text(text)
            session.messages.append({"role": "assistant", "content": text})
            return text, _build_content_payload(all_tool_results, search_destination)

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

        # Capture the searched destination so trip cards can resolve map coords
        # (the backend trip response carries no province/location).
        for b in tool_calls:
            if b.name == "search_trips" and b.input.get("destination"):
                search_destination = b.input["destination"]

        # OpenAI-compatible format: assistant message with tool_calls array
        assistant_msg: dict = {"role": "assistant", "content": None, "tool_calls": []}
        # Include any text the model produced alongside tool calls
        text_parts = [b.text for b in response.content if b.type == "text" and b.text]
        if text_parts:
            assistant_msg["content"] = " ".join(text_parts)
        for b in tool_calls:
            assistant_msg["tool_calls"].append({
                "id": b.id,
                "type": "function",
                "function": {"name": b.name, "arguments": json.dumps(b.input)},
            })
        session.messages.append(assistant_msg)

        try:
            results = await asyncio.gather(*[_execute_tool(b.name, b.input, session) for b in tool_calls])
        except Exception as exc:  # tool layer failure (defensive; requests are caught)
            last_error = exc
            break
        for tc, result in zip(tool_calls, results):
            all_tool_results.append((tc.name, result))

        # OpenAI-compatible format: one role=tool message per tool call
        for tc, result in zip(tool_calls, results):
            session.messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })
        messages = session.messages[-MAX_MESSAGES:]

    return f"I'm having trouble processing your request. {_friendly_cause(last_error)}", None


async def run_agent_streaming(
    session: ConversationState, user_text: str,
) -> AsyncIterator[dict]:
    """Stream text chunks, emit tool_status events, then emit final with content_payload."""
    session.messages.append({"role": "user", "content": user_text})

    system = build_system_prompt(session)
    client = get_model_client(session)
    messages = session.messages[-MAX_MESSAGES:]
    all_tool_results: list[tuple[str, dict]] = []
    search_destination: str | None = None
    search_label: str | None = None
    last_error: BaseException | None = None

    for _ in range(MAX_TOOL_LOOPS):
        streamed = False
        accumulated_text = ""
        response = None

        if hasattr(client, "stream_message"):
            try:
                async for chunk in client.stream_message(
                    system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
                ):
                    if chunk.get("reasoning"):
                        yield {"type": "agent_reasoning_chunk", "delta": chunk["reasoning"]}
                    if chunk.get("delta"):
                        accumulated_text += chunk["delta"]
                        streamed = True
                        yield {"type": "agent_stream_chunk", "delta": chunk["delta"]}
                    if chunk.get("final"):
                        response = chunk["final"]
                        break
            except Exception as exc:
                logger.warning("streaming_failed_falling_back", error=str(exc))
                response = None
                streamed = False
                accumulated_text = ""

        if response is None:
            try:
                response = await client.create_message(
                    system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
                )
            except Exception as exc:  # model unreachable/timeout → surface cause
                last_error = exc
                break

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            full_text = _sanitize_assistant_text(accumulated_text if streamed else text)
            # Only emit a stream chunk if we didn't already stream the text
            if not streamed and full_text:
                yield {"type": "agent_stream_chunk", "delta": full_text}
            session.messages.append({"role": "assistant", "content": full_text})
            payloads = build_content_payloads(all_tool_results, search_destination, query=search_label)
            # Follow-up chips + per-card blurbs run concurrently (same client) so
            # the post-answer enrichment adds ~one round-trip, not two. With a
            # slow reasoning model (gpt-oss-120b, 60-90s/call) that round-trip
            # would delay `final` for minutes — bound it so the answer always
            # lands promptly; chips/blurbs degrade gracefully when skipped.
            try:
                suggestions, payloads = await asyncio.wait_for(
                    asyncio.gather(
                        generate_suggestions(session, full_text, client=client, payloads=payloads),
                        attach_card_blurbs(session, payloads, client=client),
                    ),
                    timeout=25.0,
                )
            except Exception:
                suggestions = []
                logger.warning("enrichment_skipped_timeout")
            yield {
                "type": "final",
                "text": full_text,
                "content_payload": payloads[0] if payloads else None,
                "content_payloads": payloads,
                "suggestions": suggestions,
                "requires_payment": _extract_booking_hold(all_tool_results),
            }
            return

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

        # Surface the AI's plan in the "thinking" panel: any narration text the
        # model produced, plus a readable line per tool it's about to call. The
        # model emits no native chain-of-thought on tool-use turns, so this is
        # the real, honest decision process we can show.
        narration = " ".join(b.text for b in response.content if b.type == "text" and b.text).strip()
        if narration:
            yield {"type": "agent_reasoning_chunk", "delta": narration + "\n"}
        for b in tool_calls:
            yield {"type": "agent_reasoning_chunk", "delta": "• " + _format_tool_intent(b.name, b.input) + "\n"}

        # Capture the searched destination so trip cards can resolve map coords.
        for b in tool_calls:
            if b.name == "search_trips" and b.input.get("destination"):
                search_destination = b.input["destination"]
            if search_label is None and b.name in (
                "search_trips", "search_hotels", "search_guides", "search_transport"
            ):
                label = (
                    b.input.get("destination")
                    or b.input.get("location")
                    or b.input.get("query")
                    or b.input.get("keyword")
                    or b.input.get("city")
                )
                if label:
                    search_label = str(label)

        # Deferred-auth gate: a guest cannot create a booking hold. Emit
        # requires_login instead of calling the tool with an invalid user_id.
        if not session.is_authenticated and any(
            b.name == "create_booking_hold" for b in tool_calls
        ):
            yield {
                "type": "requires_login",
                "text": "Please log in or create an account to complete your booking. Your chat will continue right here.",
            }
            return

        # OpenAI-compatible format: assistant message with tool_calls array
        assistant_msg: dict = {"role": "assistant", "content": None, "tool_calls": []}
        text_parts = [b.text for b in response.content if b.type == "text" and b.text]
        if text_parts:
            assistant_msg["content"] = " ".join(text_parts)
        for b in tool_calls:
            assistant_msg["tool_calls"].append({
                "id": b.id,
                "type": "function",
                "function": {"name": b.name, "arguments": json.dumps(b.input)},
            })
        session.messages.append(assistant_msg)

        for tc in tool_calls:
            yield {"type": "agent_tool_status", "tool_use_id": tc.id, "name": tc.name, "status": "running"}

        try:
            results = await asyncio.gather(*[_execute_tool(b.name, b.input, session) for b in tool_calls])
        except Exception as exc:  # tool layer failure (defensive; requests are caught)
            last_error = exc
            break

        for tc, result in zip(tool_calls, results):
            status = "completed" if result.get("success") else "failed"
            yield {"type": "agent_tool_status", "tool_use_id": tc.id, "name": tc.name, "status": status}
            all_tool_results.append((tc.name, result))

        # OpenAI-compatible format: one role=tool message per tool call
        for tc, result in zip(tool_calls, results):
            session.messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })
        messages = session.messages[-MAX_MESSAGES:]

    fallback_text = f"I'm having trouble processing your request. {_friendly_cause(last_error)}"
    yield {"type": "final", "text": fallback_text, "content_payload": None, "content_payloads": [], "suggestions": [], "requires_payment": None}
