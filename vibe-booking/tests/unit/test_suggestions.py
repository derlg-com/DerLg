"""Unit tests for agent.suggestions (follow-up chips)."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from agent.suggestions import (
    generate_suggestions,
    _parse_suggestions,
    _heuristic,
    _last_content_type,
    MAX_SUGGESTIONS,
)
from agent.session.state import ConversationState
from agent.models.client import ContentBlock, ModelResponse


@pytest.fixture
def session():
    return ConversationState(session_id="s1", user_id="u1", preferred_language="EN")


def _resp(text: str) -> ModelResponse:
    return ModelResponse(stop_reason="end_turn", content=[ContentBlock(type="text", text=text)])


# ── parsing ─────────────────────────────────────────────────────────────────

def test_parse_extracts_json_array():
    out = _parse_suggestions('["Find hotels nearby", "Best time to visit?"]')
    assert out == ["Find hotels nearby", "Best time to visit?"]


def test_parse_tolerates_surrounding_prose():
    out = _parse_suggestions('Sure! Here you go: ["Show on a map", "Book a guide"] hope that helps')
    assert out == ["Show on a map", "Book a guide"]


def test_parse_caps_at_max_and_dedups():
    raw = '["a", "a", "b", "c", "d", "e", "f"]'
    out = _parse_suggestions(raw)
    assert len(out) <= MAX_SUGGESTIONS
    assert out[0] == "a" and "a" not in out[1:]


def test_parse_returns_empty_on_garbage():
    assert _parse_suggestions("no array here") == []
    assert _parse_suggestions("") == []
    assert _parse_suggestions("{not: valid}") == []


def test_parse_drops_non_strings_and_empties():
    out = _parse_suggestions('["ok", 123, "", "  ", "good"]')
    assert out == ["ok", "good"]


# ── heuristics ──────────────────────────────────────────────────────────────

def test_heuristic_by_content_type_en():
    out = _heuristic("hotel_cards", "EN")
    assert "Compare these hotels" in out


def test_heuristic_generic_per_language():
    assert _heuristic(None, "ZH") == ["规划3天行程", "查找酒店", "天气怎么样？"]
    assert _heuristic("trip_cards", "KH")  # non-EN falls back to generic KH set
    assert _heuristic(None, "EN")


def test_last_content_type_ignores_map_view():
    payloads = [{"type": "trip_cards"}, {"type": "map_view"}]
    assert _last_content_type(payloads) == "trip_cards"
    assert _last_content_type([]) is None
    assert _last_content_type(None) is None


# ── generate_suggestions ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_uses_model_output(session):
    client = MagicMock(spec=["create_message"])
    client.create_message = AsyncMock(return_value=_resp('["Find hotels nearby", "Best time to go?"]'))
    out = await generate_suggestions(session, "Here are 3 Siem Reap tours.", client=client)
    assert out == ["Find hotels nearby", "Best time to go?"]


@pytest.mark.asyncio
async def test_generate_falls_back_on_model_error(session):
    client = MagicMock(spec=["create_message"])
    client.create_message = AsyncMock(side_effect=RuntimeError("nvidia 403"))
    out = await generate_suggestions(
        session, "Here are hotels.", client=client,
        payloads=[{"type": "hotel_cards"}],
    )
    # Falls back to the hotel_cards heuristic set (EN)
    assert "Compare these hotels" in out


@pytest.mark.asyncio
async def test_generate_falls_back_when_too_few(session):
    client = MagicMock(spec=["create_message"])
    client.create_message = AsyncMock(return_value=_resp('["only one"]'))
    out = await generate_suggestions(
        session, "Some answer", client=client, payloads=[{"type": "trip_cards"}],
    )
    # One suggestion is below MIN, so we use the heuristic set instead
    assert len(out) >= 2
    assert "Show me on a map" in out


@pytest.mark.asyncio
async def test_generate_empty_answer_returns_heuristic_without_call(session):
    client = MagicMock(spec=["create_message"])
    client.create_message = AsyncMock(side_effect=AssertionError("should not be called"))
    out = await generate_suggestions(session, "   ", client=client)
    assert len(out) >= 2
    client.create_message.assert_not_called()
