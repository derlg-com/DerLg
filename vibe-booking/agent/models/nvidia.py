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
            "messages": [{"role": "system", "content": system}, *messages],
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
            blocks.append(ContentBlock(
                type="tool_use",
                id=tc["id"],
                name=tc["function"]["name"],
                input=json.loads(tc["function"]["arguments"]),
            ))
        return ModelResponse(stop_reason=stop_reason, content=blocks)

    async def aclose(self) -> None:
        await self._client.aclose()
