"""
Pydantic-схемы для сохранённого состояния планшета (B29).
"""
from typing import Any

from pydantic import BaseModel, Field


class PadStateSaveRequest(BaseModel):
    """Запрос на сохранение состояния планшета."""
    state: dict[str, Any] = Field(default_factory=dict)


class PadStateResponse(BaseModel):
    """Ответ с сохранённым состоянием планшета."""
    state: dict[str, Any]
    updated_at: str | None = None