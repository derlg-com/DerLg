from agent.models.client import ModelClient
from agent.session.state import ConversationState
from config.settings import settings

# Module-level singletons — created once on first use, reused for all requests
_nvidia_client: ModelClient | None = None
_ollama_client: ModelClient | None = None


def get_model_client(session: ConversationState | None = None) -> ModelClient:
    global _nvidia_client, _ollama_client

    # Khmer always uses NvidiaClient for best language support
    use_nvidia = (session and session.preferred_language == "KH") or not settings.use_ollama

    if use_nvidia:
        if _nvidia_client is None:
            from agent.models.nvidia import NvidiaClient
            _nvidia_client = NvidiaClient()
        return _nvidia_client

    if _ollama_client is None:
        from agent.models.ollama import OllamaClient
        _ollama_client = OllamaClient()
    return _ollama_client


def reset_clients() -> None:
    """Reset singletons — used in tests."""
    global _nvidia_client, _ollama_client
    _nvidia_client = None
    _ollama_client = None
