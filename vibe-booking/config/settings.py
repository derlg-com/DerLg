from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


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
    jwt_secret: str = ""  # optional; if empty, JWT is decoded without verification (dev only)

    @field_validator("ai_service_key")
    @classmethod
    def validate_service_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("AI_SERVICE_KEY must be at least 32 characters")
        return v


settings = Settings()
