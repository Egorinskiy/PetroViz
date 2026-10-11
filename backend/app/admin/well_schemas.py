"""
Pydantic-схемы для admin-эндпоинтов скважин.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel

from ..db.models import WellPermission


class WellAdminItem(BaseModel):
    """Скважина в admin-списке — с данными владельца."""
    id: uuid.UUID
    filename: str
    well_name: str | None
    start_depth: float
    stop_depth: float
    num_samples: int
    owner_id: uuid.UUID
    owner_username: str
    created_at: datetime

    class Config:
        from_attributes = True


class WellAccessItem(BaseModel):
    """Один грант доступа."""
    user_id: uuid.UUID
    username: str
    email: str
    permission: WellPermission
    granted_at: datetime


class ShareRequest(BaseModel):
    """Запрос на выдачу доступа."""
    user_id: uuid.UUID
    permission: WellPermission = WellPermission.READ


class WellAccessListResponse(BaseModel):
    well_id: uuid.UUID
    items: list[WellAccessItem]