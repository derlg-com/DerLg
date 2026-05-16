from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    model_backend: Literal["nvidia", "ollama"] = "nvidia"
    nvidia_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    backend_url: str
    ai_service_key: str
    redis_url: str
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    sentry_dsn: str = ""

    @field_validator("ai_service_key")
    @classmethod
    def validate_service_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("AI_SERVICE_KEY must be at least 32 characters")
        return v

    @field_validator("nvidia_api_key")
    @classmethod
    def validate_nvidia_key(cls, v: str, info) -> str:
        # Validated at startup in main.py after full model is built
        return v


settings = Settings()
