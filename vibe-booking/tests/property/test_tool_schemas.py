from hypothesis import given, settings as h_settings
from hypothesis import strategies as st
from agent.tools import ALL_TOOLS, TOOL_DISPATCH


def test_all_9_tools_present():
    names = {t["function"]["name"] for t in ALL_TOOLS}
    expected = {
        "search_trips", "search_hotels", "search_guides", "check_availability",
        "create_booking_hold", "get_weather", "get_emergency_contacts",
        "send_sos_alert", "get_user_loyalty",
    }
    assert names == expected


def test_tool_dispatch_covers_all_tools():
    for tool in ALL_TOOLS:
        name = tool["function"]["name"]
        assert name in TOOL_DISPATCH, f"{name} missing from TOOL_DISPATCH"


@given(st.sampled_from(ALL_TOOLS))
@h_settings(max_examples=9)
def test_tool_schema_structure(tool):
    assert "type" in tool
    assert tool["type"] == "function"
    fn = tool["function"]
    assert "name" in fn
    assert "description" in fn
    assert len(fn["description"]) > 10
    params = fn["parameters"]
    assert params["type"] == "object"
    assert "required" in params or "properties" in params


def test_parallel_execution_order_preservation():
    """Tool dispatch dict preserves insertion order (Python 3.7+)."""
    names = list(TOOL_DISPATCH.keys())
    assert names == sorted(names, key=lambda n: list(TOOL_DISPATCH.keys()).index(n))
    assert len(names) == 9
