from datetime import datetime, timezone
from typing import Optional
from agent.session.state import ConversationState, AgentState
from utils.redis import get_redis
from utils.logging import logger

SESSION_TTL = 604800  # 7 days


class SessionManager:
    async def save(self, session: ConversationState) -> None:
        session.last_active = datetime.now(timezone.utc)
        r = get_redis()
        await r.setex(f"session:{session.session_id}", SESSION_TTL, session.to_json())

    async def load(self, session_id: str) -> Optional[ConversationState]:
        r = get_redis()
        data = await r.get(f"session:{session_id}")
        if data is None:
            return None
        session = ConversationState.from_json(data)
        session = self._recover_expired_hold(session)
        return session

    async def delete(self, session_id: str) -> None:
        r = get_redis()
        await r.delete(f"session:{session_id}")

    def _recover_expired_hold(self, session: ConversationState) -> ConversationState:
        if session.state != AgentState.PAYMENT or session.reserved_until is None:
            return session
        now = datetime.now(timezone.utc)
        reserved = session.reserved_until
        if reserved.tzinfo is None:
            from datetime import timezone as tz
            reserved = reserved.replace(tzinfo=tz.utc)
        if now > reserved:
            logger.info("booking_hold_expired", session_id=session.session_id)
            session.state = AgentState.BOOKING
            session.booking_id = ""
            session.payment_intent_id = ""
            session.reserved_until = None
            session.messages.append({
                "role": "system",
                "content": "The 15-minute booking hold has expired. Inform the user and offer to restart the booking.",
            })
        return session
