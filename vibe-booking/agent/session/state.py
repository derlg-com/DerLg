from enum import Enum
from datetime import datetime
from typing import Optional
import json
from pydantic import BaseModel, field_validator


class AgentState(str, Enum):
    DISCOVERY = "DISCOVERY"
    SUGGESTION = "SUGGESTION"
    EXPLORATION = "EXPLORATION"
    CUSTOMIZATION = "CUSTOMIZATION"
    BOOKING = "BOOKING"
    PAYMENT = "PAYMENT"
    POST_BOOKING = "POST_BOOKING"


class ConversationState(BaseModel):
    session_id: str
    user_id: str = ""
    state: AgentState = AgentState.DISCOVERY
    messages: list[dict] = []
    preferred_language: str = "EN"
    suggested_trip_ids: list[str] = []
    selected_trip_id: str = ""
    selected_trip_name: str = ""
    booking_id: str = ""
    booking_ref: str = ""
    reserved_until: Optional[datetime] = None
    payment_intent_id: str = ""
    payment_status: str = ""
    last_active: datetime = datetime.utcnow()
    created_at: datetime = datetime.utcnow()

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
