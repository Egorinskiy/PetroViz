"""
Repository для сохранённых состояний планшета (B29).
"""
import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import PadState

logger = logging.getLogger("petroviz.repo.pad_states")


class PadStateRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(
        self, user_id: uuid.UUID, well_id: uuid.UUID
    ) -> Optional[PadState]:
        stmt = select(PadState).where(
            PadState.user_id == user_id,
            PadState.well_id == well_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def save(
        self, user_id: uuid.UUID, well_id: uuid.UUID, state: dict
    ) -> PadState:
        existing = await self.get(user_id, well_id)
        if existing:
            existing.state = state
            await self.session.commit()
            await self.session.refresh(existing)
            logger.info(
                "Updated pad_state user=%s well=%s", user_id, well_id
            )
            return existing

        pad_state = PadState(user_id=user_id, well_id=well_id, state=state)
        self.session.add(pad_state)
        await self.session.commit()
        await self.session.refresh(pad_state)
        logger.info("Created pad_state user=%s well=%s", user_id, well_id)
        return pad_state

    async def delete(self, user_id: uuid.UUID, well_id: uuid.UUID) -> None:
        existing = await self.get(user_id, well_id)
        if existing:
            await self.session.delete(existing)
            await self.session.commit()
            logger.info("Deleted pad_state user=%s well=%s", user_id, well_id)