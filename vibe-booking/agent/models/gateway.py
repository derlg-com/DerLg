import asyncio
import json
import time
import httpx
from agent.models.client import ModelClient, ModelResponse, ContentBlock
from config.settings import settings
from utils.logging import logger

# Retry config for transient failures (e.g. 429 rate limits, 5xx gateway errors).
_MAX_ATTEMPTS = 2
_BASE_BACKOFF = 1.0  # seconds; exponential, capped


def _retry_delay(exc: Exception, attempt: int) -> float | None:
    """Return seconds to wait before retrying a transient error, or None if the
    error is not retryable. Honors the server's Retry-After header on 429."""
    if isinstance(exc, (httpx.TimeoutException, httpx.TransportError)):
        return min(_BASE_BACKOFF * (2 ** attempt), 10.0)
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429 or status >= 500:
            retry_after = exc.response.headers.get("retry-after")
            if retry_after:
                try:
                    return min(float(retry_after), 15.0)
                except ValueError:
                    pass
            return min(_BASE_BACKOFF * (2 ** attempt), 10.0)
    return None


class GatewayClient(ModelClient):
    """OpenAI-compatible LLM Gateway client (RayuCode and standard OpenAI-compatible endpoints)."""

    def __init__(self) -> None:
        # Safely resolve base_url
        base_url = "https://gateway.rayucode.com/v1"
        for attr in ("llm_base_url", "rayu_base_url", "nvidia_base_url"):
            val = getattr(settings, attr, None)
            if isinstance(val, str) and val:
                base_url = val
                break

        # Safely resolve api_key
        api_key = ""
        for attr in ("llm_api_key", "rayu_api_key", "nvidia_api_key"):
            val = getattr(settings, attr, None)
            if isinstance(val, str) and val:
                api_key = val
                break

        # Safely resolve model
        model = "longcat-2"
        model_val = getattr(settings, "model_llm", None)
        if isinstance(model_val, str) and model_val:
            model = "longcat-2" if model_val in ("longcat-2.0", "longcat-2") else model_val

        timeout = getattr(settings, "model_timeout_s", 90.0)
        timeout_val = timeout if isinstance(timeout, (int, float)) else 90.0

        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_val,
        )
        self._model = model

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
            "tool_choice": "auto",
            "max_tokens": max_tokens,
        }
        for attempt in range(_MAX_ATTEMPTS):
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
                delay = _retry_delay(exc, attempt)
                if delay is None or attempt == _MAX_ATTEMPTS - 1:
                    raise
                logger.warning("llm_retry", attempt=attempt, retry_in=round(delay, 2), error=str(exc))
                await asyncio.sleep(delay)
        raise RuntimeError("unreachable")

    def _convert_tools(self, tools: list[dict]) -> list[dict]:
        return tools

    def _convert_messages(self, messages: list[dict]) -> list[dict]:
        """Convert internal tool messages to OpenAI chat format."""
        result: list[dict] = []
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, str):
                result.append(msg)
                continue
            if not isinstance(content, list):
                result.append(msg)
                continue

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

            elif msg.get("role") == "user" and content and content[0].get("type") == "tool_result":
                for block in content:
                    if block.get("type") == "tool_result":
                        result.append({
                            "role": "tool",
                            "tool_call_id": block["tool_use_id"],
                            "content": block.get("content", ""),
                        })
            else:
                result.append({"role": msg.get("role", "user"), "content": json.dumps(content)})
        return result

    def _parse(self, data: dict) -> ModelResponse:
        choices = data.get("choices") or []
        if not choices:
            raise ValueError("model returned no choices")
        choice = choices[0]
        message = choice["message"]
        finish_reason = choice.get("finish_reason", "stop")
        tool_calls_raw = message.get("tool_calls", [])
        stop_reason = "tool_use" if (finish_reason == "tool_calls" or tool_calls_raw) else "end_turn"

        blocks: list[ContentBlock] = []
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
            "tool_choice": "auto",
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

                choices = chunk.get("choices") or []
                if not choices:
                    continue
                choice = choices[0]
                finish_reason = choice.get("finish_reason") or finish_reason
                delta = choice.get("delta", {})

                reasoning_delta = delta.get("reasoning_content") or delta.get("reasoning") or ""
                if reasoning_delta:
                    yield {"reasoning": reasoning_delta}

                text_delta = delta.get("content") or ""
                if text_delta:
                    accumulated_text += text_delta
                    yield {"delta": text_delta}

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

        stop_reason = "tool_use" if (finish_reason == "tool_calls" or accumulated_tool_calls) else "end_turn"
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


# Backward compatibility alias
NvidiaClient = GatewayClient
