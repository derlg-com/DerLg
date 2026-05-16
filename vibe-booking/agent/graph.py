from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages


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


# Compiled graph (topology reference — execution driven by agent/core.py)
compiled_graph = build_graph().compile()
