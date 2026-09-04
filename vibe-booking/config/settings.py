import math
from collections import Counter

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


def _shannon_entropy(v: str) -> float:
    counts = Counter(v)
    return -sum((n / len(v)) * math.log2(n / len(v)) for n in counts.values())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # LLM Gateway configuration (RayuCode / any OpenAI-compatible provider)
    llm_api_key: str = ""
    llm_base_url: str = "https://gateway.rayucode.com/v1"
    model_llm: str = "longcat-2.0"
    model_timeout_s: float = 90.0

    # Provider aliases for backward compatibility
    rayu_api_key: str = ""
    rayu_base_url: str = ""
    nvidia_api_key: str = ""
    nvidia_base_url: str = ""

    @property
    def effective_api_key(self) -> str:
        for k in (self.llm_api_key, self.rayu_api_key, self.nvidia_api_key):
            if isinstance(k, str) and k:
                return k
        return ""

    @property
    def effective_base_url(self) -> str:
        for url in (self.llm_base_url, self.rayu_base_url, self.nvidia_base_url):
            if isinstance(url, str) and url:
                return url
        return "https://gateway.rayucode.com/v1"

    @property
    def effective_model(self) -> str:
        # Gateway model identifier for longcat 2.0 release is 'longcat-2'
        if self.model_llm in ("longcat-2.0", "longcat-2"):
            return "longcat-2"
        return self.model_llm

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
