from hypothesis import given, settings as h_settings
from hypothesis import strategies as st
from agent.tools import ALL_TOOLS


def test_all_tools_have_required_fields():
    for tool in ALL_TOOLS:
        fn = tool["function"]
        assert "name" in fn
        assert "description" in fn
        params = fn["parameters"]
        assert params["type"] == "object"
        assert "properties" in params


@given(st.sampled_from(ALL_TOOLS))
@h_settings(max_examples=12)
def test_tool_schema_structure(tool):
    fn = tool["function"]
    assert isinstance(fn["name"], str)
    assert len(fn["name"]) > 0
    assert isinstance(fn["description"], str)
    assert len(fn["description"]) > 10
