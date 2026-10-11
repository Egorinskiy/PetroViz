"""
Pydantic-схемы для admin-эндпоинтов.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..db.models import UserRole


class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: datetime | None


class UserListResponse(BaseModel):
    items: list[UserListItem]
    total: int
    limit: int
    offset: int


class UserUpdateRequest(BaseModel):
    """PATCH-запрос. Все поля опциональны — обновляем только переданные."""
    role: UserRole | None = None
    is_active: bool | None = None
    full_name: str | None = Field(None, max_length=255)