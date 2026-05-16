from typing import Callable
from agent.session.state import ConversationState


async def get_hotel_details(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/hotels", inputs)


async def get_weather_forecast(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/weather", inputs)


async def get_places(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/places", inputs)


async def get_upcoming_festivals(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/festivals", inputs)


async def estimate_budget(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "budget/estimate", inputs)


async def get_currency_rates(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "currency/rates", inputs)


async def get_transport_options(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/transport", inputs)
