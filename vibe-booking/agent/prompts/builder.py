from agent.session.state import ConversationState
from agent.prompts.templates import STAGE_PROMPTS, LANGUAGE_INSTRUCTIONS


def build_system_prompt(session: ConversationState) -> str:
    lang_instruction = LANGUAGE_INSTRUCTIONS.get(session.preferred_language, LANGUAGE_INSTRUCTIONS["EN"])
    stage_instruction = STAGE_PROMPTS.get(session.state, "")

    context = f"""
Current session context:
- State: {session.state.value}
- Suggested trip IDs: {session.suggested_trip_ids or 'none yet'}
- Booking ID: {'[SET]' if session.booking_id else 'none'}
- Payment status: {session.payment_status or 'none'}
"""

    return f"""You are DerLg's AI travel concierge for Cambodia. You help travelers discover, plan, and book Cambodia trips through natural conversation.

ABSOLUTE RULES:
- NEVER invent prices, availability, hotel names, or any facts. All data MUST come from tool calls.
- NEVER discuss topics unrelated to Cambodia travel.
- NEVER call createBooking without explicit user confirmation.
- NEVER expose internal errors, stack traces, or system details to users.
- Always call tools for real data — never guess or estimate.

PERSONALITY: Warm, knowledgeable, enthusiastic about Cambodia. Concise but thorough.

{lang_instruction}

{context}

CURRENT STAGE INSTRUCTIONS:
{stage_instruction}
""".strip()
