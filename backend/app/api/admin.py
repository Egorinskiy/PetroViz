"""
Admin-эндпоинты: /api/admin/*.
Доступны только пользователям с ролью ADMIN.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..admin.well_schemas import (
    WellAdminItem, WellAccessItem, WellAccessListResponse,
    ShareRequest,
    BulkShareRequest, BulkShareResponse,
)
from ..services.admin_well_service import AdminWellService
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
    limit: int = Query(50, ge=1, le=1000),
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

@router.post("/wells/bulk-share", response_model=BulkShareResponse)
async def bulk_share_wells(
    data: BulkShareRequest,
    session: AsyncSession = Depends(get_session),
):
    """Массовая выдача доступа к списку скважин."""
    svc = AdminWellService(session)
    result = await svc.bulk_share(
        well_ids=data.well_ids,
        user_id=data.user_id,
        permission=data.permission,
    )
    return BulkShareResponse(
        granted=result["granted"],
        skipped=result["skipped"],
        failed=result["failed"],
    )

@router.get("/wells", response_model=list[WellAdminItem])
async def list_all_wells(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """Все скважины всех пользователей."""
    svc = AdminWellService(session)
    rows = await svc.list_all_wells(limit=limit, offset=offset)
    return [
        WellAdminItem(
            id=well.id,
            filename=well.filename,
            well_name=well.well_name,
            start_depth=well.start_depth,
            stop_depth=well.stop_depth,
            num_samples=well.num_samples,
            owner_id=owner.id,
            owner_username=owner.username,
            created_at=well.created_at,
        )
        for well, owner in rows
    ]


@router.get("/wells/{well_id}/access", response_model=WellAccessListResponse)
async def list_well_access(
    well_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Кто имеет доступ к скважине."""
    svc = AdminWellService(session)
    rows = await svc.list_access(well_id)
    return WellAccessListResponse(
        well_id=well_id,
        items=[
            WellAccessItem(
                user_id=user.id,
                username=user.username,
                email=user.email,
                permission=access.permission,
                granted_at=access.created_at,
            )
            for access, user in rows
        ],
    )


@router.post(
    "/wells/{well_id}/share",
    response_model=WellAccessItem,
    status_code=status.HTTP_201_CREATED,
)
async def share_well(
    well_id: uuid.UUID,
    data: ShareRequest,
    session: AsyncSession = Depends(get_session),
):
    """Выдать доступ пользователю к скважине."""
    svc = AdminWellService(session)
    access = await svc.share(well_id, data.user_id, data.permission)
    # Достаём user для ответа
    from ..db.models import User as UserModel
    user = await session.get(UserModel, data.user_id)
    return WellAccessItem(
        user_id=user.id,
        username=user.username,
        email=user.email,
        permission=access.permission,
        granted_at=access.created_at,
    )


@router.delete(
    "/wells/{well_id}/share/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_well_access(
    well_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Отозвать доступ."""
    svc = AdminWellService(session)
    await svc.revoke(well_id, user_id)
    return None

