import asyncio
import json
import time
import httpx
from agent.models.client import ModelClient, ModelResponse, ContentBlock
from config.settings import settings
from utils.logging import logger


class NvidiaClient(ModelClient):
    """NVIDIA NIM API client (OpenAI-compatible endpoint)."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.nvidia_base_url,
            headers={"Authorization": f"Bearer {settings.nvidia_api_key}"},
            timeout=60.0,
        )
        self._model = settings.model_llm

    async def create_message(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 2048,
    ) -> ModelResponse:
        payload = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, *self._convert_messages(messages)],
            "tools": self._convert_tools(tools),
            "max_tokens": max_tokens,
        }
        for attempt in range(2):
            try:
                t0 = time.monotonic()
                resp = await self._client.post("/chat/completions", json=payload)
                resp.raise_for_status()
                data = resp.json()
                usage = data.get("usage", {})
                logger.info(
                    "llm_call",
                    model=self._model,
                    prompt_tokens=usage.get("prompt_tokens"),
                    completion_tokens=usage.get("completion_tokens"),
                    latency_ms=round((time.monotonic() - t0) * 1000),
                )
                return self._parse(data)
            except Exception as exc:
                if attempt == 1:
                    raise
                logger.warning("nvidia_retry", error=str(exc))
                await asyncio.sleep(1)
        raise RuntimeError("unreachable")

    def _convert_tools(self, tools: list[dict]) -> list[dict]:
        # ALL_TOOLS entries are already in OpenAI function format:
        # {"type": "function", "function": {"name": ..., "description": ..., "parameters": ...}}
        return tools

    def _convert_messages(self, messages: list[dict]) -> list[dict]:
        """Convert internal Anthropic-style tool messages to OpenAI chat format.

        Internal format from core.py:
          assistant: {"role": "assistant", "content": [{"type": "tool_use", "id": ..., "name": ..., "input": ...}]}
          user:      {"role": "user", "content": [{"type": "tool_result", "tool_use_id": ..., "content": ...}]}

        OpenAI format:
          assistant: {"role": "assistant", "tool_calls": [{"id": ..., "type": "function", "function": {"name": ..., "arguments": ...}}]}
          tool:      {"role": "tool", "tool_call_id": ..., "content": ...}
        """
        result: list[dict] = []
        for msg in messages:
            content = msg.get("content")
            # Plain text messages pass through
            if isinstance(content, str):
                result.append(msg)
                continue
            if not isinstance(content, list):
                result.append(msg)
                continue

            # Check if this is an assistant message with tool_use blocks
            if msg.get("role") == "assistant" and content and content[0].get("type") == "tool_use":
                tool_calls = []
                text_parts = []
                for block in content:
                    if block.get("type") == "tool_use":
                        tool_calls.append({
                            "id": block["id"],
                            "type": "function",
                            "function": {
                                "name": block["name"],
                                "arguments": json.dumps(block.get("input", {})),
                            },
                        })
                    elif block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                assistant_msg: dict = {"role": "assistant", "tool_calls": tool_calls}
                if text_parts:
                    assistant_msg["content"] = "\n".join(text_parts)
                else:
                    assistant_msg["content"] = None
                result.append(assistant_msg)

            # Check if this is a user message with tool_result blocks
            elif msg.get("role") == "user" and content and content[0].get("type") == "tool_result":
                for block in content:
                    if block.get("type") == "tool_result":
                        result.append({
                            "role": "tool",
                            "tool_call_id": block["tool_use_id"],
                            "content": block.get("content", ""),
                        })
            else:
                # Mixed content or unknown — pass as-is with stringified content
                result.append({"role": msg.get("role", "user"), "content": json.dumps(content)})
        return result

    def _parse(self, data: dict) -> ModelResponse:
        choice = data["choices"][0]
        message = choice["message"]
        finish_reason = choice.get("finish_reason", "stop")
        stop_reason = "tool_use" if finish_reason == "tool_calls" else "end_turn"

        blocks: list[ContentBlock] = []
        # Some reasoning models return content in reasoning_content when content is null
        text = message.get("content") or message.get("reasoning_content") or message.get("reasoning") or ""
        if text:
            blocks.append(ContentBlock(type="text", text=text))
        for tc in message.get("tool_calls", []):
            blocks.append(ContentBlock(
                type="tool_use",
                id=tc["id"],
                name=tc["function"]["name"],
                input=json.loads(tc["function"]["arguments"]),
            ))
        return ModelResponse(stop_reason=stop_reason, content=blocks)

    async def stream_message(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 2048,
    ):
        """Yield {delta: str} chunks, then {final: ModelResponse} at the end."""
        payload = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, *self._convert_messages(messages)],
            "tools": self._convert_tools(tools),
            "max_tokens": max_tokens,
            "stream": True,
        }
        accumulated_text = ""
        accumulated_tool_calls: dict[int, dict] = {}
        finish_reason = "stop"

        async with self._client.stream("POST", "/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:]
                if raw == "[DONE]":
                    break
                try:
                    chunk = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                choice = chunk.get("choices", [{}])[0]
                finish_reason = choice.get("finish_reason") or finish_reason
                delta = choice.get("delta", {})

                # Text delta
                text_delta = delta.get("content") or ""
                if text_delta:
                    accumulated_text += text_delta
                    yield {"delta": text_delta}

                # Tool call deltas — accumulate by index
                for tc in delta.get("tool_calls", []):
                    idx = tc.get("index", 0)
                    if idx not in accumulated_tool_calls:
                        accumulated_tool_calls[idx] = {"id": "", "name": "", "arguments": ""}
                    if tc.get("id"):
                        accumulated_tool_calls[idx]["id"] = tc["id"]
                    fn = tc.get("function", {})
                    if fn.get("name"):
                        accumulated_tool_calls[idx]["name"] = fn["name"]
                    if fn.get("arguments"):
                        accumulated_tool_calls[idx]["arguments"] += fn["arguments"]

        # Build final ModelResponse
        stop_reason = "tool_use" if finish_reason == "tool_calls" else "end_turn"
        blocks: list[ContentBlock] = []
        if accumulated_text:
            blocks.append(ContentBlock(type="text", text=accumulated_text))
        for tc in accumulated_tool_calls.values():
            try:
                inp = json.loads(tc["arguments"]) if tc["arguments"] else {}
            except json.JSONDecodeError:
                inp = {}
            blocks.append(ContentBlock(type="tool_use", id=tc["id"], name=tc["name"], input=inp))

        yield {"final": ModelResponse(stop_reason=stop_reason, content=blocks)}

    async def aclose(self) -> None:
        await self._client.aclose()
