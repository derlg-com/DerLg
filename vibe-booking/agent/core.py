import asyncio
import json
import re
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

_TAG_RE = re.compile(r"<(suggestions|chips)>(.*?)</\1>", re.DOTALL)


def _parse_content_payload(text: str) -> tuple[str, dict | None]:
    """Extract <suggestions> and <chips> blocks from text, return (clean_text, payload)."""
    payload: dict = {}
    clean = text

    for match in _TAG_RE.finditer(text):
        tag, raw = match.group(1), match.group(2).strip()
        try:
            items = json.loads(raw)
            if isinstance(items, list):
                payload[tag] = items
        except (json.JSONDecodeError, ValueError):
            pass
        clean = clean.replace(match.group(0), "")

    return clean.strip(), payload or None


async def _execute_tool(name: str, inp: dict, session: ConversationState) -> dict:
    dispatch = TOOL_DISPATCH.get(name)
    if not dispatch:
        return {"success": False, "error": f"Unknown tool: {name}"}
    method, path = dispatch
    backend = get_backend_client()
    kwargs = {"json": inp} if method == "POST" else {"params": inp}
    return await backend.request(method, path, language=session.preferred_language.lower(), **kwargs)


async def run_agent(session: ConversationState, user_text: str) -> tuple[str, dict | None]:
    """Run agent and return (plain_text, content_payload)."""
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
            raw = next((b.text for b in response.content if b.type == "text"), "")
            text, payload = _parse_content_payload(raw)
            session.messages.append({"role": "assistant", "content": raw})
            return text, payload

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

    return "I'm having trouble processing your request. Please try again.", None


async def run_agent_streaming(
    session: ConversationState, user_text: str,
) -> AsyncIterator[dict]:
    """Stream text chunks, then emit a final event with text and content_payload."""
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
            raw = next((b.text for b in response.content if b.type == "text"), "")
            full_raw = accumulated_text or raw
            if raw and not accumulated_text:
                yield {"type": "agent_stream_chunk", "delta": raw}
            text, payload = _parse_content_payload(full_raw)
            session.messages.append({"role": "assistant", "content": full_raw})
            yield {"type": "final", "text": text, "content_payload": payload}
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

    yield {"type": "final", "text": "I'm having trouble processing your request. Please try again.", "content_payload": None}
