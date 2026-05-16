"""
LangGraph node implementations and state machine.
Nodes drive the agent loop; actual execution is in agent/core.py.
"""
import asyncio
import json
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from agent.models.factory import get_model_client
from agent.tools import ALL_TOOLS, TOOL_DISPATCH
from agent.prompts.builder import build_system_prompt
from agent.formatters.formatter import format_response
from agent.backend_client import get_backend_client
from utils.logging import logger

MAX_TOOL_LOOPS = 5


class AgentGraphState(TypedDict):
    messages: Annotated[list, add_messages]
    stop_reason: str
    tool_results: list
    formatted_response: dict
    loop_count: int
    session: object  # ConversationState passed through


async def call_llm(state: AgentGraphState) -> dict:
    session = state["session"]
    client = get_model_client(session)
    system = build_system_prompt(session)
    messages = state["messages"][-20:]

    response = await client.create_message(
        system=system,
        messages=messages,
        tools=ALL_TOOLS,
        max_tokens=2048,
    )
    return {"stop_reason": response.stop_reason, "messages": [
        {"role": "assistant", "content": [
            {"type": b.type, "id": b.id, "name": b.name, "input": b.input}
            if b.type == "tool_use" else {"type": "text", "text": b.text}
            for b in response.content
        ]}
    ]}


async def execute_tools(state: AgentGraphState) -> dict:
    session = state["session"]
    loop_count = state.get("loop_count", 0) + 1

    if loop_count > MAX_TOOL_LOOPS:
        return {
            "loop_count": loop_count,
            "stop_reason": "end_turn",
            "messages": [{"role": "user", "content": [{"type": "tool_result", "tool_use_id": "x", "content": "Max tool iterations reached."}]}],
        }

    last_msg = state["messages"][-1]
    tool_calls = [b for b in (last_msg.get("content") or []) if isinstance(b, dict) and b.get("type") == "tool_use"]

    backend = get_backend_client()
    language = getattr(session, "preferred_language", "en").lower()

    async def _call_one(tc: dict) -> dict:
        name = tc["name"]
        inp = tc.get("input", {})
        dispatch = TOOL_DISPATCH.get(name)
        if not dispatch:
            result = {"success": False, "error": {"code": "UNKNOWN_TOOL", "message": f"Unknown tool: {name}"}}
        else:
            method, path = dispatch
            kwargs = {"json": inp} if method == "POST" else {"params": inp}
            result = await backend.request(method, path, language=language, **kwargs)
        return {"type": "tool_result", "tool_use_id": tc["id"], "content": json.dumps(result)}

    results = await asyncio.gather(*[_call_one(tc) for tc in tool_calls], return_exceptions=True)
    tool_results = []
    for tc, r in zip(tool_calls, results):
        if isinstance(r, Exception):
            r = {"type": "tool_result", "tool_use_id": tc["id"], "content": json.dumps({"success": False, "error": str(r)})}
        tool_results.append(r)

    return {
        "loop_count": loop_count,
        "tool_results": tool_results,
        "messages": [{"role": "user", "content": tool_results}],
    }


async def format_response_node(state: AgentGraphState) -> dict:
    session = state["session"]
    messages = state["messages"]
    tool_results = state.get("tool_results", [])

    ai_text = ""
    for msg in reversed(messages):
        content = msg.get("content", [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    ai_text = block["text"]
                    break
        elif isinstance(content, str):
            ai_text = content
            break
        if ai_text:
            break

    formatted = format_response(ai_text, tool_results, session)
    return {"formatted_response": formatted}


def _route(state: AgentGraphState) -> str:
    return "execute_tools" if state.get("stop_reason") == "tool_use" else "format_response"


def build_graph() -> StateGraph:
    graph = StateGraph(AgentGraphState)
    graph.add_node("call_llm", call_llm)
    graph.add_node("execute_tools", execute_tools)
    graph.add_node("format_response", format_response_node)
    graph.set_entry_point("call_llm")
    graph.add_conditional_edges("call_llm", _route, {
        "execute_tools": "execute_tools",
        "format_response": "format_response",
    })
    graph.add_edge("execute_tools", "call_llm")
    graph.add_edge("format_response", END)
    return graph


def compile_graph(redis_url: str | None = None):
    """Compile graph with optional RedisSaver checkpointer."""
    graph = build_graph()
    if redis_url:
        try:
            from langgraph.checkpoint.redis import RedisSaver
            checkpointer = RedisSaver.from_conn_string(redis_url)
            return graph.compile(checkpointer=checkpointer)
        except Exception as exc:
            logger.warning("redis_saver_unavailable", error=str(exc))
    return graph.compile()
