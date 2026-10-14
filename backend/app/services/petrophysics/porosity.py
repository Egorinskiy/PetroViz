"""
Пористость — 3 метода: плотностной, нейтронный, акустический (Wyllie).

Все функции принимают pd.Series и возвращают pd.Series с тем же индексом.
NaN сохраняются как NaN.
"""
import logging

import numpy as np
import pandas as pd

from .base import register_method

logger = logging.getLogger("petroviz.petrophysics.porosity")


# Физические пределы пористости (v/v)
PHI_MIN = 0.0
PHI_MAX = 0.6


# ============================================================================
# 1. Плотностная пористость (PHID)
# ============================================================================

def porosity_density(
    rhob: pd.Series,
    rho_matrix: float = 2.65,
    rho_fluid: float = 1.0,
    fluid_zones: list | None = None,
) -> pd.Series:
    """
    Плотностная пористость.

    Формула:
        PHID = (ρm − ρb) / (ρm − ρf)

    Параметры:
        rhob        — объёмная плотность (g/cm³)
        rho_matrix  — плотность матрицы (g/cm³)
        rho_fluid   — базовая плотность флюида (g/cm³)
        fluid_zones — список интервалов [{from, to, rho_fluid}].
                      Если задан, ρf меняется по глубине в указанных интервалах.
    """
    if rho_matrix <= rho_fluid:
        raise ValueError("rho_matrix must be greater than rho_fluid")

    if fluid_zones:
        # ρf как функция глубины
        rho_fluid_series = pd.Series(rho_fluid, index=rhob.index, dtype=float)
        for zone in fluid_zones:
            try:
                from_d = float(zone["from"])
                to_d = float(zone["to"])
                zone_rho = float(zone["rho_fluid"])
            except (KeyError, TypeError, ValueError):
                continue
            mask = (rhob.index >= from_d) & (rhob.index <= to_d)
            rho_fluid_series.loc[mask] = zone_rho
        phid = (rho_matrix - rhob) / (rho_matrix - rho_fluid_series)
    else:
        phid = (rho_matrix - rhob) / (rho_matrix - rho_fluid)

    return phid.clip(lower=PHI_MIN, upper=PHI_MAX)


# ============================================================================
# 2. Нейтронная пористость (PHIN)
# ============================================================================

def porosity_neutron(nphi: pd.Series) -> pd.Series:
    """
    Нейтронная пористость.

    Использует NPHI напрямую — инструмент уже откалиброван под известняк
    в стандартной записи.

    Обрезки нет: в газоносных интервалах NPHI занижена («газовый эффект»),
    это видно на кросс-плоте RHOB-NPHI. Если обрезать — потеряем диагностику.
    """
    return nphi.copy()


# ============================================================================
# 3. Акустическая пористость (Wyllie)
# ============================================================================

def porosity_sonic(
    dtc: pd.Series,
    dt_matrix: float = 55.5,
    dt_fluid: float = 189.0,
) -> pd.Series:
    """
    Пористость по акустическому каротажу (уравнение Уайлли).

    Формула:
        PHIS = (DT − DTm) / (DTf − DTm)

    Параметры (µs/ft):
        dtc        — интервальное время пробега продольной волны
        dt_matrix  — DT матрицы: 55.5 (песчаник), 47.5 (известняк), 43.5 (доломит)
        dt_fluid   — DT флюида: 189 (вода), 240 (нефть), 620 (газ)
    """
    if dt_fluid <= dt_matrix:
        raise ValueError("dt_fluid must be greater than dt_matrix")

    phis = (dtc - dt_matrix) / (dt_fluid - dt_matrix)
    return phis.clip(lower=PHI_MIN, upper=PHI_MAX)

# ============================================================================
# 4. Нейтрон-плотностная пористость (crossplot, Gaymard & Poupon 1968)
# ============================================================================

def porosity_neutron_density(
    rhob: pd.Series,
    nphi: pd.Series,
    rho_matrix: float = 2.65,
    rho_fluid: float = 1.0,
    mode: str = "auto",
    fluid_zones: list | None = None,
) -> pd.Series:
    """
    Пористость по комбинации ГГКп + ННКт (crossplot).

    PHID учитывает fluid_zones (если заданы).
    """
    if rho_matrix <= rho_fluid:
        raise ValueError("rho_matrix must be greater than rho_fluid")

    # PHID через общую функцию (учитывает fluid_zones)
    phid = porosity_density(rhob, rho_matrix, rho_fluid, fluid_zones=fluid_zones)

    if mode == "average":
        result = (phid + nphi) / 2.0
    elif mode == "rms":
        result = np.sqrt((phid.pow(2) + nphi.pow(2)) / 2.0)
    elif mode == "auto":
        avg = (phid + nphi) / 2.0
        rms = np.sqrt((phid.pow(2) + nphi.pow(2)) / 2.0)
        is_gas = nphi < phid
        result = avg.where(~is_gas, rms)
    else:
        raise ValueError(f"Unknown mode: {mode}")

    return result.clip(lower=PHI_MIN, upper=PHI_MAX)

# ============================================================================
# Регистрация методов в общем реестре
# ============================================================================

register_method({
    "key": "porosity_density",
    "label": "Пористость — по плотности (PHID)",
    "category": "porosity",
    "requires": ["rhob"],
    "params": {
        "rho_matrix": {
            "default": 2.65, "min": 1.5, "max": 3.5, "step": 0.01,
            "unit": "g/cm³",
            "description": "Плотность матрицы: 2.65 — кварц (песчаник), "
                           "2.71 — известняк, 2.87 — доломит",
        },
        "rho_fluid": {
            "default": 1.0, "min": 0.1, "max": 1.5, "step": 0.05,
            "unit": "g/cm³",
            "description": "Плотность флюида: 1.0 — вода, 0.8 — нефть, 0.2 — газ",
        },
    },
    "output": "PHID",
})

register_method({
    "key": "porosity_neutron",
    "label": "Пористость — по нейтрону (PHIN)",
    "category": "porosity",
    "requires": ["nphi"],
    "params": {},
    "output": "PHIN",
})

register_method({
    "key": "porosity_sonic",
    "label": "Пористость — по акустике (Wyllie)",
    "category": "porosity",
    "requires": ["dtc"],
    "params": {
        "dt_matrix": {
            "default": 55.5, "min": 30.0, "max": 100.0, "step": 0.5,
            "unit": "µs/ft",
            "description": "DT матрицы: 55.5 — песчаник, 47.5 — известняк, 43.5 — доломит",
        },
        "dt_fluid": {
            "default": 189.0, "min": 100.0, "max": 700.0, "step": 1.0,
            "unit": "µs/ft",
            "description": "DT флюида: 189 — вода, 240 — нефть, 620 — газ",
        },
    },
    "output": "PHIS",
})

register_method({
    "key": "porosity_neutron_density",
    "label": "Пористость — ГГКп-ННКт (crossplot)",
    "category": "porosity",
    "requires": ["rhob", "nphi"],
    "params": {
        "rho_matrix": {
            "default": 2.65, "min": 1.5, "max": 3.5, "step": 0.01,
            "unit": "g/cm³",
            "description": "Плотность матрицы: 2.65 — кварц, 2.71 — известняк, 2.87 — доломит",
        },
        "rho_fluid": {
            "default": 1.0, "min": 0.1, "max": 1.5, "step": 0.05,
            "unit": "g/cm³",
            "description": "Плотность флюида: 1.0 — вода, 0.8 — нефть, 0.2 — газ",
        },
    },
    "output": "PHI_ND",
})