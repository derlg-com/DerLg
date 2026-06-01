import math
from collections import Counter

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


def _shannon_entropy(v: str) -> float:
    counts = Counter(v)
    return -sum((n / len(v)) * math.log2(n / len(v)) for n in counts.values())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # NVIDIA NIM
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    model_llm: str = "openai/gpt-oss-120b"

    # Ollama fallback
    ollama_base_url: str = "http://localhost:11434"
    use_ollama: bool = False  # set USE_OLLAMA=true to switch

    # Services
    backend_url: str
    ai_service_key: str
    redis_url: str

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    sentry_dsn: str = ""
    jwt_secret: str = ""  # must equal backend JWT_ACCESS_SECRET; if empty, JWT auth is refused
    # Comma-separated origins allowed to open the chat WebSocket (CSWSH guard).
    allowed_ws_origins: str = "https://derlg.com,https://www.derlg.com,http://localhost:3000"

    @field_validator("ai_service_key")
    @classmethod
    def validate_service_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("AI_SERVICE_KEY must be at least 32 characters")
        if "dev-service-key" in v or "must-be-at-least" in v:
            raise ValueError("AI_SERVICE_KEY looks like a placeholder; use a random secret")
        if _shannon_entropy(v) < 3.5:
            raise ValueError("AI_SERVICE_KEY has insufficient entropy; use a random secret")
        return v


settings = Settings()
