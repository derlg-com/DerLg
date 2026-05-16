import pytest
from hypothesis import given, settings as h_settings
from hypothesis import strategies as st
from agent.tools.schemas import TOOL_SCHEMAS


def test_all_tools_have_required_fields():
    for schema in TOOL_SCHEMAS:
        assert "name" in schema
        assert "description" in schema
        assert "input_schema" in schema
        assert schema["input_schema"]["type"] == "object"
        assert "properties" in schema["input_schema"]


@given(st.sampled_from(TOOL_SCHEMAS))
@h_settings(max_examples=20)
def test_tool_schema_structure(schema):
    assert isinstance(schema["name"], str)
    assert len(schema["name"]) > 0
    assert isinstance(schema["description"], str)
    assert len(schema["description"]) > 10
    assert "required" in schema["input_schema"] or "properties" in schema["input_schema"]


def test_tool_count():
    assert len(TOOL_SCHEMAS) == 20
