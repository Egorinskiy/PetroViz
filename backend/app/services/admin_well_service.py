"""
Admin-логика для скважин: список, sharing.
"""
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User, Well, WellAccess, WellPermission
from ..exceptions import PetroVizError
from ..repositories.well_access_repository import WellAccessRepository

logger = logging.getLogger("petroviz.admin.wells")


class WellAdminNotFoundError(PetroVizError):
    status_code = 404
    detail = "Well not found"


class AccessNotFoundError(PetroVizError):
    status_code = 404
    detail = "Access record not found"


class OwnerShareError(PetroVizError):
    status_code = 400
    detail = "Cannot share a well with its owner (owner already has full access)"


class AdminWellService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.access_repo = WellAccessRepository(session)

    async def list_all_wells(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[tuple[Well, User]]:
        """Все скважины всех пользователей + данные владельца."""
        stmt = (
            select(Well, User)
            .join(User, Well.owner_id == User.id)
            .order_by(Well.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.all())

    async def get_well(self, well_id: uuid.UUID) -> tuple[Well, User]:
        stmt = (
            select(Well, User)
            .join(User, Well.owner_id == User.id)
            .where(Well.id == well_id)
        )
        result = await self.session.execute(stmt)
        row = result.first()
        if row is None:
            raise WellAdminNotFoundError(f"Well '{well_id}' not found")
        return row

    async def list_access(self, well_id: uuid.UUID) -> list[tuple[WellAccess, User]]:
        """Кто имеет доступ к скважине (кроме владельца)."""
        stmt = (
            select(WellAccess, User)
            .join(User, WellAccess.user_id == User.id)
            .where(WellAccess.well_id == well_id)
            .order_by(WellAccess.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.all())

    async def share(
        self,
        well_id: uuid.UUID,
        user_id: uuid.UUID,
        permission: WellPermission,
    ) -> WellAccess:
        # Проверяем, что скважина существует
        well, owner = await self.get_well(well_id)

        # Нельзя расшарить владельцу — у него и так полный доступ
        if user_id == owner.id:
            raise OwnerShareError(
                f"User '{owner.username}' is the owner of this well"
            )

        # Проверяем, что пользователь существует
        user = await self.session.get(User, user_id)
        if user is None:
            raise PetroVizError  # generic — заменим ниже

        return await self.access_repo.grant(user_id, well_id, permission)

    async def revoke(self, well_id: uuid.UUID, user_id: uuid.UUID) -> None:
        # Проверяем, что скважина существует
        await self.get_well(well_id)
        removed = await self.access_repo.revoke(user_id, well_id)
        if not removed:
            raise AccessNotFoundError(
                f"No access record for user '{user_id}' on well '{well_id}'"
            )

    async def bulk_share(
        self,
        well_ids: list[uuid.UUID],
        user_id: uuid.UUID,
        permission: WellPermission,
    ) -> dict:
        """
        Выдаёт доступ одному пользователю к списку скважин.
        Возвращает отчёт: {granted, skipped, failed}.
        Не падает, если одна скважина не найдена — продолжает остальные.
        """
        # Проверяем пользователя один раз
        user = await self.session.get(User, user_id)
        if user is None:
            from .admin_service import UserNotFoundError
            raise UserNotFoundError(f"User '{user_id}' not found")

        granted: list[uuid.UUID] = []
        skipped: list[dict] = []
        failed: list[dict] = []

        for well_id in well_ids:
            try:
                well, owner = await self.get_well(well_id)

                if user_id == owner.id:
                    skipped.append({
                        "well_id": well_id,
                        "reason": "user is owner",
                    })
                    continue

                await self.access_repo.grant(user_id, well_id, permission)
                granted.append(well_id)
            except WellAdminNotFoundError:
                failed.append({"well_id": well_id, "error": "well not found"})
            except Exception as e:
                logger.exception("Bulk share failed for well %s", well_id)
                failed.append({"well_id": well_id, "error": str(e)})

        logger.info(
            "Bulk share: user=%s granted=%d skipped=%d failed=%d",
            user_id, len(granted), len(skipped), len(failed),
        )
        return {"granted": granted, "skipped": skipped, "failed": failed}