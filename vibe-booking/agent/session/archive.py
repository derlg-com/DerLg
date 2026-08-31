"""Postgres archive for chat transcripts.

The live conversation lives in Redis under `session:{id}` with a 7-day TTL and a
60-turn cap, so without this module no transcript survives and every admin AI
metric reads zero.

Writes go through the backend's `/v1/ai-tools/chat-sessions*` endpoints, never
straight to Postgres: the AI service has no database credentials by design.
Every call here is best-effort. Failures are logged and left queued for the next
flush; they never raise into the WebSocket handler, because losing an archive
write must never break a live conversation.
"""

from typing import Any, Optional

from agent.backend_client import get_backend_client
from agent.session.state import ConversationState
from utils.logging import logger

#: Turns between flushes. Small enough that a crashed process loses little, large
#: enough that a chat does not issue an HTTP round trip per message.
FLUSH_EVERY = 4

#: Ceiling on the unflushed queue, matching `ArrayMaxSize(60)` on the backend's
#: AppendChatMessagesDto. Reached only after a sustained backend outage (the
#: circuit breaker opens after 5 failures with a 60s cooldown); beyond it the
#: oldest turns are dropped so a long outage cannot grow the session unboundedly.
MAX_PENDING = 60

#: The agent's payload types are richer than the `ai_chat_messages.message_type`
#: column allows, so they are collapsed to the persisted set. The precise payload
#: types are preserved in `metadata.payload_types` so nothing is actually lost.
_PAYLOAD_TYPE_MAP = {
    "trip_cards": "trip_card",
    "comparison": "trip_card",
    "hotel_cards": "hotel_card",
    "guide_cards": "hotel_card",
    "transport_cards": "hotel_card",
    "payment_qr": "qr",
    "qr": "qr",
    "booking_summary": "action",
    "action": "action",
}

_ALLOWED_ROLES = ("user", "assistant", "system")


def _message_type_for(payloads: Optional[list[dict]]) -> str:
    """Collapse the first recognised payload type to a persisted message_type."""
    if not payloads:
        return "text"
    for payload in payloads:
        mapped = _PAYLOAD_TYPE_MAP.get(str(payload.get("type", "")))
        if mapped:
            return mapped
    return "text"


def enqueue(
    session: ConversationState,
    role: str,
    content: str,
    *,
    payloads: Optional[list[dict]] = None,
    message_id: Optional[str] = None,
    extra_metadata: Optional[dict[str, Any]] = None,
) -> Optional[int]:
    """Queue one turn for archiving and return the seq it was assigned.

    Only `user`, `assistant` and `system` turns are archivable — the backend DTO
    rejects anything else, and the `tool` entries the agent keeps in
    `session.messages` are LLM scaffolding rather than conversation.
    """
    if role not in _ALLOWED_ROLES:
        return None

    text = (content or "").strip()
    if not text:
        return None

    seq = session.next_seq
    session.next_seq += 1

    metadata: dict[str, Any] = dict(extra_metadata or {})
    if message_id:
        metadata["message_id"] = message_id
        session.message_seq[message_id] = seq
    if payloads:
        metadata["payload_types"] = [
            str(p.get("type", "")) for p in payloads if p.get("type")
        ]

    session.pending_archive.append({
        "seq": seq,
        "role": role,
        # The backend caps content at 8000 chars; truncate here so a long reply
        # cannot make the whole batch fail validation.
        "content": text[:8000],
        "message_type": _message_type_for(payloads),
        "metadata": metadata or None,
    })

    if len(session.pending_archive) > MAX_PENDING:
        dropped = len(session.pending_archive) - MAX_PENDING
        session.pending_archive = session.pending_archive[-MAX_PENDING:]
        logger.warning(
            "chat_archive_queue_overflow",
            session_id=session.session_id,
            dropped=dropped,
            reason="backend unreachable for an extended period",
        )

    return seq


def should_flush(session: ConversationState) -> bool:
    """True once enough turns have queued to justify a round trip."""
    return len(session.pending_archive) >= FLUSH_EVERY


async def create_session(session: ConversationState) -> bool:
    """Upsert the session row. Idempotent — safe on every reconnect."""
    body: dict[str, Any] = {
        "session_id": session.session_id,
        "language": session.preferred_language.lower().replace("kh", "km"),
    }
    if session.is_authenticated and session.user_id:
        body["user_id"] = session.user_id
    else:
        # Guests have no user row; the handle keeps the transcript identifiable
        # and lets it be stitched to a user who signs in mid-chat.
        body["guest_key"] = session.user_id or f"anon:{session.session_id}"

    resp = await get_backend_client().request(
        "POST", "ai-tools/chat-sessions", json=body
    )
    if not resp.get("success"):
        logger.warning(
            "chat_archive_session_create_failed",
            session_id=session.session_id,
            error=resp.get("error"),
        )
        return False
    return True


async def rebind_user(session: ConversationState) -> bool:
    """Attach an already-archived guest session to a now-authenticated user."""
    if not session.is_authenticated or not session.user_id:
        return False

    resp = await get_backend_client().request(
        "PATCH",
        f"ai-tools/chat-sessions/{session.session_id}",
        json={"user_id": session.user_id},
    )
    if not resp.get("success"):
        logger.warning(
            "chat_archive_rebind_failed",
            session_id=session.session_id,
            error=resp.get("error"),
        )
        return False
    logger.info("chat_archive_rebound", session_id=session.session_id)
    return True


async def flush(session: ConversationState) -> bool:
    """Send queued turns to the archive.

    The queue is cleared only on success. A failure leaves it intact so the next
    flush retries; the backend's [session_id, seq] unique index absorbs the
    resulting duplicates, so a retry can never double-write a turn.
    """
    if not session.pending_archive:
        return True

    batch = list(session.pending_archive)
    resp = await get_backend_client().request(
        "POST",
        f"ai-tools/chat-sessions/{session.session_id}/messages",
        json={"messages": batch},
    )

    if not resp.get("success"):
        logger.warning(
            "chat_archive_flush_failed",
            session_id=session.session_id,
            queued=len(batch),
            error=resp.get("error"),
        )
        return False

    flushed_seqs = {entry["seq"] for entry in batch}
    session.pending_archive = [
        entry
        for entry in session.pending_archive
        if entry["seq"] not in flushed_seqs
    ]
    session.archived_seq = max(session.archived_seq, max(flushed_seqs))

    data = resp.get("data") or {}
    logger.info(
        "chat_archive_flushed",
        session_id=session.session_id,
        sent=len(batch),
        inserted=data.get("inserted"),
        archived_seq=session.archived_seq,
    )
    return True


async def record_feedback(
    session: ConversationState, message_id: str, helpful: bool
) -> bool:
    """Persist a thumbs up/down against the turn `message_id` identifies.

    Unknown ids are dropped: the transcript is capped, so feedback on a turn that
    has aged out of `message_seq` has nowhere to land and is not an error.
    """
    seq = session.message_seq.get(message_id)
    if seq is None:
        logger.info(
            "chat_feedback_unresolved",
            session_id=session.session_id,
            message_id=message_id,
        )
        return False

    resp = await get_backend_client().request(
        "PATCH",
        f"ai-tools/chat-sessions/{session.session_id}/messages/{seq}/feedback",
        json={"helpful": helpful},
    )
    if not resp.get("success"):
        logger.warning(
            "chat_feedback_persist_failed",
            session_id=session.session_id,
            seq=seq,
            error=resp.get("error"),
        )
        return False
    return True
