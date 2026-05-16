from agent.models.client import ModelClient
from agent.session.state import ConversationState
from config.settings import settings


def get_model_client(session: ConversationState | None = None) -> ModelClient:
    # Khmer always uses NvidiaClient for best language support
    if session and session.preferred_language == "KH":
        from agent.models.nvidia import NvidiaClient
        return NvidiaClient()

    if settings.use_ollama:
        from agent.models.ollama import OllamaClient
        return OllamaClient()

    from agent.models.nvidia import NvidiaClient
    return NvidiaClient()
