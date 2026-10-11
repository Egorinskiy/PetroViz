"""
Pydantic-схемы для admin-эндпоинтов скважин.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict

from ..db.models import WellPermission


class WellAdminItem(BaseModel):
    """Скважина в admin-списке — с данными владельца."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    filename: str
    well_name: str | None
    start_depth: float
    stop_depth: float
    num_samples: int
    owner_id: uuid.UUID
    owner_username: str
    created_at: datetime


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


class BulkShareSkip(BaseModel):
    well_id: uuid.UUID
    reason: str


class BulkShareFail(BaseModel):
    well_id: uuid.UUID
    error: str


class BulkShareRequest(BaseModel):
    well_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=500)
    user_id: uuid.UUID
    permission: WellPermission = WellPermission.READ


class BulkShareResponse(BaseModel):
    granted: list[uuid.UUID]
    skipped: list[BulkShareSkip]
    failed: list[BulkShareFail]