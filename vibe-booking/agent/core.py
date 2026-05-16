from agent.session.state import ConversationState
from agent.models.factory import get_model_client
from agent.tools.schemas import TOOL_SCHEMAS
from agent.tools.executor import execute_tools_parallel
from agent.prompts.builder import build_system_prompt
from agent.formatters.formatter import format_response
from utils.logging import logger

MAX_TOOL_LOOPS = 5
MAX_MESSAGES = 20
MAX_TOKENS = 2048


async def run_agent(session: ConversationState, user_text: str) -> dict:
    session.messages.append({"role": "user", "content": user_text})

    system = build_system_prompt(session)
    client = get_model_client(session)
    messages = session.messages[-MAX_MESSAGES:]

    all_tool_results: list[dict] = []

    for _ in range(MAX_TOOL_LOOPS):
        response = await client.create_message(
            system=system,
            messages=messages,
            tools=TOOL_SCHEMAS,
            max_tokens=MAX_TOKENS,
        )

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            session.messages.append({"role": "assistant", "content": text})
            return format_response(text, all_tool_results, session)

        # tool_use
        tool_calls = [
            {"id": b.id, "name": b.name, "input": b.input}
            for b in response.content
            if b.type == "tool_use"
        ]
        if not tool_calls:
            break

        # Append assistant message with tool_use blocks
        session.messages.append({
            "role": "assistant",
            "content": [
                {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}
                for b in response.content
                if b.type == "tool_use"
            ],
        })

        tool_results = await execute_tools_parallel(tool_calls, session)
        all_tool_results.extend(tool_results)

        # Append tool results as user message
        session.messages.append({"role": "user", "content": tool_results})
        messages = session.messages[-MAX_MESSAGES:]

    # Fallback if loop exhausted
    return {"type": "text", "text": "I'm having trouble processing your request. Please try again."}
