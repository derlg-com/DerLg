"""Postgres archive for chat transcripts.

Before this existed, conversations lived only in Redis with a 7-day TTL and a
60-turn cap, so no transcript survived and every admin AI metric read zero.

The property these tests protect is retry safety. Flushes are fire-and-forget, so
a timeout re-sends turns that may already have landed. The queue is therefore
cleared ONLY on success, and the backend's [session_id, seq] unique index absorbs
the duplicates. A flush that dropped its queue on failure would lose the
conversation; one that never dropped it would grow without bound.

Equally important: nothing here may raise into the WebSocket handler. Losing an
archive write must never break a live conversation.
"""
import pytest
from unittest.mock import AsyncMock, patch

from agent.session import archive
from agent.session.state import ConversationState


@pytest.fixture
def session():
    return ConversationState(session_id="archive-test", user_id="guest-abc")


def _ok(data=None):
    return {"success": True, "data": data or {}}


def _fail(code="BACKEND_ERROR"):
    return {"success": False, "error": {"code": code, "message": "nope"}}


def _client(response):
    """Backend client stub. `request` returns whatever the caller supplies."""
    client = AsyncMock()
    client.request = AsyncMock(return_value=response)
    return client


# ---------------------------------------------------------------- enqueue


def test_enqueue_assigns_monotonic_seq(session):
    assert archive.enqueue(session, "user", "first") == 0
    assert archive.enqueue(session, "assistant", "second") == 1
    assert session.next_seq == 2


def test_enqueue_seq_survives_message_truncation(session):
    """`seq` must not be derived from the messages list.

    SessionManager.save truncates `messages` to the last 60 turns, which shifts
    every index. A list-position ordinal would collide with already-archived
    turns; the monotonic counter cannot.
    """
    for i in range(5):
        archive.enqueue(session, "user", f"turn {i}")
    session.messages = []  # simulate the truncation

    assert archive.enqueue(session, "user", "after truncation") == 5


def test_enqueue_rejects_tool_role(session):
    """`tool` entries are LLM scaffolding, not conversation.

    They live in `session.messages` for the model's benefit, and the backend DTO
    only accepts user/assistant/system.
    """
    assert archive.enqueue(session, "tool", '{"result": 1}') is None
    assert session.pending_archive == []
    assert session.next_seq == 0


def test_enqueue_rejects_blank_content(session):
    assert archive.enqueue(session, "user", "   ") is None
    assert archive.enqueue(session, "user", "") is None
    assert session.next_seq == 0


def test_enqueue_truncates_overlong_content(session):
    archive.enqueue(session, "assistant", "x" * 9000)

    # The backend caps content at 8000; truncating here stops one long reply
    # failing validation for the whole batch.
    assert len(session.pending_archive[0]["content"]) == 8000


def test_enqueue_records_message_id_for_feedback(session):
    seq = archive.enqueue(session, "assistant", "hello", message_id="m-1")

    assert session.message_seq["m-1"] == seq
    assert session.pending_archive[0]["metadata"]["message_id"] == "m-1"


def test_enqueue_maps_payload_types_to_persisted_set(session):
    archive.enqueue(
        session,
        "assistant",
        "here are trips",
        payloads=[{"type": "trip_cards"}],
    )

    entry = session.pending_archive[0]
    # `trip_cards` is not a valid ai_chat_messages.message_type, so it collapses
    # to `trip_card` while the true type is preserved in metadata.
    assert entry["message_type"] == "trip_card"
    assert entry["metadata"]["payload_types"] == ["trip_cards"]


def test_enqueue_falls_back_to_text_for_unknown_payload(session):
    archive.enqueue(session, "assistant", "map", payloads=[{"type": "map_view"}])

    assert session.pending_archive[0]["message_type"] == "text"


def test_queue_is_capped_to_avoid_unbounded_growth(session):
    """A long backend outage must not grow the session without limit."""
    for i in range(archive.MAX_PENDING + 20):
        archive.enqueue(session, "user", f"turn {i}")

    assert len(session.pending_archive) == archive.MAX_PENDING
    # The newest turns are kept; the oldest are dropped.
    assert session.pending_archive[-1]["content"] == f"turn {archive.MAX_PENDING + 19}"


def test_should_flush_trips_at_the_configured_interval(session):
    for _ in range(archive.FLUSH_EVERY - 1):
        archive.enqueue(session, "user", "x")
    assert archive.should_flush(session) is False

    archive.enqueue(session, "user", "x")
    assert archive.should_flush(session) is True


# ------------------------------------------------------------------ flush


@pytest.mark.asyncio
async def test_flush_clears_the_queue_on_success(session):
    archive.enqueue(session, "user", "hi")
    archive.enqueue(session, "assistant", "hello")

    with patch.object(
        archive, "get_backend_client", return_value=_client(_ok({"inserted": 2}))
    ):
        assert await archive.flush(session) is True

    assert session.pending_archive == []
    assert session.archived_seq == 1


@pytest.mark.asyncio
async def test_flush_keeps_the_queue_on_failure_so_the_next_flush_retries(session):
    archive.enqueue(session, "user", "hi")
    archive.enqueue(session, "assistant", "hello")

    with patch.object(archive, "get_backend_client", return_value=_client(_fail())):
        assert await archive.flush(session) is False

    # Dropping these would silently lose the conversation.
    assert len(session.pending_archive) == 2
    assert session.archived_seq == -1


@pytest.mark.asyncio
async def test_flush_does_not_raise_when_the_circuit_is_open(session):
    """The breaker returns a failure envelope rather than raising.

    Anything that escaped here would surface inside the WebSocket handler and
    break the live conversation.
    """
    archive.enqueue(session, "user", "hi")

    with patch.object(
        archive, "get_backend_client", return_value=_client(_fail("CIRCUIT_OPEN"))
    ):
        assert await archive.flush(session) is False


@pytest.mark.asyncio
async def test_flush_sends_only_unflushed_turns(session):
    archive.enqueue(session, "user", "first")

    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        await archive.flush(session)
        archive.enqueue(session, "user", "second")
        await archive.flush(session)

    second_payload = client.request.call_args_list[1].kwargs["json"]
    seqs = [m["seq"] for m in second_payload["messages"]]
    assert seqs == [1]


@pytest.mark.asyncio
async def test_flush_retry_resends_the_same_seqs(session):
    """A retry must re-send the failed turns unchanged.

    The backend deduplicates on [session_id, seq], so re-sending is safe — and
    necessary, because the first attempt may or may not have landed.
    """
    archive.enqueue(session, "user", "hi")

    failing = _client(_fail())
    with patch.object(archive, "get_backend_client", return_value=failing):
        await archive.flush(session)

    succeeding = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=succeeding):
        await archive.flush(session)

    assert succeeding.request.call_args.kwargs["json"]["messages"][0]["seq"] == 0
    assert session.pending_archive == []


@pytest.mark.asyncio
async def test_flush_on_empty_queue_is_a_no_op(session):
    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        assert await archive.flush(session) is True

    client.request.assert_not_called()


# --------------------------------------------------------- create / rebind


@pytest.mark.asyncio
async def test_create_session_sends_a_guest_key_when_unauthenticated(session):
    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        assert await archive.create_session(session) is True

    body = client.request.call_args.kwargs["json"]
    # Guests have no user row, so user_id must be absent entirely rather than null.
    assert "user_id" not in body
    assert body["guest_key"] == "guest-abc"


@pytest.mark.asyncio
async def test_create_session_sends_user_id_when_authenticated(session):
    session.is_authenticated = True
    session.user_id = "11111111-1111-4111-8111-111111111111"

    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        await archive.create_session(session)

    body = client.request.call_args.kwargs["json"]
    assert body["user_id"] == session.user_id
    assert "guest_key" not in body


@pytest.mark.asyncio
async def test_create_session_maps_kh_to_the_backend_km_locale(session):
    session.preferred_language = "KH"

    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        await archive.create_session(session)

    # The agent's internal Khmer code is KH; the backend enum value is km.
    assert client.request.call_args.kwargs["json"]["language"] == "km"


@pytest.mark.asyncio
async def test_create_session_failure_is_reported_not_raised(session):
    with patch.object(archive, "get_backend_client", return_value=_client(_fail())):
        assert await archive.create_session(session) is False


@pytest.mark.asyncio
async def test_rebind_is_skipped_for_a_guest(session):
    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        assert await archive.rebind_user(session) is False

    client.request.assert_not_called()


@pytest.mark.asyncio
async def test_rebind_attaches_an_authenticated_user(session):
    session.is_authenticated = True
    session.user_id = "22222222-2222-4222-8222-222222222222"

    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        assert await archive.rebind_user(session) is True

    assert client.request.call_args.kwargs["json"]["user_id"] == session.user_id


# --------------------------------------------------------------- feedback


@pytest.mark.asyncio
async def test_feedback_resolves_the_message_id_to_its_seq(session):
    archive.enqueue(session, "assistant", "hello", message_id="m-1")

    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        assert await archive.record_feedback(session, "m-1", False) is True

    method, path = client.request.call_args.args
    assert method == "PATCH"
    # Addressed by the ordinal the agent assigned; it never sees the row id.
    assert path.endswith("/messages/0/feedback")
    assert client.request.call_args.kwargs["json"] == {"helpful": False}


@pytest.mark.asyncio
async def test_feedback_for_an_unknown_id_is_dropped_without_raising(session):
    """The transcript is capped, so a vote on an aged-out turn has nowhere to go.

    That is expected, not an error — and must not raise into the WS handler.
    """
    client = _client(_ok())
    with patch.object(archive, "get_backend_client", return_value=client):
        assert await archive.record_feedback(session, "never-seen", True) is False

    client.request.assert_not_called()


@pytest.mark.asyncio
async def test_feedback_backend_failure_is_reported_not_raised(session):
    archive.enqueue(session, "assistant", "hello", message_id="m-1")

    with patch.object(archive, "get_backend_client", return_value=_client(_fail())):
        assert await archive.record_feedback(session, "m-1", True) is False


# ------------------------------------------------------- state round-trip


def test_archive_state_survives_redis_serialisation(session):
    """The queue is persisted with the session.

    A process restart between flushes would otherwise lose the unflushed turns
    even though the conversation itself was saved.
    """
    archive.enqueue(session, "user", "hi", message_id=None)
    archive.enqueue(session, "assistant", "hello", message_id="m-1")

    restored = ConversationState.from_json(session.to_json())

    assert restored.next_seq == 2
    assert len(restored.pending_archive) == 2
    assert restored.message_seq == {"m-1": 1}
