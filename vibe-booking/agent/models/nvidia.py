"""Backward compatibility module for legacy imports.

The primary LLM client is now GatewayClient in agent.models.gateway.
"""
import httpx
from config.settings import settings
from agent.models.gateway import (
    GatewayClient,
    _retry_delay,
    _MAX_ATTEMPTS,
    ModelResponse,
    ContentBlock,
)


class NvidiaClient(GatewayClient):
    """Legacy alias for GatewayClient, supporting legacy mocks."""

    def __init__(self) -> None:
        import sys

        nvidia_mod = sys.modules.get("agent.models.nvidia")
        active_settings = getattr(nvidia_mod, "settings", settings) if nvidia_mod else settings

        # Safely resolve base_url
        base_url = "https://gateway.rayucode.com/v1"
        for attr in ("llm_base_url", "rayu_base_url", "nvidia_base_url"):
            val = getattr(active_settings, attr, None)
            if isinstance(val, str) and val:
                base_url = val
                break

        # Safely resolve api_key
        api_key = ""
        for attr in ("llm_api_key", "rayu_api_key", "nvidia_api_key"):
            val = getattr(active_settings, attr, None)
            if isinstance(val, str) and val:
                api_key = val
                break

        # Safely resolve model
        model = "longcat-2"
        model_val = getattr(active_settings, "model_llm", None)
        if isinstance(model_val, str) and model_val:
            model = "longcat-2" if model_val in ("longcat-2.0", "longcat-2") else model_val

        timeout = getattr(active_settings, "model_timeout_s", 90.0)
        timeout_val = timeout if isinstance(timeout, (int, float)) else 90.0

        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_val,
        )
        self._model = model
