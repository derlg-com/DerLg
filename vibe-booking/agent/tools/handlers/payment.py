from typing import Callable
from agent.session.state import ConversationState


async def generate_payment_qr(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "payments/qr", inputs)


async def check_payment_status(inputs: dict, session: ConversationState, call: Callable) -> dict:
    return await call(session, "payments/status", inputs)
