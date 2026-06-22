"""Contextual follow-up suggestion chips for the concierge.

After each answer we offer 2-4 short, clickable follow-up prompts (like
TripAdvisor's "Plan with AI"). They're produced by a cheap, tool-less model
call; if that fails or returns nothing usable, we fall back to heuristics keyed
by the last content type and the user's language. Generation never raises — a
suggestions failure must not break the chat turn.
"""
import asyncio
import json
import re

from agent.models.client import ModelClient
from agent.models.factory import get_model_client
from agent.session.state import ConversationState
from utils.logging import logger

MIN_SUGGESTIONS = 2
MAX_SUGGESTIONS = 4
_MAX_LEN = 60
_TIMEOUT_S = 8.0
_MAX_TOKENS = 200

_SUGGESTION_SYSTEM = (
    "You generate short follow-up suggestions for a Cambodia travel concierge chat. "
    "Given the assistant's last answer, propose 2-4 natural next questions or actions the "
    "traveler is likely to want next, each a tappable chip. Rules: each suggestion is at most "
    "6 words; no numbering; no surrounding quotes; specific to Cambodia travel and this "
    "conversation. Respond in the SAME language as the assistant's answer. "
    'Output ONLY a JSON array of strings, e.g. ["...", "..."]. No other text.'
)

# Language-keyed generic fallback (used when the model call fails for non-EN or
# when no content-type-specific set applies).
_FALLBACK: dict[str, list[str]] = {
    "EN": ["Plan a 3-day itinerary", "Find hotels", "What's the weather like?"],
    "KH": ["រៀបចំកម្មវិធី ៣ ថ្ងៃ", "ស្វែងរកសណ្ឋាគារ", "តើអាកាសធាតុយ៉ាងណា?"],
    "ZH": ["规划3天行程", "查找酒店", "天气怎么样？"],
}

# Content-type-specific fallback (English) — used when the model call fails and
# we know what the user was just shown.
_FALLBACK_BY_TYPE: dict[str, list[str]] = {
    "trip_cards": ["Show me on a map", "Find hotels nearby", "Best time to visit?"],
    "comparison": ["Show me on a map", "Find hotels nearby", "Which suits families?"],
    "hotel_cards": ["Compare these hotels", "Show cheaper options", "What's nearby?"],
    "guide_cards": ["Book a guide", "Mandarin-speaking guides", "Guides for Angkor"],
    "transport_options": ["Cheapest option?", "Book transport", "How long is it?"],
    "weather": ["Best time to visit?", "What should I pack?", "Plan a trip"],
    "budget_estimate": ["Find trips in budget", "Cheaper hotels", "Money-saving tips"],
    "trip_detail": ["Book this trip", "Find a hotel nearby", "What's included?"],
    "hotel_detail": ["Book this hotel", "Show similar hotels", "What's nearby?"],
}


def _last_content_type(payloads: list[dict] | None) -> str | None:
    """The most relevant content type shown this turn (ignoring the derived map)."""
    if not payloads:
        return None
    for p in reversed(payloads):
        ptype = p.get("type")
        if ptype and ptype != "map_view":
            return ptype
    return None


def _heuristic(last_type: str | None, lang: str) -> list[str]:
    if lang == "EN" and last_type in _FALLBACK_BY_TYPE:
        return _FALLBACK_BY_TYPE[last_type][:MAX_SUGGESTIONS]
    return _FALLBACK.get(lang, _FALLBACK["EN"])[:MAX_SUGGESTIONS]


def _parse_suggestions(text: str) -> list[str]:
    """Extract a JSON array of short strings from the model output. Tolerant of
    surrounding prose/reasoning by grabbing the first [...] block."""
    if not text:
        return []
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        arr = json.loads(match.group(0))
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(arr, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in arr:
        if not isinstance(item, str):
            continue
        s = item.strip().strip('"').strip()[:_MAX_LEN].strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= MAX_SUGGESTIONS:
            break
    return out


async def generate_suggestions(
    session: ConversationState,
    answer_text: str,
    *,
    client: ModelClient | None = None,
    payloads: list[dict] | None = None,
) -> list[str]:
    """Return 2-4 contextual follow-up chips for the latest answer.

    Uses a cheap tool-less model call (reusing the turn's client when provided);
    on any failure, timeout, or insufficient result, falls back to heuristics
    keyed by the last content type and the user's language. Never raises.
    """
    lang = session.preferred_language
    last_type = _last_content_type(payloads)

    if not answer_text or not answer_text.strip():
        return _heuristic(last_type, lang)

    try:
        model = client or get_model_client(session)
        user_msg = (
            f"Assistant answer:\n{answer_text.strip()[:1200]}\n\n"
            "Give 2-4 follow-up suggestion chips as a JSON array of strings."
        )
        response = await asyncio.wait_for(
            model.create_message(
                system=_SUGGESTION_SYSTEM,
                messages=[{"role": "user", "content": user_msg}],
                tools=[],
                max_tokens=_MAX_TOKENS,
            ),
            timeout=_TIMEOUT_S,
        )
        text = next((b.text for b in response.content if b.type == "text"), "")
        parsed = _parse_suggestions(text)
        if len(parsed) >= MIN_SUGGESTIONS:
            return parsed[:MAX_SUGGESTIONS]
        return _heuristic(last_type, lang)
    except Exception as exc:  # noqa: BLE001 — suggestions must never break the turn
        logger.warning("suggestions_failed", error=str(exc), session_id=session.session_id)
        return _heuristic(last_type, lang)
