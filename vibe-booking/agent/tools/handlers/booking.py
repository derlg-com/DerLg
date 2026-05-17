from typing import Callable
from agent.session.state import ConversationState


async def validate_user_details(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "users/validate", inputs)


async def create_booking(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "bookings", inputs)


async def cancel_booking(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "bookings/cancel", inputs)


async def modify_booking(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "bookings/modify", inputs)


async def apply_discount_code(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "discounts/apply", inputs)
