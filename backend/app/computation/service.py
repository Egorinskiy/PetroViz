"""
Сервис для запуска петрофизических расчётов.
"""
import logging
import uuid

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions import PetroVizError, WellNotFoundError
from ..repositories.well_repository import WellRepository
from ..services.petrophysics import METHODS


logger = logging.getLogger("petroviz.computation")


class MethodNotFoundError(PetroVizError):
    status_code = 404
    detail = "Method not found"


class CurveMappingError(PetroVizError):
    status_code = 400
    detail = "Invalid curve mapping"


class ComputationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = WellRepository(session)

    async def compute_preview(
        self,
        well_id: str,
        method: str,
        curve_mapping: dict[str, str],
        params: dict,
    ) -> tuple[list[float], dict[str, pd.Series], list[str]]:
        """
        Считает расчёт без сохранения в БД.

        Возвращает:
            depth: список глубин
            curves: словарь {mnemonic: Series}
            warnings: список предупреждений
        """
        # 1. Проверяем метод
        if method not in METHODS:
            raise MethodNotFoundError(f"Method '{method}' not found")

        spec = METHODS[method]
        logger.info("Computing '%s' for well %s", method, well_id)

        # 2. Достаём данные скважины
        result = await self.repo.get(uuid.UUID(well_id))
        if result is None:
            raise WellNotFoundError(f"Well '{well_id}' not found")

        _, df = result

        # 3. Мапим роли → серии данных
        input_series: dict[str, pd.Series] = {}
        warnings: list[str] = []

        for role in spec["requires"]:
            mnemonic = curve_mapping.get(role)
            if mnemonic is None or mnemonic == "":
                # Автодетект: пробуем найти по алиасам (используем curveFamilies логику)
                mnemonic = self._auto_detect(df, role)
                if mnemonic is None:
                    raise CurveMappingError(
                        f"Curve for role '{role}' not specified and no auto-detection "
                        f"possible. Available columns: {list(df.columns)}"
                    )

            if mnemonic not in df.columns:
                raise CurveMappingError(
                    f"Mnemonic '{mnemonic}' for role '{role}' not found in well data. "
                    f"Available: {list(df.columns)}"
                )

            input_series[role] = df[mnemonic]

        # 4. Считаем
        output_values = self._dispatch(method, input_series, params)

        # 5. Собираем результат
        depth = df.index.tolist()
        output_mnemonic = spec["output"]
        curves = {output_mnemonic: output_values}

        logger.info(
            "Computed '%s' → %s (N=%d, warnings=%d)",
            method, output_mnemonic, len(output_values), len(warnings),
        )
        return depth, curves, warnings

    def _auto_detect(self, df: pd.DataFrame, role: str) -> str | None:
        """Простой автодетект по типовым мнемоникам."""
        aliases = {
            "gr": ["GR", "GAM", "GAPI", "SGR", "HSGR", "GK"],
            "rhob": ["RHOB", "RHOZ", "ROBB", "DEN", "ZDEN"],
            "nphi": ["NPHI", "CNL", "TNPH", "NNK"],
            "dtc": ["DTC", "DT", "AC", "SONIC"],
            "rt": ["RDEP", "RT", "ILD", "LLD", "RES"],
            "pef": ["PEF", "PE"],
        }
        for alias in aliases.get(role, []):
            if alias in df.columns:
                return alias
        # Регистронезависимый fallback
        cols_upper = {c.upper(): c for c in df.columns}
        for alias in aliases.get(role, []):
            if alias in cols_upper:
                return cols_upper[alias]
        return None

    def _dispatch(self, method: str, series: dict, params: dict) -> pd.Series:
        """Диспетчер по методам."""
        from ..services.petrophysics.vshale import (
            vshale_linear, vshale_larionov_tertiary, vshale_larionov_older,
            vshale_stieber, vshale_neutron_density,
        )
        from ..services.petrophysics.porosity import (
            porosity_density, porosity_neutron, porosity_sonic,
        )

        spec = METHODS[method]
        merged = {**{k: v["default"] for k, v in spec["params"].items()}, **params}

        # --- Vshale ---
        if method == "vshale_linear":
            return vshale_linear(series["gr"], merged["gr_min"], merged["gr_max"])
        if method == "vshale_larionov_tertiary":
            return vshale_larionov_tertiary(series["gr"], merged["gr_min"], merged["gr_max"])
        if method == "vshale_larionov_older":
            return vshale_larionov_older(series["gr"], merged["gr_min"], merged["gr_max"])
        if method == "vshale_stieber":
            return vshale_stieber(series["gr"], merged["gr_min"], merged["gr_max"])
        if method == "vshale_neutron_density":
            return vshale_neutron_density(
                series["rhob"], series["nphi"],
                merged["rho_matrix"], merged["rho_fluid"],
                merged["phid_clean"], merged["phid_shale"],
                merged["nphi_clean"], merged["nphi_shale"],
            )

        # --- Пористость ---
        if method == "porosity_density":
            return porosity_density(
                series["rhob"], merged["rho_matrix"], merged["rho_fluid"],
            )
        if method == "porosity_neutron":
            return porosity_neutron(series["nphi"])
        if method == "porosity_sonic":
            return porosity_sonic(
                series["dtc"], merged["dt_matrix"], merged["dt_fluid"],
            )

        raise MethodNotFoundError(f"Method '{method}' has no implementation")