from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator


class ConversationState(BaseModel):
    session_id: str
    user_id: str = ""
    is_authenticated: bool = False
    messages: list[dict] = []
    preferred_language: str = "EN"
    last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("preferred_language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in ("EN", "KH", "ZH"):
            raise ValueError("preferred_language must be EN, KH, or ZH")
        return v

    def to_json(self) -> str:
        return self.model_dump_json()

    @classmethod
    def from_json(cls, data: str) -> "ConversationState":
        return cls.model_validate_json(data)
