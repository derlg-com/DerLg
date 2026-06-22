"""Unit tests for agent.blurbs (per-card descriptions)."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from agent.blurbs import attach_card_blurbs, _parse_blurbs, _collect_items
from agent.session.state import ConversationState
from agent.models.client import ContentBlock, ModelResponse


@pytest.fixture
def session():
    return ConversationState(session_id="s1", user_id="u1", preferred_language="EN")


def _resp(text: str) -> ModelResponse:
    return ModelResponse(stop_reason="end_turn", content=[ContentBlock(type="text", text=text)])


def _trip_payloads():
    return [
        {
            "type": "trip_cards",
            "data": {
                "trips": [
                    {"id": "t1", "name": "Angkor Sunrise", "province": "Siem Reap"},
                    {"id": "t2", "name": "Kampot Pepper Farm", "province": "Kampot"},
                ]
            },
            "actions": [],
            "metadata": {},
        }
    ]


def test_parse_blurbs_object():
    out = _parse_blurbs('{"t1": "Best for **sunrise** lovers.", "t2": "Quiet countryside escape."}')
    assert out["t1"].startswith("Best for")
    assert out["t2"] == "Quiet countryside escape."


def test_parse_blurbs_tolerates_prose_and_bad():
    assert _parse_blurbs('here: {"a": "x"} done')["a"] == "x"
    assert _parse_blurbs("no json") == {}
    assert _parse_blurbs("") == {}


def test_collect_items_across_card_types():
    payloads = _trip_payloads() + [
        {"type": "hotel_cards", "data": {"hotels": [{"id": "h1", "name": "Riverside"}]}},
        {"type": "weather", "data": {"forecast": []}},
    ]
    items = _collect_items(payloads)
    ids = {it["id"] for it in items}
    assert ids == {"t1", "t2", "h1"}


@pytest.mark.asyncio
async def test_attach_injects_model_blurbs(session):
    client = MagicMock(spec=["create_message"])
    client.create_message = AsyncMock(
        return_value=_resp('{"t1": "Sunrise over Angkor — unforgettable.", "t2": "Sleepy pepper country."}')
    )
    payloads = await attach_card_blurbs(session, _trip_payloads(), client=client)
    trips = payloads[0]["data"]["trips"]
    assert trips[0]["blurb"] == "Sunrise over Angkor — unforgettable."
    assert trips[1]["blurb"] == "Sleepy pepper country."


@pytest.mark.asyncio
async def test_attach_falls_back_to_description_on_error(session):
    client = MagicMock(spec=["create_message"])
    client.create_message = AsyncMock(side_effect=RuntimeError("nvidia down"))
    payloads = [
        {
            "type": "hotel_cards",
            "data": {"hotels": [{"id": "h1", "name": "Riverside", "description": "Calm riverfront stay near the night market."}]},
        }
    ]
    out = await attach_card_blurbs(session, payloads, client=client)
    assert out[0]["data"]["hotels"][0]["blurb"] == "Calm riverfront stay near the night market."


@pytest.mark.asyncio
async def test_attach_no_items_is_noop(session):
    client = MagicMock(spec=["create_message"])
    client.create_message = AsyncMock(side_effect=AssertionError("should not be called"))
    payloads = [{"type": "weather", "data": {"forecast": []}}]
    out = await attach_card_blurbs(session, payloads, client=client)
    assert out == payloads
    client.create_message.assert_not_called()
