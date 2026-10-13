"""
Vshale (глинистость) — 5 методов.

Все функции принимают pd.Series и возвращают pd.Series с тем же индексом.
NaN сохраняются как NaN.
"""
import logging

import numpy as np
import pandas as pd

from .base import register_method

logger = logging.getLogger("petroviz.petrophysics.vshale")


# ============================================================================
# 1. Линейный (Клавье)
# ============================================================================

def vshale_linear(gr: pd.Series, gr_min: float, gr_max: float) -> pd.Series:
    """Клавье: Vsh = IGR = (GR − GRmin) / (GRmax − GRmin)."""
    if gr_max <= gr_min:
        raise ValueError("gr_max must be greater than gr_min")
    igr = (gr - gr_min) / (gr_max - gr_min)
    return igr.clip(lower=0.0, upper=1.0)


# ============================================================================
# 2. Ларионов (третичные отложения)
# ============================================================================

def vshale_larionov_tertiary(gr: pd.Series, gr_min: float, gr_max: float) -> pd.Series:
    """Ларионов (tertiary): Vsh = 0.083 × (2^(3.7·IGR) − 1)."""
    if gr_max <= gr_min:
        raise ValueError("gr_max must be greater than gr_min")
    igr = ((gr - gr_min) / (gr_max - gr_min)).clip(lower=0.0, upper=1.0)
    vsh = 0.083 * (np.power(2.0, 3.7 * igr) - 1.0)
    return vsh.clip(lower=0.0, upper=1.0)


# ============================================================================
# 3. Ларионов (древние отложения)
# ============================================================================

def vshale_larionov_older(gr: pd.Series, gr_min: float, gr_max: float) -> pd.Series:
    """Ларионов (older): Vsh = 0.33 × (2^(2·IGR) − 1)."""
    if gr_max <= gr_min:
        raise ValueError("gr_max must be greater than gr_min")
    igr = ((gr - gr_min) / (gr_max - gr_min)).clip(lower=0.0, upper=1.0)
    vsh = 0.33 * (np.power(2.0, 2.0 * igr) - 1.0)
    return vsh.clip(lower=0.0, upper=1.0)


# ============================================================================
# 4. Штибер
# ============================================================================

def vshale_stieber(gr: pd.Series, gr_min: float, gr_max: float) -> pd.Series:
    """Штибер: Vsh = 0.5·IGR / (1.5 − IGR)."""
    if gr_max <= gr_min:
        raise ValueError("gr_max must be greater than gr_min")
    igr = ((gr - gr_min) / (gr_max - gr_min)).clip(lower=0.0, upper=1.0)
    vsh = 0.5 * igr / (1.5 - igr)
    return vsh.clip(lower=0.0, upper=1.0)


# ============================================================================
# 5. ГГКп-ННКт (neutron-density separation)
# ============================================================================

def vshale_neutron_density(
    rhob: pd.Series,
    nphi: pd.Series,
    rho_matrix: float = 2.65,
    rho_fluid: float = 1.0,
    phid_clean: float = 0.30,
    phid_shale: float = 0.10,
    nphi_clean: float = 0.28,
    nphi_shale: float = 0.25,
) -> pd.Series:
    """
    Vshale из нейтрон-плотностного разделения.

    Логика:
      1. Считаем PHID из RHOB.
      2. Δ = NPHI − PHID.
      3. Δ_clean = NPHI_clean − PHID_clean.
      4. Δ_shale = NPHI_shale − PHID_shale.
      5. IGR = (Δ − Δ_clean) / (Δ_shale − Δ_clean).
      6. Vsh = clamp(IGR, 0, 1).
    """
    if rho_matrix <= rho_fluid:
        raise ValueError("rho_matrix must be greater than rho_fluid")

    # 1. Плотностная пористость
    phid = (rho_matrix - rhob) / (rho_matrix - rho_fluid)

    # 2. Δ = NPHI − PHID
    delta = nphi - phid

    # 3-4. Граничные разности
    delta_clean = nphi_clean - phid_clean
    delta_shale = nphi_shale - phid_shale

    if delta_shale == delta_clean:
        raise ValueError("delta_shale must differ from delta_clean")

    # 5. IGR
    igr = (delta - delta_clean) / (delta_shale - delta_clean)

    # 6. Обрезка
    return igr.clip(lower=0.0, upper=1.0)


# ============================================================================
# Регистрация методов в общем реестре
# ============================================================================

register_method({
    "key": "vshale_linear",
    "label": "Vshale — линейный (Клавье)",
    "category": "vshale",
    "requires": ["gr"],
    "params": {
        "gr_min": {"default": 15.0, "min": 0.0, "max": 200.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистого песка"},
        "gr_max": {"default": 120.0, "min": 0.0, "max": 300.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистой глины"},
    },
    "output": "VSH",
})

register_method({
    "key": "vshale_larionov_tertiary",
    "label": "Vshale — Ларионов (третичные)",
    "category": "vshale",
    "requires": ["gr"],
    "params": {
        "gr_min": {"default": 15.0, "min": 0.0, "max": 200.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистого песка"},
        "gr_max": {"default": 120.0, "min": 0.0, "max": 300.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистой глины"},
    },
    "output": "VSH",
})

register_method({
    "key": "vshale_larionov_older",
    "label": "Vshale — Ларионов (древние)",
    "category": "vshale",
    "requires": ["gr"],
    "params": {
        "gr_min": {"default": 15.0, "min": 0.0, "max": 200.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистого песка"},
        "gr_max": {"default": 120.0, "min": 0.0, "max": 300.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистой глины"},
    },
    "output": "VSH",
})

register_method({
    "key": "vshale_stieber",
    "label": "Vshale — Штибер",
    "category": "vshale",
    "requires": ["gr"],
    "params": {
        "gr_min": {"default": 15.0, "min": 0.0, "max": 200.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистого песка"},
        "gr_max": {"default": 120.0, "min": 0.0, "max": 300.0, "step": 1.0,
                   "unit": "GAPI", "description": "GR чистой глины"},
    },
    "output": "VSH",
})

register_method({
    "key": "vshale_neutron_density",
    "label": "Vshale — из ГГКп-ННКт",
    "category": "vshale",
    "requires": ["rhob", "nphi"],
    "params": {
        "rho_matrix": {"default": 2.65, "min": 1.5, "max": 3.0, "step": 0.01,
                       "unit": "g/cm³", "description": "Плотность матрицы"},
        "rho_fluid": {"default": 1.0, "min": 0.1, "max": 1.5, "step": 0.05,
                      "unit": "g/cm³", "description": "Плотность флюида"},
        "phid_clean": {"default": 0.30, "min": 0.0, "max": 0.6, "step": 0.01,
                       "unit": "v/v", "description": "PHID чистого песка"},
        "phid_shale": {"default": 0.10, "min": 0.0, "max": 0.6, "step": 0.01,
                       "unit": "v/v", "description": "PHID чистой глины"},
        "nphi_clean": {"default": 0.28, "min": 0.0, "max": 0.6, "step": 0.01,
                       "unit": "v/v", "description": "NPHI чистого песка"},
        "nphi_shale": {"default": 0.25, "min": 0.0, "max": 0.6, "step": 0.01,
                       "unit": "v/v", "description": "NPHI чистой глины"},
    },
    "output": "VSH_ND",
})