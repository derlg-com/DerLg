from pydantic import BaseModel
from typing import Literal, Any


class UserMessage(BaseModel):
    type: Literal["user_message"]
    content: str
    conversation_id: str | None = None


class AgentMessage(BaseModel):
    type: Literal["agent_message"]
    text: str
    content_payload: dict | None = None
    state: str | None = None
    session_id: str | None = None


class ToolCallMessage(BaseModel):
    type: Literal["tool_call"]
    tool: str
    params: dict


class RequiresPaymentMessage(BaseModel):
    type: Literal["requires_payment"]
    booking_id: str
    amount_usd: float
    methods: list[str] = ["stripe", "bakong"]
    hold_expires_at: str | None = None


class PaymentCompletedMessage(BaseModel):
    type: Literal["payment_completed"]
    booking_id: str


class ErrorMessage(BaseModel):
    type: Literal["error"]
    message: str


class PingMessage(BaseModel):
    type: Literal["ping"]


class PongMessage(BaseModel):
    type: Literal["pong"]
    timestamp: str
