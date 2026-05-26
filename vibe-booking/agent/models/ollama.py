import json
import httpx
from agent.models.client import ModelClient, ModelResponse, ContentBlock
from config.settings import settings
from utils.logging import logger


class OllamaClient(ModelClient):
    """Ollama local model client (OpenAI-compatible API)."""

    MODEL = "llama3.1:8b"

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.ollama_base_url,
            timeout=120.0,
        )

    async def create_message(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 2048,
    ) -> ModelResponse:
        payload = {
            "model": self.MODEL,
            "messages": [{"role": "system", "content": system}, *messages],
            "tools": self._convert_tools(tools),
            "options": {"num_predict": max_tokens},
            "stream": False,
        }
        resp = await self._client.post("/api/chat", json=payload)
        resp.raise_for_status()
        return self._parse(resp.json())

    def _convert_tools(self, tools: list[dict]) -> list[dict]:
        return [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("input_schema", {}),
                },
            }
            for t in tools
        ]

    def _parse(self, data: dict) -> ModelResponse:
        message = data.get("message", {})
        tool_calls = message.get("tool_calls", [])
        stop_reason = "tool_use" if tool_calls else "end_turn"

        blocks: list[ContentBlock] = []
        if message.get("content"):
            blocks.append(ContentBlock(type="text", text=message["content"]))
        for tc in tool_calls:
            fn = tc.get("function", {})
            args = fn.get("arguments", {})
            if isinstance(args, str):
                args = json.loads(args)
            blocks.append(ContentBlock(
                type="tool_use",
                id=tc.get("id", ""),
                name=fn.get("name", ""),
                input=args,
            ))
        return ModelResponse(stop_reason=stop_reason, content=blocks)

    async def aclose(self) -> None:
        await self._client.aclose()
