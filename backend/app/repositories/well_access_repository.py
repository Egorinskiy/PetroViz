"""
Repository для совместного доступа к скважинам.
"""
import logging
import uuid

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import WellAccess, WellPermission

logger = logging.getLogger("petroviz.repo.well_access")


class WellAccessRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(
        self,
        user_id: uuid.UUID,
        well_id: uuid.UUID,
    ) -> WellAccess | None:
        stmt = select(WellAccess).where(
            WellAccess.user_id == user_id,
            WellAccess.well_id == well_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_well(self, well_id: uuid.UUID) -> list[WellAccess]:
        stmt = select(WellAccess).where(WellAccess.well_id == well_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_user(self, user_id: uuid.UUID) -> list[WellAccess]:
        stmt = select(WellAccess).where(WellAccess.user_id == user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def grant(
        self,
        user_id: uuid.UUID,
        well_id: uuid.UUID,
        permission: WellPermission = WellPermission.READ,
    ) -> WellAccess:
        """
        Выдаёт доступ пользователю к скважине.
        Если доступ уже есть — обновляет permission.
        """
        existing = await self.get(user_id, well_id)
        if existing is not None:
            existing.permission = permission
            await self.session.commit()
            await self.session.refresh(existing)
            logger.info(
                "Updated access: user=%s well=%s permission=%s",
                user_id, well_id, permission.value,
            )
            return existing

        access = WellAccess(
            user_id=user_id,
            well_id=well_id,
            permission=permission,
        )
        self.session.add(access)
        await self.session.commit()
        await self.session.refresh(access)
        logger.info(
            "Granted access: user=%s well=%s permission=%s",
            user_id, well_id, permission.value,
        )
        return access

    async def revoke(self, user_id: uuid.UUID, well_id: uuid.UUID) -> bool:
        access = await self.get(user_id, well_id)
        if access is None:
            return False
        await self.session.delete(access)
        await self.session.commit()
        logger.info("Revoked access: user=%s well=%s", user_id, well_id)
        return True

    async def has_access(self, user_id: uuid.UUID, well_id: uuid.UUID) -> bool:
        """Есть ли у пользователя доступ (любой permission)."""
        return await self.get(user_id, well_id) is not None

    async def has_write_access(
        self,
        user_id: uuid.UUID,
        well_id: uuid.UUID,
    ) -> bool:
        """Есть ли право записи (write или owner)."""
        access = await self.get(user_id, well_id)
        if access is None:
            return False
        return access.permission in (WellPermission.WRITE, WellPermission.OWNER)