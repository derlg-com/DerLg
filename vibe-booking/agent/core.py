import asyncio
import json
from agent.session.state import ConversationState, AgentState
from agent.models.factory import get_model_client
from agent.tools import ALL_TOOLS, TOOL_DISPATCH
from agent.prompts.builder import build_system_prompt
from agent.formatters.formatter import format_response
from agent.backend_client import get_backend_client
from utils.logging import logger

MAX_TOOL_LOOPS = 5
MAX_MESSAGES = 20
MAX_TOKENS = 2048


async def _execute_tool(name: str, inp: dict, session: ConversationState) -> dict:
    dispatch = TOOL_DISPATCH.get(name)
    if not dispatch:
        return {"success": False, "error": {"code": "UNKNOWN_TOOL", "message": f"Unknown tool: {name}"}}
    method, path = dispatch
    backend = get_backend_client()
    language = session.preferred_language.lower()
    kwargs = {"json": inp} if method == "POST" else {"params": inp}
    return await backend.request(method, path, language=language, **kwargs)


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
            tools=ALL_TOOLS,
            max_tokens=MAX_TOKENS,
        )

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            session.messages.append({"role": "assistant", "content": text})
            return format_response(text, all_tool_results, session)

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

        session.messages.append({
            "role": "assistant",
            "content": [{"type": "tool_use", "id": b.id, "name": b.name, "input": b.input} for b in tool_calls],
        })

        results = await asyncio.gather(*[_execute_tool(b.name, b.input, session) for b in tool_calls])

        tool_result_msgs = []
        for tc, result in zip(tool_calls, results):
            tool_result_msgs.append({"type": "tool_result", "tool_use_id": tc.id, "content": json.dumps(result)})
            all_tool_results.append({"type": "tool_result", "tool_use_id": tc.id, "content": json.dumps(result)})

            # Session side effects
            if tc.name == "create_booking_hold" and result.get("success"):
                data = result.get("data", {})
                session.booking_id = data.get("booking_id", "")
                session.booking_ref = data.get("reference", "")
                # Signal payment handoff to WebSocket handler
                return {
                    "type": "requires_payment",
                    "booking_id": session.booking_id,
                    "amount_usd": data.get("total_price_usd", 0),
                    "methods": ["stripe", "bakong"],
                    "hold_expires_at": data.get("hold_expires_at"),
                }

        session.messages.append({"role": "user", "content": tool_result_msgs})
        messages = session.messages[-MAX_MESSAGES:]

    return {"type": "text", "text": "I'm having trouble processing your request. Please try again."}
