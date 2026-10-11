"""
Repository для скважин: метаданные в PostgreSQL, данные в parquet-файлах.
"""
import logging
import uuid
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User, Well
from ..settings import settings

logger = logging.getLogger("petroviz.repo.wells")


class WellRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.data_dir = settings.well_data_path
        self.data_dir.mkdir(parents=True, exist_ok=True)

    # --- Внутренние утилиты ---

    def _data_path(self, well_id: uuid.UUID) -> Path:
        return self.data_dir / f"{well_id}.parquet"

    def _save_dataframe(self, well_id: uuid.UUID, df: pd.DataFrame) -> str:
        """Сохраняет DataFrame в parquet, возвращает относительный путь."""
        path = self._data_path(well_id)
        df.to_parquet(path, engine="pyarrow", compression="snappy")
        logger.debug("Saved parquet: %s", path)
        # Возвращаем относительный путь от backend/
        return str(path.relative_to(settings.base_dir))

    def _load_dataframe(self, data_path: str) -> pd.DataFrame:
        path = settings.base_dir / data_path
        return pd.read_parquet(path, engine="pyarrow")

    # --- Публичные методы ---

    async def add(
        self,
        owner_id: uuid.UUID,
        filename: str,
        metadata: dict,
        df: pd.DataFrame,
    ) -> Well:
        """Создаёт запись скважины: сначала генерим ID, сохраняем parquet, потом пишем в БД."""
        well_id = uuid.uuid4()

        # 1. Сохраняем данные в parquet (по ID)
        data_path = self._save_dataframe(well_id, df)

        # 2. Создаём запись в БД
        well = Well(
            id=well_id,
            owner_id=owner_id,
            filename=filename,
            well_name=metadata.get("well_name"),
            start_depth=metadata["start_depth"],
            stop_depth=metadata["stop_depth"],
            step=metadata.get("step"),
            num_samples=metadata["num_samples"],
            depth_mnemonic=metadata.get("depth_mnemonic"),
            curves=metadata.get("curves", []),
            data_path=data_path,
        )
        self.session.add(well)
        await self.session.commit()
        await self.session.refresh(well)
        logger.info("Stored well %s (%s) for owner %s", well.id, filename, owner_id)
        return well

    async def get(
        self,
        well_id: uuid.UUID,
        owner_id: uuid.UUID | None = None,
    ) -> Optional[tuple[Well, pd.DataFrame]]:
        """Возвращает (Well, DataFrame). Если owner_id задан — проверяет владение."""
        stmt = select(Well).where(Well.id == well_id)
        if owner_id is not None:
            stmt = stmt.where(Well.owner_id == owner_id)
        result = await self.session.execute(stmt)
        well = result.scalar_one_or_none()
        if well is None:
            return None
        try:
            df = self._load_dataframe(well.data_path)
        except FileNotFoundError:
            logger.error("Parquet missing for well %s: %s", well.id, well.data_path)
            return None
        return well, df

    async def get_metadata(
        self,
        well_id: uuid.UUID,
        owner_id: uuid.UUID | None = None,
    ) -> Optional[dict]:
        """Возвращает метаданные. Если owner_id задан — проверяет владение."""
        stmt = select(Well).where(Well.id == well_id)
        if owner_id is not None:
            stmt = stmt.where(Well.owner_id == owner_id)
        result = await self.session.execute(stmt)
        well = result.scalar_one_or_none()
        if well is None:
            return None
        return self._well_to_metadata(well)

    async def list_for_user(self, owner_id: uuid.UUID) -> list[dict]:
        """Все скважины пользователя (свои)."""
        stmt = (
            select(Well)
            .where(Well.owner_id == owner_id)
            .order_by(Well.created_at.desc())
        )
        result = await self.session.execute(stmt)
        wells = result.scalars().all()
        return [self._well_to_metadata(w) for w in wells]

    async def delete(self, well_id: uuid.UUID) -> bool:
        stmt = select(Well).where(Well.id == well_id)
        result = await self.session.execute(stmt)
        well = result.scalar_one_or_none()
        if well is None:
            return False

        # Удаляем parquet
        try:
            self._data_path(well_id).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Failed to delete parquet %s: %s", well_id, e)

        await self.session.delete(well)
        await self.session.commit()
        logger.info("Deleted well %s", well_id)
        return True

    @staticmethod
    def _well_to_metadata(well: Well) -> dict:
        return {
            "well_id": str(well.id),
            "filename": well.filename,
            "well_name": well.well_name,
            "start_depth": well.start_depth,
            "stop_depth": well.stop_depth,
            "step": well.step,
            "num_samples": well.num_samples,
            "depth_mnemonic": well.depth_mnemonic,
            "curves": well.curves,
            "owner_id": str(well.owner_id),
            "created_at": well.created_at.isoformat() if well.created_at else None,
        }


async def ensure_system_user(session: AsyncSession) -> User:
    """Возвращает 'системного' пользователя. Создаёт, если нет.

    Используется как временный владелец скважин до внедрения auth.
    """
    stmt = select(User).where(User.username == "system")
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    from ..db.models import UserRole
    user = User(
        username="system",
        email="system@petroviz.local",
        password_hash="!",           # невозможно залогиниться
        full_name="System User",
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    logger.info("Created system user: %s", user.id)
    return user