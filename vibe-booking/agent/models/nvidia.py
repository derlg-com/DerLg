import asyncio
import httpx
from agent.models.client import ModelClient, ModelResponse, ContentBlock
from config.settings import settings
from utils.logging import logger


class NvidiaClient(ModelClient):
    """NVIDIA NIM API client using OpenAI-compatible endpoint."""

    BASE_URL = "https://integrate.api.nvidia.com/v1"
    MODEL = "nvidia/gpt-oss-120b"

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={"Authorization": f"Bearer {settings.nvidia_api_key}"},
            timeout=60.0,
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
            "max_tokens": max_tokens,
        }
        for attempt in range(2):
            try:
                resp = await self._client.post("/chat/completions", json=payload)
                resp.raise_for_status()
                return self._parse(resp.json())
            except Exception as exc:
                if attempt == 1:
                    raise
                logger.warning("nvidia_retry", error=str(exc))
                await asyncio.sleep(1)
        raise RuntimeError("unreachable")

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
        choice = data["choices"][0]
        message = choice["message"]
        finish_reason = choice.get("finish_reason", "stop")
        stop_reason = "tool_use" if finish_reason == "tool_calls" else "end_turn"

        blocks: list[ContentBlock] = []
        if message.get("content"):
            blocks.append(ContentBlock(type="text", text=message["content"]))
        for tc in message.get("tool_calls", []):
            import json
            blocks.append(ContentBlock(
                type="tool_use",
                id=tc["id"],
                name=tc["function"]["name"],
                input=json.loads(tc["function"]["arguments"]),
            ))
        return ModelResponse(stop_reason=stop_reason, content=blocks)

    async def aclose(self) -> None:
        await self._client.aclose()
