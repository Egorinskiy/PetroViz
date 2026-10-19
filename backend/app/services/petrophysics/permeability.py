"""
Проницаемость по Тимуру-Коатсу.

Формула:
    K = (C × PHI^a) / Swi^b   [мД]

Классические параметры Timur: C=10000, a=4.5, b=2.0.
"""
import logging

import numpy as np
import pandas as pd

from .base import register_method

logger = logging.getLogger("petroviz.petrophysics.permeability")


def perm_timur_coates(
    phi: pd.Series,
    swi: pd.Series,
    c: float = 10000.0,
    a: float = 4.5,
    b: float = 2.0,
) -> pd.Series:
    """
    Проницаемость по Тимуру-Коатсу (мД).

    Параметры:
        phi — пористость (v/v)
        swi — связанная вода (v/v)
        c   — масштабный коэффициент (зависит от региона)
        a   — показатель пористости (Timur: 4.5)
        b   — показатель Swi (Timur: 2.0)

    NaN при PHI ≤ 0 или Swi ≤ 0.
    """
    if c <= 0:
        raise ValueError("c must be positive")
    if a <= 0:
        raise ValueError("a must be positive")
    if b <= 0:
        raise ValueError("b must be positive")

    valid = (phi > 0) & (swi > 0)
    phi_pow = np.power(phi.where(valid), a)
    swi_pow = np.power(swi.where(valid), b)

    with np.errstate(divide="ignore", invalid="ignore"):
        perm = (c * phi_pow) / swi_pow

    return perm.where(valid)


register_method({
    "key": "perm_timur_coates",
    "label": "Проницаемость — Тимур-Коатс",
    "category": "perm",
    "requires": [],
    "requires_computations": {
        "phi": {"label": "Пористость (PHI)", "category": "porosity"},
        "swi": {"label": "Swi (связанная вода)", "category": "swi"},
    },
    "params": {
        "c": {
            "default": 10000.0, "min": 100.0, "max": 100000.0, "step": 100.0,
            "scale": "log", "label": "Коэффициент C",
            "unit": "—",
            "description": "Масштабный коэффициент (Timur: 10000)",
        },
        "a": {
            "default": 4.5, "min": 1.0, "max": 8.0, "step": 0.1,
            "label": "Показатель a", "unit": "—",
            "description": "Показатель степени пористости (Timur: 4.5)",
        },
        "b": {
            "default": 2.0, "min": 1.0, "max": 4.0, "step": 0.1,
            "label": "Показатель b", "unit": "—",
            "description": "Показатель степени Swi (Timur: 2.0)",
        },
    },
    "output": "PERM",
    "output_unit": "mD",
})