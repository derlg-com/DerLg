from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ContentBlock:
    type: str
    text: str = ""
    id: str = ""
    name: str = ""
    input: dict = field(default_factory=dict)


@dataclass
class ModelResponse:
    stop_reason: str  # "tool_use" | "end_turn"
    content: list[ContentBlock]


class ModelClient(ABC):
    @abstractmethod
    async def create_message(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 2048,
    ) -> ModelResponse:
        ...
