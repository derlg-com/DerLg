import asyncio
import json
from typing import AsyncIterator
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


async def _execute_tool_with_status(
    name: str,
    inp: dict,
    tool_use_id: str,
    session: ConversationState,
    status_queue: asyncio.Queue | None,
) -> dict:
    """Execute a tool, optionally pushing start/end status events to a queue."""
    if status_queue is not None:
        await status_queue.put({
            "type": "agent_tool_status",
            "tool_use_id": tool_use_id,
            "name": name,
            "status": "running",
        })
    try:
        result = await _execute_tool(name, inp, session)
        if status_queue is not None:
            await status_queue.put({
                "type": "agent_tool_status",
                "tool_use_id": tool_use_id,
                "name": name,
                "status": "completed" if result.get("success") else "failed",
            })
        return result
    except Exception as exc:
        if status_queue is not None:
            await status_queue.put({
                "type": "agent_tool_status",
                "tool_use_id": tool_use_id,
                "name": name,
                "status": "failed",
                "error": str(exc),
            })
        raise


async def run_agent(session: ConversationState, user_text: str) -> dict:
    """Single-call non-streaming agent run. Used for tests + simple flows."""
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

            if tc.name == "create_booking_hold" and result.get("success"):
                data = result.get("data", {})
                session.booking_id = data.get("booking_id", "")
                session.booking_ref = data.get("reference", "")
                return {
                    "type": "requires_payment",
                    "booking_id": session.booking_id,
                    "amount_usd": data.get("total_price_usd", 0) or data.get("amount_usd", 0),
                    "methods": ["stripe", "bakong"],
                    "hold_expires_at": data.get("hold_expires_at") or data.get("expires_at"),
                }

        session.messages.append({"role": "user", "content": tool_result_msgs})
        messages = session.messages[-MAX_MESSAGES:]

    return {"type": "text", "text": "I'm having trouble processing your request. Please try again."}


async def run_agent_streaming(
    session: ConversationState, user_text: str,
) -> AsyncIterator[dict]:
    """Async iterator yielding WS events as the agent runs.

    Events:
      - {type: 'agent_stream_chunk', delta: str}            — text chunks
      - {type: 'agent_tool_status', tool_use_id, name, status} — tool lifecycle
      - {type: 'requires_payment', ...}                     — payment handoff
      - {type: 'final', payload: <full response>}           — final formatted msg
    """
    session.messages.append({"role": "user", "content": user_text})

    system = build_system_prompt(session)
    client = get_model_client(session)
    messages = session.messages[-MAX_MESSAGES:]
    all_tool_results: list[dict] = []

    for _ in range(MAX_TOOL_LOOPS):
        # Non-streaming model call (NVIDIA streaming wired below if available)
        accumulated_text = ""
        response = None

        if hasattr(client, "stream_message"):
            try:
                async for chunk in client.stream_message(
                    system=system,
                    messages=messages,
                    tools=ALL_TOOLS,
                    max_tokens=MAX_TOKENS,
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
                system=system,
                messages=messages,
                tools=ALL_TOOLS,
                max_tokens=MAX_TOKENS,
            )

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if b.type == "text"), "")
            if text and not accumulated_text:
                # Emit a single chunk so the client can render incrementally
                yield {"type": "agent_stream_chunk", "delta": text}
            session.messages.append({"role": "assistant", "content": text})
            yield {"type": "final", "payload": format_response(text, all_tool_results, session)}
            return

        tool_calls = [b for b in response.content if b.type == "tool_use"]
        if not tool_calls:
            break

        session.messages.append({
            "role": "assistant",
            "content": [{"type": "tool_use", "id": b.id, "name": b.name, "input": b.input} for b in tool_calls],
        })

        # Stream tool status events while executing in parallel
        status_queue: asyncio.Queue = asyncio.Queue()
        tool_tasks = [
            asyncio.create_task(
                _execute_tool_with_status(b.name, b.input, b.id, session, status_queue)
            )
            for b in tool_calls
        ]

        completed = 0
        results: list[dict] = [None] * len(tool_calls)  # type: ignore
        idx_by_id = {b.id: i for i, b in enumerate(tool_calls)}

        async def _await_all() -> list:
            return await asyncio.gather(*tool_tasks, return_exceptions=True)

        gather_task = asyncio.create_task(_await_all())

        while completed < len(tool_calls) or not status_queue.empty():
            try:
                event = await asyncio.wait_for(status_queue.get(), timeout=0.05)
                yield event
                if event.get("status") in ("completed", "failed"):
                    completed += 1
            except asyncio.TimeoutError:
                if gather_task.done():
                    break

        gathered = await gather_task
        for i, r in enumerate(gathered):
            results[i] = r if not isinstance(r, Exception) else {
                "success": False,
                "error": {"code": "TOOL_EXEC_ERROR", "message": str(r)},
            }

        tool_result_msgs = []
        for tc, result in zip(tool_calls, results):
            tool_result_msgs.append({"type": "tool_result", "tool_use_id": tc.id, "content": json.dumps(result)})
            all_tool_results.append({"type": "tool_result", "tool_use_id": tc.id, "content": json.dumps(result)})

            if tc.name == "create_booking_hold" and result.get("success"):
                data = result.get("data", {})
                session.booking_id = data.get("booking_id", "")
                session.booking_ref = data.get("reference", "")
                yield {
                    "type": "requires_payment",
                    "booking_id": session.booking_id,
                    "amount_usd": data.get("total_price_usd", 0) or data.get("amount_usd", 0),
                    "methods": ["stripe", "bakong"],
                    "hold_expires_at": data.get("hold_expires_at") or data.get("expires_at"),
                }
                return

        session.messages.append({"role": "user", "content": tool_result_msgs})
        messages = session.messages[-MAX_MESSAGES:]

    yield {"type": "final", "payload": {"type": "text", "text": "I'm having trouble processing your request. Please try again."}}
