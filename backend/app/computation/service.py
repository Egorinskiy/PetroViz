"""
Сервис для запуска петрофизических расчётов.

Методы Sw/Swi/R0 требуют ВАЛИДИРОВАННЫХ интерпретатором сохранённых расчётов
(Vsh, PHI) — они передаются через computation_refs и загружаются из БД.
"""
import logging
import uuid

import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions import PetroVizError, WellNotFoundError
from ..repositories.computation_repository import ComputationRepository
from ..repositories.well_repository import WellRepository
from ..services.petrophysics import METHODS


logger = logging.getLogger("petroviz.computation")


class MethodNotFoundError(PetroVizError):
    status_code = 404
    detail = "Method not found"


class CurveMappingError(PetroVizError):
    status_code = 400
    detail = "Invalid curve mapping"


class ComputationRefError(PetroVizError):
    status_code = 400
    detail = "Invalid computation reference"


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
        computation_refs: dict[str, str] | None = None,
    ) -> tuple[list[float], dict[str, pd.Series], list[str], dict[str, str] | None]:
        """
        Считает расчёт без сохранения в БД.

        Возвращает:
            depth: список глубин
            curves: словарь {mnemonic: Series}
            warnings: список предупреждений
            sources: {role: computation_id} — какие сохранённые расчёты использованы
                     (None, если метод не требует refs)
        """
        # 1. Проверяем метод
        if method not in METHODS:
            raise MethodNotFoundError(f"Method '{method}' not found")

        spec = METHODS[method]
        logger.info("Computing '%s' for well %s", method, well_id)

        # 2. Достаём данные скважины
        well_uuid = uuid.UUID(well_id)
        result = await self.repo.get(well_uuid)
        if result is None:
            raise WellNotFoundError(f"Well '{well_id}' not found")

        _, df = result

        # 3. Загружаем сохранённые расчёты (если метод их требует)
        ref_series, sources, ref_warnings = await self._load_computation_refs(
            well_uuid, df, spec, computation_refs or {}
        )

        # 4. Мапим роли из LAS → серии
        input_series: dict[str, pd.Series] = {}
        warnings: list[str] = list(ref_warnings)

        for role in spec["requires"]:
            mnemonic = curve_mapping.get(role)
            if mnemonic is None or mnemonic == "":
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

        # 5. Добавляем серии из сохранённых расчётов
        input_series.update(ref_series)

        # 6. Считаем
        output_values = self._dispatch(method, input_series, params)

        # 7. Собираем результат
        depth = df.index.tolist()
        output_mnemonic = spec["output"]
        curves = {output_mnemonic: output_values}

        logger.info(
            "Computed '%s' → %s (N=%d, warnings=%d, sources=%d)",
            method, output_mnemonic, len(output_values), len(warnings), len(sources),
        )
        return depth, curves, warnings, (sources or None)

    async def _load_computation_refs(
        self,
        well_id: uuid.UUID,
        df: pd.DataFrame,
        spec: dict,
        computation_refs: dict[str, str],
    ) -> tuple[dict[str, pd.Series], dict[str, str], list[str]]:
        """
        Загружает сохранённые расчёты по ролям с полной валидацией.

        Возвращает:
            refs_series: {role: pd.Series} — данные с индексом = depth скважины
            sources: {role: computation_id}
            warnings: []
        """
        required = spec.get("requires_computations", {})
        if not required:
            return {}, {}, []

        if not computation_refs:
            roles = ", ".join(
                f"'{r}' ({required[r]['label']})" for r in required
            )
            raise ComputationRefError(
                f"Method '{spec['key']}' requires saved computations for roles: "
                f"{roles}. Please provide 'computation_refs' with computation IDs."
            )

        repo = ComputationRepository(self.session)
        refs_series: dict[str, pd.Series] = {}
        sources: dict[str, str] = {}
        warnings: list[str] = []

        for role, req in required.items():
            comp_id_str = computation_refs.get(role)
            if not comp_id_str:
                raise ComputationRefError(
                    f"Missing computation reference for role '{role}' "
                    f"({req['label']}). Save a '{req['category']}' computation first."
                )

            try:
                comp_uuid = uuid.UUID(comp_id_str)
            except ValueError:
                raise ComputationRefError(
                    f"Invalid computation ID for role '{role}': '{comp_id_str}'"
                )

            comp = await repo.get(comp_uuid)
            if comp is None:
                raise ComputationRefError(
                    f"Computation '{comp_id_str}' (role '{role}') not found."
                )

            if comp.well_id != well_id:
                raise ComputationRefError(
                    f"Computation '{comp_id_str}' (role '{role}') belongs to "
                    f"a different well."
                )

            # Проверка категории метода
            comp_spec = METHODS.get(comp.method, {})
            comp_category = comp_spec.get("category", "")
            if comp_category != req["category"]:
                raise ComputationRefError(
                    f"Computation '{comp_id_str}' (role '{role}') has method "
                    f"'{comp.method}' (category '{comp_category}'), "
                    f"but category '{req['category']}' is required."
                )

            # Загрузка данных из parquet
            ref_depth, ref_values = await repo.load_data(comp)
            if not ref_depth:
                raise ComputationRefError(
                    f"Computation '{comp_id_str}' (role '{role}') has no data — "
                    f"parquet file missing or empty."
                )

            # Жёсткая проверка глубин
            if len(ref_depth) != len(df.index) or not np.allclose(
                ref_depth, df.index.values, rtol=1e-6, atol=1e-9
            ):
                raise ComputationRefError(
                    f"Computation '{comp_id_str}' (role '{role}') depth mismatch. "
                    f"Expected {len(df.index)} samples "
                    f"({df.index[0]:.2f}..{df.index[-1]:.2f}), "
                    f"got {len(ref_depth)} "
                    f"({ref_depth[0]:.2f}..{ref_depth[-1]:.2f}). "
                    f"Возможно, скважина была перезалита — "
                    f"пересчитайте '{role}' и сохраните заново."
                )

            refs_series[role] = pd.Series(ref_values, index=df.index)
            sources[role] = comp_id_str
            logger.info(
                "Loaded ref '%s' from computation %s (%d samples)",
                role, comp_id_str, len(ref_values),
            )

        return refs_series, sources, warnings

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
            porosity_neutron_density,
        )
        from ..services.petrophysics.swi import swi_bound_water
        from ..services.petrophysics.archie import sw_archie, r0_archie
        from ..services.petrophysics.ntg import ntg_cutoff
        from ..services.petrophysics.permeability import perm_timur_coates

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
        fluid_zones = merged.get("fluid_zones")

        if method == "porosity_density":
            return porosity_density(
                series["rhob"], merged["rho_matrix"], merged["rho_fluid"],
                fluid_zones=fluid_zones,
            )
        if method == "porosity_neutron":
            return porosity_neutron(series["nphi"])
        if method == "porosity_neutron_density":
            return porosity_neutron_density(
                series["rhob"], series["nphi"],
                merged["rho_matrix"], merged["rho_fluid"],
                mode="auto",
                fluid_zones=fluid_zones,
            )
        if method == "porosity_sonic":
            return porosity_sonic(
                series["dtc"], merged["dt_matrix"], merged["dt_fluid"],
            )

        # --- Swi (bound water) ---
        if method == "swi_bound_water":
            return swi_bound_water(
                series["vsh"], series["phi"],
                c1=merged["c1"], c2=merged["c2"],
                swi_min=merged["swi_min"], swi_max=merged["swi_max"],
            )

        # --- Sw (Archie) ---
        if method == "sw_archie":
            return sw_archie(
                series["phi"], series["rt"],
                a=merged["a"], m=merged["m"], n=merged["n"], rw=merged["rw"],
            )

        # --- R0 (overlay) ---
        if method == "r0_archie":
            return r0_archie(
                series["phi"],
                a=merged["a"], m=merged["m"], rw=merged["rw"],
            )

        # --- NTG (cutoff) ---
        if method == "ntg_cutoff":
            return ntg_cutoff(
                series["vsh"], series["phi"], series["swi"],
                vsh_cutoff=merged["vsh_cutoff"],
                phi_cutoff=merged["phi_cutoff"],
                swi_cutoff=merged["swi_cutoff"],
            )

        # --- Проницаемость ---
        if method == "perm_timur_coates":
            return perm_timur_coates(
                series["phi"], series["swi"],
                c=merged["c"], a=merged["a"], b=merged["b"],
            )

        raise MethodNotFoundError(f"Method '{method}' has no implementation")