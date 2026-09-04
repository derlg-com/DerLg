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

    # ------------------------------------------------------------------
    # Postgres archive bookkeeping
    # ------------------------------------------------------------------
    # `messages` is the LLM's working transcript: it holds `tool` role entries and
    # tool-call scaffolding the archive must not store, and SessionManager.save
    # truncates it to the last _PERSIST_CAP turns. Both facts make a list index
    # useless as a durable ordinal, so archiving is tracked separately.

    #: Monotonic turn counter. Never decreases, never reused, unaffected by the
    #: truncation of `messages`. Becomes `ai_chat_messages.seq`, which is unique
    #: per session and is what makes a retried flush idempotent.
    next_seq: int = 0

    #: Turns enqueued but not yet confirmed persisted. Entries are removed only
    #: after the backend acknowledges them, so a failed flush retries on the next
    #: pass instead of losing the turn.
    pending_archive: list[dict] = []

    #: Highest seq the backend has confirmed. -1 means nothing archived yet.
    #: Diagnostic only; correctness rests on `pending_archive`.
    archived_seq: int = -1

    #: Agent-minted message id -> seq, so a `feedback` frame naming a message can
    #: be resolved to the row that stores it. Capped alongside pending_archive.
    message_seq: dict[str, int] = {}

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
