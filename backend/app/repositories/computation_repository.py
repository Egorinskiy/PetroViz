"""
Repository для сохранённых петрофизических расчётов.

Данные (Series значений) хранятся в parquet-файлах,
метаданные — в таблице computations.
"""
import logging
import uuid
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Computation
from ..settings import settings

logger = logging.getLogger("petroviz.repo.computations")


class ComputationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.data_dir = settings.computation_data_path
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _data_path(self, comp_id: uuid.UUID) -> Path:
        return self.data_dir / f"{comp_id}.parquet"

    def _save_series(
        self, comp_id: uuid.UUID, depth: list[float], values: list
    ) -> str:
        """Сохраняет Series в parquet, возвращает относительный путь."""
        path = self._data_path(comp_id)
        df = pd.DataFrame({"value": values}, index=pd.Index(depth, name="DEPT"))
        df.to_parquet(path, engine="pyarrow", compression="snappy")
        logger.debug("Saved computation parquet: %s", path)
        return str(path.relative_to(settings.base_dir))

    def _load_series(self, data_path: str) -> tuple[list[float], list]:
        """Загружает Series из parquet, возвращает (depth, values)."""
        path = settings.base_dir / data_path
        df = pd.read_parquet(path, engine="pyarrow")
        depth = df.index.tolist()
        values = df["value"].tolist()
        return depth, values

    async def save(
        self,
        well_id: uuid.UUID,
        user_id: uuid.UUID,
        method: str,
        params: dict,
        curve_mapping: dict,
        output_mnemonic: str,
        depth: list[float],
        values: list,
        warnings: list,
        source_refs: dict | None = None,  # NEW
    ) -> Computation:
        """Сохраняет расчёт: parquet + запись в БД."""
        comp_id = uuid.uuid4()

        # 1. Данные в parquet
        data_path = self._save_series(comp_id, depth, values)

        # 2. Метаданные в БД
        comp = Computation(
            id=comp_id,
            well_id=well_id,
            user_id=user_id,
            method=method,
            params=params,
            curve_mapping=curve_mapping,
            output_mnemonic=output_mnemonic,
            data_path=data_path,
            warnings=warnings,
            num_samples=len(values),
            source_refs=source_refs,  # NEW
        )
        self.session.add(comp)
        await self.session.commit()
        await self.session.refresh(comp)
        logger.info(
            "Saved computation %s: well=%s method=%s → %s (%d samples)",
            comp.id, well_id, method, output_mnemonic, len(values),
        )
        return comp

    async def list_for_well(self, well_id: uuid.UUID) -> list[Computation]:
        stmt = (
            select(Computation)
            .where(Computation.well_id == well_id)
            .order_by(Computation.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get(self, comp_id: uuid.UUID) -> Optional[Computation]:
        stmt = select(Computation).where(Computation.id == comp_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def load_data(
        self, comp: Computation
    ) -> tuple[list[float], list]:
        try:
            return self._load_series(comp.data_path)
        except FileNotFoundError:
            logger.error(
                "Parquet missing for computation %s: %s",
                comp.id, comp.data_path,
            )
            return [], []

    async def delete(self, comp: Computation) -> None:
        # Удаляем parquet
        try:
            self._data_path(comp.id).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Failed to delete parquet %s: %s", comp.id, e)

        await self.session.delete(comp)
        await self.session.commit()
        logger.info("Deleted computation %s", comp.id)

    @staticmethod
    def to_metadata(comp: Computation) -> dict:
        return {
            "id": str(comp.id),
            "well_id": str(comp.well_id),
            "user_id": str(comp.user_id),
            "method": comp.method,
            "params": comp.params,
            "curve_mapping": comp.curve_mapping,
            "output_mnemonic": comp.output_mnemonic,
            "warnings": comp.warnings,
            "num_samples": comp.num_samples,
            "created_at": comp.created_at.isoformat() if comp.created_at else None,
            "source_refs": comp.source_refs,  # NEW
        }