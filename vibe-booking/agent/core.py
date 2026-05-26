import asyncio
import json
from typing import AsyncIterator
from agent.session.state import ConversationState
from agent.models.factory import get_model_client
from agent.tools import ALL_TOOLS, TOOL_DISPATCH
from agent.prompts.builder import build_system_prompt
from agent.backend_client import get_backend_client
from utils.logging import logger

MAX_TOOL_LOOPS = 5
MAX_MESSAGES = 20
MAX_TOKENS = 2048


async def _execute_tool(name: str, inp: dict, session: ConversationState) -> dict:
    dispatch = TOOL_DISPATCH.get(name)
    if not dispatch:
        return {"success": False, "error": f"Unknown tool: {name}"}
    method, path = dispatch
    backend = get_backend_client()
    kwargs = {"json": inp} if method == "POST" else {"params": inp}
    return await backend.request(method, path, language=session.preferred_language.lower(), **kwargs)


async def run_agent(session: ConversationState, user_text: str) -> str:
    """Run agent and return plain text response."""
    session.messages.append({"role": "user", "content": user_text})

    system = build_system_prompt(session)
    client = get_model_client(session)
    messages = session.messages[-MAX_MESSAGES:]

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
            return text

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

        session.messages.append({
            "role": "assistant",
            "content": [{"type": "tool_use", "id": b.id, "name": b.name, "input": b.input} for b in tool_calls],
        })

        results = await asyncio.gather(*[_execute_tool(b.name, b.input, session) for b in tool_calls])
        tool_result_msgs = [
            {"type": "tool_result", "tool_use_id": tc.id, "content": json.dumps(result)}
            for tc, result in zip(tool_calls, results)
        ]
        session.messages.append({"role": "user", "content": tool_result_msgs})
        messages = session.messages[-MAX_MESSAGES:]

    return "I'm having trouble processing your request. Please try again."


async def run_agent_streaming(
    session: ConversationState, user_text: str,
) -> AsyncIterator[dict]:
    """Stream text chunks, then emit a final event with the full text."""
    session.messages.append({"role": "user", "content": user_text})

    system = build_system_prompt(session)
    client = get_model_client(session)
    messages = session.messages[-MAX_MESSAGES:]

    for _ in range(MAX_TOOL_LOOPS):
        accumulated_text = ""
        response = None

        if hasattr(client, "stream_message"):
            try:
                async for chunk in client.stream_message(
                    system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
                ):
                    if chunk.get("delta"):
                        accumulated_text += chunk["delta"]
                        yield {"type": "agent_stream_chunk", "delta": chunk["delta"]}
                    if chunk.get("final"):
                        response = chunk["final"]
                        break
            except Exception as exc:
                logger.warning("streaming_failed_falling_back", error=str(exc))
                response = None

        if response is None:
            response = await client.create_message(
                system=system, messages=messages, tools=ALL_TOOLS, max_tokens=MAX_TOKENS,
            )

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            if text and not accumulated_text:
                yield {"type": "agent_stream_chunk", "delta": text}
            session.messages.append({"role": "assistant", "content": text})
            yield {"type": "final", "text": text or accumulated_text}
            return

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

        session.messages.append({
            "role": "assistant",
            "content": [{"type": "tool_use", "id": b.id, "name": b.name, "input": b.input} for b in tool_calls],
        })

        results = await asyncio.gather(*[_execute_tool(b.name, b.input, session) for b in tool_calls])
        tool_result_msgs = [
            {"type": "tool_result", "tool_use_id": tc.id, "content": json.dumps(result)}
            for tc, result in zip(tool_calls, results)
        ]
        session.messages.append({"role": "user", "content": tool_result_msgs})
        messages = session.messages[-MAX_MESSAGES:]

    yield {"type": "final", "text": "I'm having trouble processing your request. Please try again."}
