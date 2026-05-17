from typing import Callable, Awaitable
from agent.session.state import ConversationState


async def get_trip_suggestions(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/trips", inputs)


async def get_trip_itinerary(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/itinerary", inputs)


async def get_trip_images(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/images", inputs)


async def compare_trips(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/compare", inputs)


async def calculate_custom_trip(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/custom", inputs)


async def customize_trip(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "search/customize", inputs)
