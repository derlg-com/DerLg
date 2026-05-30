import asyncio
import json
import re
from typing import AsyncIterator
from agent.session.state import ConversationState
from agent.models.factory import get_model_client
from agent.tools import ALL_TOOLS, TOOL_DISPATCH
from agent.tools.geo import lookup_coords
from agent.prompts.builder import build_system_prompt
from agent.backend_client import get_backend_client
from utils.logging import logger

MAX_TOOL_LOOPS = 5
MAX_MESSAGES = 20
MAX_TOKENS = 2048

# Mutations whose user_id must come from the verified session, never the model.
_USER_SCOPED_TOOLS = ("create_booking_hold", "send_sos_alert")

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


def _norm_trip(t: dict) -> dict:
    name = t.get("title") or t.get("name", "")
    province = t.get("province") or t.get("destination")
    coords = lookup_coords(province, name, t.get("description"))
    return _strip_none({
        "id": t.get("id", ""),
        "name": name,
        "description": t.get("description"),
        "province": province,
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
    return _strip_none({
        "id": h.get("id", ""),
        "name": h.get("name", ""),
        "address": h.get("address"),
        "priceUsd": h.get("price_from_usd") or h.get("priceUsd") or 0,
        "rating": h.get("star_rating") or h.get("rating"),
        "imageUrl": images[0] if images else h.get("imageUrl"),
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


def _build_content_payload(tool_results: list[tuple[str, dict]]) -> dict | None:
    """Map tool results to a typed ContentPayload for the frontend.

    Handles both array responses (backend returns list directly) and
    object responses (backend returns dict with nested data).
    Maps snake_case backend fields to camelCase frontend fields.
    Returns the first meaningful payload, or None.
    """
    for tool_name, result in tool_results:
        if not result.get("success"):
            continue
        raw = result.get("data")
        if raw is None:
            continue

        if tool_name == "search_trips":
            trips = [_norm_trip(t) for t in _as_list(raw)]
            if not trips:
                continue
            payload_type = "comparison" if len(trips) == 2 else "trip_cards"
            key = "items" if payload_type == "comparison" else "trips"
            return {"type": payload_type, "data": {key: trips}, "actions": [], "metadata": {}}

        if tool_name == "search_hotels":
            hotels = [_norm_hotel(h) for h in _as_list(raw)]
            if not hotels:
                continue
            return {"type": "hotel_cards", "data": {"hotels": hotels}, "actions": [], "metadata": {}}

        if tool_name == "search_transport":
            options = [_norm_transport(v) for v in _as_list(raw)]
            if not options:
                continue
            return {"type": "transport_options", "data": {"options": options}, "actions": [], "metadata": {}}

        if tool_name == "get_weather":
            # Backend returns a single weather object, not an array
            if isinstance(raw, dict):
                forecast = [{
                    "date": raw.get("date", ""),
                    "high": raw.get("temp_high_c") or raw.get("high", 0),
                    "low": raw.get("temp_low_c") or raw.get("low", 0),
                    "condition": raw.get("condition", ""),
                    "icon": raw.get("icon"),
                }]
                return {"type": "weather", "data": {"forecast": forecast}, "actions": [], "metadata": {}}

        if tool_name == "estimate_budget":
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
                    return {
                        "type": "budget_estimate",
                        "data": {"totalUsd": total, "breakdown": breakdown_dict},
                        "actions": [],
                        "metadata": {},
                    }

        if tool_name == "generate_payment_qr":
            if isinstance(raw, dict) and (raw.get("qr_image_url") or raw.get("qr_url")):
                return {
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
                }

        if tool_name == "check_payment_status":
            if isinstance(raw, dict) and raw.get("status"):
                return {
                    "type": "payment_status",
                    "data": {
                        "paymentIntentId": raw.get("payment_intent_id") or raw.get("paymentIntentId", ""),
                        "bookingId": raw.get("booking_id") or raw.get("bookingId", ""),
                        "status": (raw.get("status") or "PENDING").upper(),
                        "amountUsd": raw.get("amount_usd") or raw.get("amountUsd") or 0,
                        "method": raw.get("method"),
                    },
                    "actions": [],
                    "metadata": {},
                }

        if tool_name == "create_booking_hold":
            if isinstance(raw, dict) and raw.get("booking_id"):
                return {
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
                }

    return None


async def _execute_tool(name: str, inp: dict, session: ConversationState) -> dict:
    dispatch = TOOL_DISPATCH.get(name)
    if not dispatch:
        return {"success": False, "error": f"Unknown tool: {name}"}
    # Server-side inject the verified session user id; never trust a model-supplied
    # user_id for user-scoped mutations (Issue 10).
    if name in _USER_SCOPED_TOOLS:
        inp = {**inp, "user_id": session.user_id}
    method, path = dispatch
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

    for _ in range(MAX_TOOL_LOOPS):
        response = await client.create_message(
            system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
        )

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            text = _sanitize_assistant_text(text)
            session.messages.append({"role": "assistant", "content": text})
            return text, _build_content_payload(all_tool_results)

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

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

        results = await asyncio.gather(*[_execute_tool(b.name, b.input, session) for b in tool_calls])
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

    return "I'm having trouble processing your request. Please try again.", None


async def run_agent_streaming(
    session: ConversationState, user_text: str,
) -> AsyncIterator[dict]:
    """Stream text chunks, emit tool_status events, then emit final with content_payload."""
    session.messages.append({"role": "user", "content": user_text})

    system = build_system_prompt(session)
    client = get_model_client(session)
    messages = session.messages[-MAX_MESSAGES:]
    all_tool_results: list[tuple[str, dict]] = []

    for _ in range(MAX_TOOL_LOOPS):
        streamed = False
        accumulated_text = ""
        response = None

        if hasattr(client, "stream_message"):
            try:
                async for chunk in client.stream_message(
                    system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
                ):
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
            response = await client.create_message(
                system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
            )

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            full_text = _sanitize_assistant_text(accumulated_text if streamed else text)
            # Only emit a stream chunk if we didn't already stream the text
            if not streamed and full_text:
                yield {"type": "agent_stream_chunk", "delta": full_text}
            session.messages.append({"role": "assistant", "content": full_text})
            yield {"type": "final", "text": full_text, "content_payload": _build_content_payload(all_tool_results), "requires_payment": _extract_booking_hold(all_tool_results)}
            return

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

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

        results = await asyncio.gather(*[_execute_tool(b.name, b.input, session) for b in tool_calls])

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

    yield {"type": "final", "text": "I'm having trouble processing your request. Please try again.", "content_payload": None, "requires_payment": None}
