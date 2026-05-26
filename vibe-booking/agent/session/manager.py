from datetime import datetime, timezone
from typing import Optional
from agent.session.state import ConversationState
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
        return ConversationState.from_json(data)

    async def delete(self, session_id: str) -> None:
        r = get_redis()
        await r.delete(f"session:{session_id}")
