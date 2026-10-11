"""
Admin-эндпоинты: /api/admin/*.
Доступны только пользователям с ролью ADMIN.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..admin.schemas import (
    UserListItem, UserListResponse, UserUpdateRequest,
)
from ..auth.dependencies import require_role
from ..db.models import User, UserRole
from ..db.session import get_session
from ..services.admin_service import AdminUserService

logger = logging.getLogger("petroviz.api.admin")

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],  # весь роутер только для admin
)


@router.get("/users", response_model=UserListResponse)
async def list_users(
    search: str | None = Query(None, description="Поиск по username/email/full_name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """Список пользователей с пагинацией и поиском."""
    svc = AdminUserService(session)
    users, total = await svc.list_users(search=search, limit=limit, offset=offset)
    return UserListResponse(
        items=[UserListItem.model_validate(u) for u in users],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/users/{user_id}", response_model=UserListItem)
async def get_user(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    svc = AdminUserService(session)
    user = await svc.get_user(user_id)
    return UserListItem.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserListItem)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdateRequest,
    session: AsyncSession = Depends(get_session),
    actor: User = Depends(require_role(UserRole.ADMIN)),
):
    """Изменение роли, статуса или имени пользователя."""
    svc = AdminUserService(session)
    user = await svc.update_user(
        user_id,
        actor,
        role=data.role,
        is_active=data.is_active,
        full_name=data.full_name,
    )
    return UserListItem.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    actor: User = Depends(require_role(UserRole.ADMIN)),
):
    """Удаление пользователя."""
    svc = AdminUserService(session)
    await svc.delete_user(user_id, actor)
    return None