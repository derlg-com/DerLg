-- Chat persistence for the Vibe Booking concierge.
--
-- Until now `ai_chat_sessions` and `ai_chat_messages` were read-only: the admin
-- AI-monitoring service queried them, but nothing in the codebase ever inserted
-- a row. Conversations lived only in Redis under `session:{id}` with a 7-day TTL
-- and a 60-turn cap, so every AI metric reported zero and no transcript
-- survived. Three changes make the tables writable by the agent's archive flush.

-- ---------------------------------------------------------------------------
-- 1. ai_chat_sessions.user_id becomes nullable, plus a guest handle.
--
-- The concierge serves guests, and the agent only binds a real user id once a
-- JWT verifies. A NOT NULL FK made anonymous conversations impossible to
-- archive at all — and guests are most of the pre-login funnel. `guest_key`
-- retains the anonymous handle so a session can be stitched to a user who signs
-- in mid-chat.
-- ---------------------------------------------------------------------------
ALTER TABLE "ai_chat_sessions" ADD COLUMN "guest_key" TEXT;
ALTER TABLE "ai_chat_sessions" ALTER COLUMN "user_id" DROP NOT NULL;

-- Re-point the FK: with a nullable column, deleting a user should blank the
-- attribution and keep the transcript, not fail the delete.
ALTER TABLE "ai_chat_sessions" DROP CONSTRAINT "ai_chat_sessions_user_id_fkey";
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The admin session list and every AI metric filter on a created_at range.
CREATE INDEX "ai_chat_sessions_created_at_idx" ON "ai_chat_sessions"("created_at");

-- ---------------------------------------------------------------------------
-- 2. ai_chat_messages.seq — per-session turn ordinal.
--
-- This is what makes the batched archive flush idempotent: a retried batch
-- collides on (session_id, seq) and is skipped instead of duplicating turns. It
-- also gives a total order that created_at cannot, because turns written in one
-- flush can share a timestamp.
--
-- Added nullable, backfilled, then constrained. The table is empty today, but
-- `ADD COLUMN ... INTEGER NOT NULL` with no default is a table-rewrite failure
-- waiting to happen if this migration is ever replayed against real data.
-- ---------------------------------------------------------------------------
ALTER TABLE "ai_chat_messages" ADD COLUMN "seq" INTEGER;

UPDATE "ai_chat_messages" AS m
SET "seq" = ordered.rn - 1
FROM (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "session_id" ORDER BY "created_at", "id") AS rn
    FROM "ai_chat_messages"
) AS ordered
WHERE m."id" = ordered."id";

ALTER TABLE "ai_chat_messages" ALTER COLUMN "seq" SET NOT NULL;

CREATE UNIQUE INDEX "ai_chat_messages_session_id_seq_key" ON "ai_chat_messages"("session_id", "seq");

-- ---------------------------------------------------------------------------
-- 3. ai_chat_messages.helpful — "Was this helpful?" vote for the turn.
--
-- The agent previously only logged feedback via structlog, so thumbs up/down
-- was unrecoverable. NULL until the user votes.
-- ---------------------------------------------------------------------------
ALTER TABLE "ai_chat_messages" ADD COLUMN "helpful" BOOLEAN;
