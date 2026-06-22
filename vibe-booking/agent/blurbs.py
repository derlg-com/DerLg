"""Per-card descriptions ("blurbs") for result cards.

Each trip/hotel card shows a short, opinionated one-liner on why a traveler
might pick it (TripAdvisor "Plan with AI" style). Produced by a single
tool-less model call covering all cards in the turn; on any failure we fall
back to the backend description. Generation never raises — a blurb failure must
not break the chat turn.
"""
import asyncio
import json
import re

from agent.models.client import ModelClient
from agent.models.factory import get_model_client
from agent.session.state import ConversationState
from utils.logging import logger

_TIMEOUT_S = 8.0
_MAX_TOKENS = 600
_MAX_BLURB_LEN = 220
_CARD_TYPES = {"trip_cards": "trips", "comparison": "items", "hotel_cards": "hotels"}

_LANG_NAME = {"EN": "English", "KH": "Khmer", "ZH": "Simplified Chinese"}

_SYSTEM_TMPL = (
    "You are a Cambodia travel concierge writing ultra-short result-card blurbs. "
    "For each listing (given as `id: name (location)`), write ONE punchy sentence "
    "(max 22 words) on why a traveler might pick it — concrete and opinionated, not generic. "
    "You may bold 1-2 key phrases with **double asterisks**. Respond in {lang}. "
    'Output ONLY a JSON object mapping each id to its sentence, e.g. {{"id1": "...", "id2": "..."}}. '
    "No other text."
)


def _collect_items(payloads: list[dict]) -> list[dict]:
    """Flat list of the card item dicts that should get a blurb."""
    items: list[dict] = []
    for p in payloads:
        key = _CARD_TYPES.get(p.get("type", ""))
        if not key:
            continue
        data = p.get("data") or {}
        for it in data.get(key, []):
            if isinstance(it, dict) and it.get("id"):
                items.append(it)
    return items


def _parse_blurbs(text: str) -> dict[str, str]:
    """Extract the first {...} JSON object mapping id -> blurb. Tolerant of
    surrounding prose/reasoning."""
    if not text:
        return {}
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        obj = json.loads(match.group(0))
    except (json.JSONDecodeError, ValueError):
        return {}
    if not isinstance(obj, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in obj.items():
        if isinstance(v, str) and v.strip():
            out[str(k)] = v.strip()[:_MAX_BLURB_LEN]
    return out


async def attach_card_blurbs(
    session: ConversationState,
    payloads: list[dict],
    *,
    client: ModelClient | None = None,
) -> list[dict]:
    """Inject a short `blurb` into each trip/hotel/comparison card item.

    Uses one tool-less model call for all cards; on failure or for any card the
    model skips, falls back to the backend `description`. Returns the same
    payloads (mutated in place). Never raises.
    """
    items = _collect_items(payloads)
    if not items:
        return payloads

    blurbs: dict[str, str] = {}
    try:
        model = client or get_model_client(session)
        lang = _LANG_NAME.get(session.preferred_language, "English")
        listing = "\n".join(
            f"{it.get('id')}: {it.get('name', '')} "
            f"({it.get('province') or it.get('address') or 'Cambodia'})"
            for it in items
        )
        response = await asyncio.wait_for(
            model.create_message(
                system=_SYSTEM_TMPL.format(lang=lang),
                messages=[{"role": "user", "content": listing}],
                tools=[],
                max_tokens=_MAX_TOKENS,
            ),
            timeout=_TIMEOUT_S,
        )
        text = next((b.text for b in response.content if b.type == "text"), "")
        blurbs = _parse_blurbs(text)
    except Exception as exc:  # noqa: BLE001 — blurbs must never break the turn
        logger.warning("card_blurbs_failed", error=str(exc), session_id=session.session_id)
        blurbs = {}

    for it in items:
        iid = str(it.get("id") or "")
        generated = blurbs.get(iid)
        if generated:
            it["blurb"] = generated
        elif not it.get("blurb") and it.get("description"):
            # Fall back to the backend description (trimmed) when no blurb came back.
            it["blurb"] = str(it["description"])[:_MAX_BLURB_LEN]

    return payloads
