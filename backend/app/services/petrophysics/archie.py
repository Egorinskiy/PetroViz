"""
Водонасыщенность по Арчи + R0 (overlay на УЭС).

Вход — ВАЛИДИРОВАННАЯ интерпретатором пористость из сохранённого расчёта.
Rt — кривая УЭС из LAS.

Формулы:
    Sw = ((a × Rw) / (PHI^m × Rt))^(1/n)
    R0 = (a × Rw) / (PHI^m)
"""
import logging

import numpy as np
import pandas as pd

from .base import register_method

logger = logging.getLogger("petroviz.petrophysics.archie")


def sw_archie(
    phi: pd.Series,
    rt: pd.Series,
    a: float = 1.0,
    m: float = 2.0,
    n: float = 2.0,
    rw: float = 0.1,
) -> pd.Series:
    """
    Водонасыщенность по Арчи.

    Параметры:
        phi — валидированная пористость (v/v)
        rt  — сопротивление пласта (Ом·м)
        a, m, n, rw — стандартные параметры Арчи
    """
    if a <= 0:
        raise ValueError("a must be positive")
    if m <= 0:
        raise ValueError("m must be positive")
    if n <= 0:
        raise ValueError("n must be positive")
    if rw <= 0:
        raise ValueError("rw must be positive")

    valid = (phi > 0) & (rt > 0)
    phi_m = np.power(phi.where(valid), m)
    denom = phi_m * rt.where(valid)

    with np.errstate(divide="ignore", invalid="ignore"):
        sw = np.power((a * rw) / denom, 1.0 / n)

    return sw.where(valid).clip(lower=0.0, upper=1.0)


def r0_archie(
    phi: pd.Series,
    a: float = 1.0,
    m: float = 2.0,
    rw: float = 0.1,
) -> pd.Series:
    """
    Сопротивление 100% водонасыщенной породы (overlay на трек УЭС).
    """
    if a <= 0:
        raise ValueError("a must be positive")
    if m <= 0:
        raise ValueError("m must be positive")
    if rw <= 0:
        raise ValueError("rw must be positive")

    valid = phi > 0
    phi_m = np.power(phi.where(valid), m)

    with np.errstate(divide="ignore", invalid="ignore"):
        r0 = (a * rw) / phi_m

    return r0.where(valid)

register_method({
    "key": "r0_archie",
    "label": "R0 — сопротивление водонасыщенной породы",
    "category": "sw",
    "requires": [],
    "requires_computations": {
        "phi": {"label": "Пористость (PHI)", "category": "porosity"},
    },
    "params": {
        "a": {
            "default": 1.0, "min": 0.5, "max": 1.5, "step": 0.01,
            "unit": "—", "description": "Коэффициент a",
        },
        "m": {
            "default": 2.0, "min": 1.5, "max": 2.5, "step": 0.01,
            "unit": "—", "description": "Показатель цементации m",
        },
        "rw": {
            "default": 0.1, "min": 0.005, "max": 10.0, "step": 0.001,
            "scale": "log", "label": "Rw (сопротивление воды)",
            "unit": "Ом·м", "description": "Сопротивление пластовой воды Rw",
        },
    },
    "output": "R0",
})

register_method({
    "key": "sw_archie",
    "label": "Sw — Арчи (водонасыщенность)",
    "category": "sw",
    "requires": ["rt"],
    "requires_computations": {
        "phi": {"label": "Пористость (PHI)", "category": "porosity"},
    },
    "params": {
        "a": {
            "default": 1.0, "min": 0.5, "max": 1.5, "step": 0.01,
            "unit": "—", "description": "Коэффициент a (обычно 1.0)",
        },
        "m": {
            "default": 2.0, "min": 1.5, "max": 2.5, "step": 0.01,
            "unit": "—", "description": "Показатель цементации m",
        },
        "n": {
            "default": 2.0, "min": 1.5, "max": 2.5, "step": 0.01,
            "unit": "—", "description": "Показатель насыщения n",
        },
        "rw": {
            "default": 0.1, "min": 0.005, "max": 10.0, "step": 0.001,
            "scale": "log", "label": "Rw (сопротивление воды)",
            "unit": "Ом·м", "description": "Сопротивление пластовой воды Rw",
        },
    },
    "output": "SW",
})

