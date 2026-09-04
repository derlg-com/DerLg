from agent.models.client import ModelClient
from agent.session.state import ConversationState
from config.settings import settings

# Module-level singletons — created once on first use, reused for all requests
_gateway_client: ModelClient | None = None
_nvidia_client: ModelClient | None = None  # kept for legacy test patch compatibility
_ollama_client: ModelClient | None = None


def get_model_client(session: ConversationState | None = None) -> ModelClient:
    global _gateway_client, _nvidia_client, _ollama_client

    # Remote cloud gateway handles Khmer and all primary traffic
    use_gateway = (session and session.preferred_language == "KH") or not settings.use_ollama

    if use_gateway:
        # Check if legacy test patched _nvidia_client
        if _nvidia_client is not None:
            return _nvidia_client

        if _gateway_client is None:
            from agent.models.nvidia import NvidiaClient
            _gateway_client = NvidiaClient()
            _nvidia_client = _gateway_client
        return _gateway_client

    if _ollama_client is None:
        from agent.models.ollama import OllamaClient
        _ollama_client = OllamaClient()
    return _ollama_client


def reset_clients() -> None:
    """Reset singletons — used in tests."""
    global _gateway_client, _nvidia_client, _ollama_client
    _gateway_client = None
    _nvidia_client = None
    _ollama_client = None
