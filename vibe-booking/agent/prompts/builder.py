from agent.session.state import ConversationState
from agent.prompts.templates import SYSTEM_PROMPT, LANGUAGE_INSTRUCTIONS


def build_system_prompt(session: ConversationState) -> str:
    lang = LANGUAGE_INSTRUCTIONS.get(session.preferred_language, LANGUAGE_INSTRUCTIONS["EN"])
    return f"{SYSTEM_PROMPT}\n{lang}"
