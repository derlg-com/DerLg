from typing import TypedDict, Annotated, Optional
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from utils.logging import logger


class GraphState(TypedDict):
    messages: Annotated[list, add_messages]
    stop_reason: str
    tool_calls: list
    tool_results: list
    formatted_response: dict


def _route_after_llm(state: GraphState) -> str:
    return "execute_tools" if state.get("stop_reason") == "tool_use" else "format_response"


def build_graph() -> StateGraph:
    graph = StateGraph(GraphState)

    # Nodes are thin wrappers — actual logic lives in agent/core.py
    # The graph defines the topology; run_agent() drives execution directly
    # for simplicity and to avoid duplicating session state management.
    graph.add_node("call_llm", lambda s: s)
    graph.add_node("execute_tools", lambda s: s)
    graph.add_node("format_response", lambda s: s)

    graph.set_entry_point("call_llm")
    graph.add_conditional_edges("call_llm", _route_after_llm, {
        "execute_tools": "execute_tools",
        "format_response": "format_response",
    })
    graph.add_edge("execute_tools", "call_llm")
    graph.add_edge("format_response", END)

    return graph


def _build_checkpointer():
    """Try to construct a RedisSaver. Falls back to None (in-memory) if
    `langgraph-checkpoint-redis` is not installed or REDIS_URL is unset.
    """
    try:
        from langgraph.checkpoint.redis import RedisSaver  # type: ignore
    except ImportError:
        try:
            from langgraph_checkpoint_redis import RedisSaver  # type: ignore
        except ImportError:
            logger.info("redis_saver_not_installed_using_in_memory_checkpoint")
            return None

    import os
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        logger.info("redis_url_unset_using_in_memory_checkpoint")
        return None

    try:
        return RedisSaver.from_conn_string(redis_url)
    except Exception as exc:
        logger.warning("redis_saver_init_failed", error=str(exc))
        return None


_checkpointer = _build_checkpointer()
compiled_graph = (
    build_graph().compile(checkpointer=_checkpointer)
    if _checkpointer is not None
    else build_graph().compile()
)
